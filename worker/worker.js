const DEFAULT_MODEL = "gemini-2.5-flash";
const MODELS = [DEFAULT_MODEL, "gemini-2.0-flash"];
const JSON_HEADERS = {"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const corsHeaders = origin => ({
 "access-control-allow-origin": origin || "*",
 "access-control-allow-methods":"GET,POST,OPTIONS",
 "access-control-allow-headers":"Content-Type,Authorization",
 "access-control-max-age":"86400",
 "vary":"Origin"
});
function response(data,status=200,origin="*"){return new Response(JSON.stringify(data),{status,headers:{...JSON_HEADERS,...corsHeaders(origin)}});}
function err(message,status=400,origin="*"){return response({ok:false,error:message},status,origin);}
async function readBody(request){const len=Number(request.headers.get("content-length")||0);if(len>2_000_000)throw new Error("Размер запроса превышает 2 МБ.");const data=await request.json();if(!data||typeof data!=="object"||Array.isArray(data))throw new Error("Ожидался JSON-объект.");return data;}
async function gemini(env,contents,{json=false,temperature=.8,maxOutputTokens=4096}={}){
 if(!env.GEMINI_API_KEY)throw new Error("На сервере не задан секрет GEMINI_API_KEY.");
 let last;
 for(const model of MODELS){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),55000);
  try{
   const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({contents,generationConfig:{temperature,maxOutputTokens,...(json?{responseMimeType:"application/json"}:{})}}),signal:controller.signal});
   const data=await res.json().catch(()=>({}));
   if(!res.ok){last=new Error(data.error?.message||`Gemini API: HTTP ${res.status}`);if([400,401,403].includes(res.status))break;continue;}
   const text=(data.candidates||[]).flatMap(c=>c.content?.parts||[]).map(p=>p.text||"").join("\n").trim();
   if(!text)throw new Error("Gemini вернул пустой ответ.");
   return text;
  }catch(e){last=e;if(e.name==="AbortError")last=new Error("Истекло время ожидания Gemini.");}
  finally{clearTimeout(timer);}
 }
 throw last||new Error("Не удалось получить ответ Gemini.");
}
function extractJson(text){const cleaned=text.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"").trim();try{return JSON.parse(cleaned);}catch{}const start=cleaned.indexOf("{"),end=cleaned.lastIndexOf("}");if(start>=0&&end>start){try{return JSON.parse(cleaned.slice(start,end+1));}catch{}}throw new Error("AI вернул некорректный JSON. Попробуй повторить запрос.");}
async function director(body,env){
 const idea=String(body.idea||"").trim();if(!idea)throw new Error("Поле idea обязательно.");if(idea.length>5000)throw new Error("Идея слишком длинная (максимум 5000 символов).");
 const ratio=["9:16","16:9","1:1"].includes(body.ratio)?body.ratio:"9:16",duration=Math.min(90,Math.max(10,Number(body.duration)||30)),tone=String(body.tone||"Динамичный").slice(0,100);
 const prompt=`Ты профессиональный режиссёр коротких рекламных и образовательных видео. Создай оригинальный сценарий на русском языке. Верни СТРОГО JSON без Markdown в формате {"title":"...","hook":"...","scenes":[{"title":"короткий заголовок","text":"текст на экране или дикторский текст","visual":"описание визуала","duration":5}],"cta":"...","music":"..."}.
Идея: ${idea}
Формат: ${ratio}. Длительность: около ${duration} секунд. Подача: ${tone}.
Сделай сильный hook в первой сцене, логичное развитие и конкретный CTA. 4-8 сцен. Сумма duration должна быть близка к длительности. Не добавляй несуществующие факты.`;
 const raw=await gemini(env,[{role:"user",parts:[{text:prompt}]}],{json:true,temperature:.85});
 const result=extractJson(raw);if(!Array.isArray(result.scenes)||!result.scenes.length)throw new Error("В ответе AI нет массива scenes.");
 result.scenes=result.scenes.slice(0,12).map(s=>({title:String(s.title||"Сцена").slice(0,140),text:String(s.text||"").slice(0,1200),visual:String(s.visual||"").slice(0,500),duration:Math.max(1,Math.min(30,Number(s.duration)||5))}));
 return result;
}
async function edit(body,env){
 const instruction=String(body.instruction||body.prompt||"").trim(),scene=body.scene;if(!instruction)throw new Error("Добавь инструкцию для редактирования.");
 const raw=await gemini(env,[{role:"user",parts:[{text:`Отредактируй сцену короткого видео по инструкции. Верни JSON {"title":"...","text":"...","visual":"..."} без Markdown. Сцена: ${JSON.stringify(scene||{})}. Инструкция: ${instruction}`}]}],{json:true,temperature:.6});
 return extractJson(raw);
}
async function tts(body,env){
 const text=String(body.text||"").trim(),voice=String(body.voice||"Kore");if(!text)throw new Error("Текст для озвучки пуст.");if(text.length>8000)throw new Error("Текст превышает 8000 символов.");
 const allowed=["Zephyr","Puck","Charon","Kore","Fenrir","Leda","Orus","Aoede","Callirrhoe","Autonoe","Enceladus","Iapetus","Umbriel","Algieba","Despina","Erinome","Algenib","Rasalgethi","Laomedeia","Achernar","Alnilam","Schedar","Gacrux","Pulcherrima","Achird","Zubenelgenubi","Vindemiatrix","Sadachbia","Sadaltager","Sulafat"];
 const chosen=allowed.includes(voice)?voice:"Kore";
 if(!env.GEMINI_API_KEY)throw new Error("На сервере не задан секрет GEMINI_API_KEY.");
 let last;
 for(const model of ["gemini-2.5-flash-preview-tts","gemini-2.5-pro-preview-tts"]){
  try{
   const url=`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
   const res=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:`Прочитай естественно на русском языке, выразительно и без добавления слов: ${text}`}]}],generationConfig:{responseModalities:["AUDIO"],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:chosen}}}}})});
   const data=await res.json();if(!res.ok){last=new Error(data.error?.message||`TTS HTTP ${res.status}`);continue;}
   const part=data.candidates?.[0]?.content?.parts?.find(p=>p.inlineData?.data);if(!part)throw new Error("Gemini TTS не вернул аудиоданные.");
   return {audio:part.inlineData.data,mimeType:part.inlineData.mimeType||"audio/L16;codec=pcm;rate=24000",voice:chosen};
  }catch(e){last=e;}
 }
 throw last||new Error("TTS временно недоступен.");
}
async function logo(request,env){
 const body=await readBody(request),raw=String(body.url||"");let url;
 try{url=new URL(raw);}catch{throw new Error("Некорректный URL логотипа.");}
 if(url.protocol!=="https:"||url.username||url.password)throw new Error("Разрешены только публичные HTTPS-адреса.");
 const host=url.hostname.toLowerCase();if(host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")||/^\d+(\.\d+){3}$/.test(host)||host==="[::1]")throw new Error("Локальные и IP-адреса запрещены.");
 const allowed=["cdn.simpleicons.org","upload.wikimedia.org","images.unsplash.com","logo.clearbit.com"];
 if(!allowed.some(d=>host===d||host.endsWith("."+d)))throw new Error("Домен источника не входит в список разрешённых.");
 const upstream=await fetch(url.toString(),{redirect:"manual",headers:{"accept":"image/png,image/svg+xml,image/webp,image/jpeg"}});
 if(upstream.status>=300&&upstream.status<400)throw new Error("Перенаправления для логотипов запрещены.");
 if(!upstream.ok)throw new Error(`Не удалось загрузить логотип: HTTP ${upstream.status}`);
 const type=upstream.headers.get("content-type")||"";if(!/^image\/(png|svg\+xml|webp|jpeg)/i.test(type))throw new Error("Источник вернул не изображение.");
 const bytes=await upstream.arrayBuffer();if(bytes.byteLength>1_000_000)throw new Error("Логотип больше 1 МБ.");
 return new Response(bytes,{headers:{...corsHeaders(request.headers.get("origin")),"content-type":type,"cache-control":"public, max-age=86400","x-content-type-options":"nosniff"}});
}
export default {
 async fetch(request,env){
  const url=new URL(request.url),origin=request.headers.get("origin")||"*";
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:corsHeaders(origin)});
  if(url.pathname==="/health"&&request.method==="GET")return response({ok:true,status:"ok",service:"VideoClipzy API",timestamp:new Date().toISOString(),aiConfigured:Boolean(env.GEMINI_API_KEY)},200,origin);
  if(request.method==="GET"&&url.pathname==="/")return response({ok:true,service:"VideoClipzy API",endpoints:["/health","/director","/edit","/tts","/logo"]},200,origin);
  if(!["POST"].includes(request.method))return err("Метод не поддерживается.",405,origin);
  try{
   if(url.pathname==="/logo")return await logo(request,env);
   const body=await readBody(request);
   if(url.pathname==="/director")return response(await director(body,env),200,origin);
   if(url.pathname==="/edit")return response(await edit(body,env),200,origin);
   if(url.pathname==="/tts")return response(await tts(body,env),200,origin);
   return err("Маршрут не найден.",404,origin);
  }catch(e){return err(e.message||"Внутренняя ошибка сервера.",e.message?.includes("GEMINI_API_KEY")?503:400,origin);}
 }
};