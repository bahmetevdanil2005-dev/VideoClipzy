const API_BASE="https://video-radar-api.bahmetevdanil2005.workers.dev", $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const state={ratio:"9:16",duration:30,tone:"Динамичный и энергичный",scenes:[],current:0,playing:false,raf:0,currentTime:0,playStartedAt:0,playOffset:0};
const palettes={"9:16":["#245477","#101d2c"],"16:9":["#183c59","#101d2c"],"1:1":["#31566d","#111d2a"]};
function toast(m){const e=$("#toast");e.textContent=m;e.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove("show"),3200)}
function showError(error,context="Ошибка приложения"){const message=error instanceof Error?(error.stack||error.message):String(error??"Неизвестная ошибка");const full=[context,new Date().toLocaleString("ru-RU"),"",message].join("\\n");let panel=$("#errorPanel");if(!panel){panel=document.createElement("section");panel.id="errorPanel";panel.className="error-panel";panel.setAttribute("role","alert");panel.innerHTML='<div class="error-head"><strong>Не удалось выполнить действие</strong><button type="button" class="error-close" aria-label="Закрыть">×</button></div><pre class="error-message"></pre><button type="button" class="error-copy">Копировать ошибку</button>';document.body.append(panel);panel.querySelector(".error-close").onclick=()=>panel.classList.remove("visible");panel.querySelector(".error-copy").onclick=async()=>{try{await navigator.clipboard.writeText(panel.dataset.error||"");toast("Текст ошибки скопирован.");}catch{const area=document.createElement("textarea");area.value=panel.dataset.error||"";area.style.position="fixed";area.style.opacity="0";document.body.append(area);area.select();try{document.execCommand("copy");toast("Текст ошибки скопирован.");}catch{toast("Не удалось скопировать. Выдели текст ошибки вручную.");}area.remove();}};}panel.dataset.error=full;panel.querySelector(".error-message").textContent=full;panel.classList.add("visible");}
async function api(path,body=null,timeout=100000){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(API_BASE+path,{method:body?"POST":"GET",headers:body?{"Content-Type":"application/json"}:{},body:body?JSON.stringify(body):undefined,signal:c.signal}),d=await r.json().catch(()=>({error:"Сервер вернул некорректный ответ"}));if(!r.ok)throw Error(d.error||d.message||"Ошибка API "+r.status);return d}catch(e){if(e.name==="AbortError")throw Error("Истекло время ожидания AI-сервера.");throw e}finally{clearTimeout(t)}}
async function health(){try{const d=await api("/health",null,8000);$("#healthDot").className=d.aiConfigured===false?"offline":"online";$("#apiStatus").textContent=d.aiConfigured===false?"API доступен · не задан Gemini API Key":"Gemini AI подключён"}catch{$("#healthDot").className="offline";$("#apiStatus").textContent="AI-сервер недоступен"}}
const MOTION_LIBRARY=["GRID / архитектурная сетка","RAYS / вращающиеся лучи","GLOW / объёмное свечение","AURORA / полярные ленты","TOPO / рельефные контуры","NEBULA / звёздная пыль","CHROME / жидкий хром","PRISM / стеклянные плоскости","ORBIT / орбитальная механика","SILK / шёлковые ленты","ECLIPSE / солнечная корона","PORTAL / световая перспектива","DUNE / слои песка"];
const motionPalettes=[["#080b24","#263b70","#25d6c8"],["#061c2c","#126b78","#a5f3fc"],["#101018","#4b5563","#e2e8f0"],["#071b2b","#087f8c","#9fffe0"],["#071c24","#155e63","#b4e7a8"],["#09051d","#4c1d95","#fb7185"],["#11131b","#596579","#dce8f7"],["#11152c","#4c3b86","#f0abfc"],["#080d22","#1d4ed8","#67e8f9"],["#1b1027","#7c2d6b","#f9a8d4"],["#070b18","#312e81","#fbbf24"],["#090d24","#5b21b6","#818cf8"],["#17111f","#78350f","#fcd34d"]];
function captionBeats(scene){
 const tokens=[];const add=(v,part)=>String(v||"").split(/(\*[^*]+\*)/).filter(Boolean).forEach(seg=>{const hi=/^\*[^*]+\*$/.test(seg),raw=hi?seg.slice(1,-1):seg;raw.split(/\s+/).filter(Boolean).forEach(word=>{const m=word.match(/^(.*?)([.,;:!?…]*)$/);if(m[1])tokens.push({text:m[1]+m[2],highlight:hi,part,punc:m[2]})})});
 add(scene?.text||scene?.narration||scene?.title,0);add(scene?.subtitle,1);
 const chunks=[];let i=0;while(i<tokens.length){const first=tokens[i],want=first.text.length>=8?1:first.text.length<=2?2:(i%3===0?1:2),chunk=[first];let chars=first.text.length;
 while(chunk.length<want&&i+chunk.length<tokens.length){const prev=chunk.at(-1),next=tokens[i+chunk.length];if(/[.,;:!?…]/.test(prev.punc)||next.part!==prev.part||chars+next.text.length>17)break;chunk.push(next);chars+=next.text.length}
 chunks.push(chunk);i+=chunk.length}return chunks;
}
function beatAt(scene,progress){
 const chunks=captionBeats(scene);if(!chunks.length)return {words:[{text:scene?.title||"ТВОЯ ИДЕЯ"}],index:0,local:0,part:0};
 const weights=chunks.map(ch=>ch.reduce((n,w)=>n+w.text.length+1,0)+(/[.,;:!?…]/.test(ch.at(-1).punc)?2:0)),sum=weights.reduce((a,b)=>a+b,0);
 let cursor=Math.min(sum-.0001,Math.max(0,progress)*sum),base=0;for(let i=0;i<chunks.length;i++){if(cursor<base+weights[i])return {words:chunks[i],index:i,local:(cursor-base)/weights[i],part:chunks[i][0].part};base+=weights[i]}return {words:chunks.at(-1),index:chunks.length-1,local:1,part:chunks.at(-1)[0].part};
}
function drawThemeSignature(x,w,h,theme,t,seed,color){
 const pulse=.5+.5*Math.sin(t*.0012+seed),cx=w*(.5+.08*Math.sin(t*.00023+seed)),cy=h*(.48+.06*Math.cos(t*.00019+seed));
 x.save();x.globalCompositeOperation="screen";x.lineCap="round";x.lineJoin="round";x.strokeStyle=color;x.fillStyle=color;
 const path=(fn,width,alpha)=>{x.beginPath();for(let i=0;i<=100;i++){const u=i/100,p=fn(u);if(i===0)x.moveTo(...p);else x.lineTo(...p)}x.lineWidth=width;x.globalAlpha=alpha;x.stroke();x.globalAlpha=1};
 switch(theme){
 case 0: for(let i=0;i<6;i++){x.beginPath();x.ellipse(cx,cy,w*(.12+i*.045),h*(.07+i*.035),t*.00018,0,7);x.globalAlpha=.35;x.lineWidth=2;x.stroke()}break;
 case 1: for(let i=0;i<5;i++)path(u=>[u*w,h*(.2+i*.12+Math.sin(u*5+t*.0006+i)*.08)],w*.025,.12);break;
 case 2: for(let i=0;i<4;i++){const xx=w*(.2+i*.2),yy=h*(.25+(i%2)*.4);const r=w*(.07+i*.012);const rg=x.createRadialGradient(xx-r*.35,yy-r*.4,1,xx,yy,r);rg.addColorStop(0,"#ffffffdd");rg.addColorStop(.25,color+"aa");rg.addColorStop(1,"#11182700");x.fillStyle=rg;x.beginPath();x.arc(xx,yy,r,0,7);x.fill()}break;
 case 3: for(let i=0;i<7;i++){const xx=w*(.08+i*.14);x.beginPath();x.moveTo(xx,h*.12);x.lineTo(xx+w*.1,h*.5);x.lineTo(xx,h*.88);x.closePath();x.globalAlpha=.13;x.lineWidth=2;x.stroke()}break;
 case 4: for(let i=0;i<85;i++){const xx=(i*127.7+seed*17)%w,yy=(i*211.3+seed*31)%h,r=(i%3+1)*1.4;x.globalAlpha=.25+(i%4)*.12;x.beginPath();x.arc(xx,yy,r*(1+pulse),0,7);x.fill()}break;
 case 5: for(let i=0;i<16;i++){const yy=h*(.18+i*.045);path(u=>[u*w,yy+Math.sin(u*9+i*.4)*h*.035+Math.cos(u*4+i)*h*.02],1.5,.22)}break;
 case 6: for(let i=0;i<4;i++)path(u=>[u*w,h*(.25+i*.16)+Math.sin(u*6+t*.00035+i)*h*.13],w*.035,.11);break;
 case 7: for(let i=0;i<12;i++){x.beginPath();x.moveTo(w*.5+i*w*.035,h*.35);x.lineTo(w*.5+i*w*.13,h);x.globalAlpha=.2;x.lineWidth=1;x.stroke()}for(let i=0;i<9;i++){const yy=h*(.4+i*i*.009);x.beginPath();x.moveTo(0,yy);x.lineTo(w,yy);x.globalAlpha=.16;x.stroke()}break;
 case 8: for(let i=0;i<12;i++){x.save();x.translate(cx,cy);x.rotate(i*Math.PI/6+t*.0001);x.beginPath();x.ellipse(0,-h*.13,w*.035,h*.13,0,0,7);x.globalAlpha=.16;x.fill();x.restore()}break;
 case 9: x.beginPath();x.arc(cx,cy,w*.2,0,7);x.globalAlpha=.22;x.fill();x.globalCompositeOperation="destination-out";x.beginPath();x.arc(cx+w*.1,cy-h*.06,w*.19,0,7);x.fill();x.globalCompositeOperation="screen";x.beginPath();x.ellipse(cx,cy,w*.24,h*.22,0,0,7);x.globalAlpha=.5;x.lineWidth=3;x.stroke();break;
 case 10: for(let i=0;i<5;i++){const xx=w*(.18+i*.16),yy=h*(.35+.2*Math.sin(t*.0003+i));x.beginPath();x.arc(xx,yy,w*(.07+i*.008),0,7);x.globalAlpha=.08;x.fill()}break;
 case 11: for(let i=0;i<14;i++){const yy=h*(.12+i*.06);x.beginPath();x.moveTo(0,yy);x.lineTo(w,yy+h*.04*Math.sin(t*.0007+i));x.globalAlpha=.18;x.lineWidth=i%4===0?3:1;x.stroke()}break;
 case 12: for(let i=0;i<70;i++){const xx=(i*83.1+seed*9)%w,yy=(i*157.7+seed*13)%h,rr=(i%4+1)*1.2;x.globalAlpha=.3;x.beginPath();x.arc(xx+Math.sin(t*.0004+i)*12,yy+Math.cos(t*.0003+i)*12,rr,0,7);x.fill()}break;
 case 13: for(let i=0;i<5;i++){const xx=w*(.16+i*.17),yy=h*(.25+(i%2)*.45);x.beginPath();x.arc(xx,yy,w*(.06+i*.012),0,7);x.globalAlpha=.25;x.lineWidth=2+i%3;x.stroke()}break;
 case 14: for(let i=0;i<18;i++)path(u=>[u*w,h*(.15+i*.04+Math.sin(u*11+t*.0005+i*.3)*.025)],1.2,.22);break;
 case 15: for(let i=0;i<7;i++){const inset=i*w*.035;x.globalAlpha=.17-i*.015;x.lineWidth=2;x.strokeRect(inset,h*.18+inset,w-2*inset,h*.64-2*inset)}break;
 case 16: for(let i=0;i<8;i++){const xx=w*(.08+i*.12);x.beginPath();x.moveTo(xx,h*.12);x.lineTo(xx+w*.09,h*.2);x.lineTo(xx+w*.04,h*.82);x.lineTo(xx-w*.05,h*.75);x.closePath();x.globalAlpha=.1;x.fill()}break;
 case 17: for(let i=0;i<8;i++){const r=w*(.04+i*.055)+pulse*w*.012;x.beginPath();x.arc(cx,cy,r,0,7);x.globalAlpha=.25*(1-i*.07);x.lineWidth=2;x.stroke()}break;
 case 18: for(let i=0;i<12;i++){const yy=h*(.48+i*.035);path(u=>[u*w,yy+Math.sin(u*4+i*.3)*h*.045],w*.012,.11)}break;
 case 19: for(let i=0;i<10;i++){x.beginPath();x.arc(cx,cy,w*(.12+i*.035),Math.PI*(.08+i*.012),Math.PI*(.92-i*.012));x.globalAlpha=.25;x.lineWidth=w*.008;x.stroke()}break;
 }
 x.restore();
}
function drawMotionBackground(x,w,h,theme,t,seed){
 const palette=motionPalettes[((theme%3)+3)%3],base=palette[0],accent=palette[2],seconds=t/1000;
 x.save();x.globalAlpha=1;x.globalCompositeOperation="source-over";x.fillStyle=base;x.fillRect(0,0,w,h);
 const rgba=(hex,alpha)=>{const n=parseInt(hex.slice(1),16);return "rgba("+(n>>16)+","+((n>>8)&255)+","+(n&255)+","+alpha+")"};
 const kind=((theme%3)+3)%3;
 if(kind===0){
  const step=w/8,offset=(seconds*step*.6)%step;
  x.strokeStyle=rgba(accent,.16);x.lineWidth=2;x.beginPath();
  for(let px=-step+offset;px<w+step;px+=step){x.moveTo(px,0);x.lineTo(px,h)}
  for(let py=-step+offset;py<h+step;py+=step){x.moveTo(0,py);x.lineTo(w,py)}
  x.stroke();
 }else if(kind===1){
  x.save();x.translate(w/2,h/2);x.rotate(seconds*.25);x.fillStyle=rgba(accent,.1);
  const count=14,radius=Math.hypot(w,h);
  for(let i=0;i<count;i++){const angle=i/count*Math.PI*2;x.beginPath();x.moveTo(0,0);x.arc(0,0,radius,angle,angle+Math.PI/count);x.closePath();x.fill()}
  x.restore();
 }else{
  const radius=Math.max(w,h)*(.55+.05*Math.sin(seconds*3));
  const glow=x.createRadialGradient(w/2,h/2,0,w/2,h/2,radius);
  glow.addColorStop(0,rgba(accent,.45));glow.addColorStop(1,rgba(accent,0));
  x.fillStyle=glow;x.fillRect(0,0,w,h);
 }
 x.restore();
}
function draw(progress=0){
 const c=$("#previewCanvas"),x=c.getContext("2d"),w=c.width,h=c.height,scene=state.scenes[state.current],now=performance.now(),p=Math.max(0,Math.min(1,progress)),beat=scene?beatAt(scene,p):{words:[{text:"ТВОЯ ИДЕЯ"}],index:0,local:0,part:0};
 const theme=scene?(state.current*7+beat.index*3)%MOTION_LIBRARY.length:3,seed=state.current*13+beat.index*7;
 drawMotionBackground(x,w,h,theme,now,seed);if(scene?.imageData)drawScenePhoto(x,scene,w,h);if(scene)drawCaption(x,beat,w,h);
 $("#frameCounter").textContent=state.scenes.length?String(state.current+1).padStart(2,"0")+" / "+String(state.scenes.length).padStart(2,"0"):"00 / 00";
 $("#previewMeta").textContent=state.ratio+" · "+(scene?MOTION_LIBRARY[theme].split(" / ")[0]:"MOTION LIBRARY · 13 STYLES");$("#frameSubtitle").textContent="";
}
function fit(){const c=$("#previewCanvas");[c.width,c.height]=state.ratio==="9:16"?[720,1280]:state.ratio==="16:9"?[1280,720]:[900,900];$("#videoFrame").className="video-frame ratio-"+state.ratio.replace(":","-");draw()}
function totalSeconds(){return state.scenes.reduce((n,s)=>n+(+s.duration||1),0)}
function formatTime(seconds){seconds=Math.max(0,Math.floor(seconds));return Math.floor(seconds/60)+":"+String(seconds%60).padStart(2,"0")}
function updatePlayerUI(){const total=totalSeconds(),current=Math.min(total,state.currentTime/1000),bar=$("#seekBar");if(bar){bar.max=total||1;bar.value=current}$("#playerTime").textContent=formatTime(current)+" / "+formatTime(total);$("#playerProgress").style.width=(total?current/total*100:0)+"%"}
function select(i){state.current=Math.max(0,Math.min(i,state.scenes.length-1));let elapsed=0;for(let n=0;n<state.current;n++)elapsed+=(+state.scenes[n].duration||1)*1000;state.currentTime=elapsed;timeline();updatePlayerUI()}

function timeline(){const root=$("#timeline");root.innerHTML="";if(!state.scenes.length)root.innerHTML='<div class="empty-timeline">После генерации здесь появится раскадровка</div>';state.scenes.forEach((s,i)=>{const b=document.createElement("button");b.className="timeline-item"+(i===state.current?" active":"");b.textContent="Сцена "+(i+1);const sm=document.createElement("small");sm.textContent=(s.duration||0)+" сек";b.append(sm);b.onclick=()=>{stop();select(i)};root.append(b)});$("#totalDuration").textContent=state.scenes.reduce((n,s)=>n+(+s.duration||0),0)+" сек";draw()}
function renderEditor(){
 const root=$("#sceneEditor");root.innerHTML="";
 state.scenes.forEach((scene,i)=>{
  const card=document.createElement("article");card.className="scene-card";card.dataset.index=i;
  const head=document.createElement("div");head.className="scene-card-head";
  const num=document.createElement("b");num.className="scene-index";num.textContent=String(i+1).padStart(2,"0");
  const range=document.createElement("span");range.className="scene-range";const st=sceneStart(i);range.textContent=st.toFixed(1)+"–"+(st+(+scene.duration||1)).toFixed(1)+" сек";
  const actions=document.createElement("div");actions.className="scene-actions";[["↑","up"],["↓","down"],["⧉","duplicate"],["×","delete"]].forEach(([v,a])=>{const b=document.createElement("button");b.type="button";b.textContent=v;b.dataset.action=a;actions.append(b)});head.append(num,range,actions);card.append(head);
  const add=(label,key,value,tag="input")=>{const l=document.createElement("label");l.className="scene-field";l.append(document.createTextNode(label));const el=document.createElement(tag);el.dataset.field=key;el.value=value||"";if(tag==="textarea"){el.rows=key==="text"?3:2;el.maxLength=500}else{el.maxLength=160;if(key==="duration"){el.type="number";el.min="1";el.max="30";el.step=".5"}}l.append(el);card.append(l)};
  add("ЗАГОЛОВОК СЦЕНЫ","title",scene.title);add("ОСНОВНОЙ ТЕКСТ / ФРАЗА","text",scene.text,"textarea");add("СУБТИТР / ВТОРАЯ ЧАСТЬ","subtitle",scene.subtitle||"","textarea");add("ВИЗУАЛ СЦЕНЫ","visual",scene.visual||"","textarea");add("ДЛИТЕЛЬНОСТЬ, СЕК","duration",scene.duration);
  const photo=document.createElement("div");photo.className="scene-photo-control";const label=document.createElement("label");label.className="photo-upload";label.textContent=scene.imageData?"Заменить фото сцены":"Загрузить фото для этой сцены";const input=document.createElement("input");input.type="file";input.accept="image/*";input.dataset.photo="1";input.hidden=true;label.append(input);photo.append(label);
  if(scene.imageData){const img=document.createElement("img");img.className="scene-photo-thumb";img.src=scene.imageData;img.alt="Фото сцены";photo.append(img);const rm=document.createElement("button");rm.type="button";rm.className="remove-photo";rm.dataset.action="remove-photo";rm.textContent="Убрать фото";photo.append(rm)}card.append(photo);root.append(card);
 });
 $("#totalDuration").textContent=totalSeconds()+" сек";
}
function sceneEditorClick(e){const card=e.target.closest(".scene-card");if(!card)return;const i=+card.dataset.index,a=e.target.closest("[data-action]")?.dataset.action;
 if(!a){state.current=i;state.currentTime=sceneStart(i)*1000;timeline();return}
 if(a==="up"&&i>0)[state.scenes[i-1],state.scenes[i]]=[state.scenes[i],state.scenes[i-1]];
 else if(a==="down"&&i<state.scenes.length-1)[state.scenes[i+1],state.scenes[i]]=[state.scenes[i],state.scenes[i+1]];
 else if(a==="duplicate")state.scenes.splice(i+1,0,{...state.scenes[i],title:state.scenes[i].title+" — копия"});
 else if(a==="delete"){if(state.scenes.length===1){toast("Оставь хотя бы одну сцену.");return}state.scenes.splice(i,1)}
 else if(a==="remove-photo"){state.scenes[i].imageData="";renderEditor();timeline();return}else return;
 state.current=Math.min(i,state.scenes.length-1);state.currentTime=sceneStart(state.current)*1000;renderEditor();timeline();
}
function sceneEditorChange(e){const card=e.target.closest(".scene-card");if(!card)return;const i=+card.dataset.index,scene=state.scenes[i];
 if(e.target.matches("[data-photo]")){const file=e.target.files?.[0];e.target.value="";if(!file)return;if(!file.type.startsWith("image/")){toast("Выбери файл изображения.");return}if(file.size>12*1024*1024){toast("Фото должно быть меньше 12 МБ.");return}const reader=new FileReader();reader.onload=()=>{scene.imageData=String(reader.result);state.current=i;state.currentTime=sceneStart(i)*1000;renderEditor();timeline();toast("Фото добавлено к сцене "+(i+1))};reader.onerror=()=>toast("Не удалось прочитать фото.");reader.readAsDataURL(file);return}
 const key=e.target.dataset.field;if(!key)return;if(key==="duration")scene.duration=Math.max(1,Math.min(30,+e.target.value||1));else scene[key]=e.target.value;state.current=i;state.currentTime=sceneStart(i)*1000;timeline();
}
function normalize(d){const a=d.scenes||d.script?.scenes;if(!Array.isArray(a)||!a.length)throw Error("Gemini вернул ответ без сцен.");return a.slice(0,12).map((s,i)=>({title:String(s.title||"Сцена "+(i+1)),text:String(s.text||s.narration||""),subtitle:String(s.subtitle||s.subtext||""),visual:String(s.visual||""),imageData:"",duration:Math.max(1,Number(s.duration)||Math.round(state.duration/a.length))}))}
async function generate(){const idea=$("#ideaInput").value.trim();if(!idea){$("#ideaInput").focus();toast("Сначала опиши идею ролика.");return}const b=$("#generateBtn");b.disabled=true;b.classList.add("busy");b.textContent="✦ Gemini создаёт сценарий…";try{const d=await api("/director",{idea,ratio:state.ratio,duration:state.duration,tone:state.tone,platform:$("#platformSelect").value,language:$("#languageSelect").value});stop();state.scenes=normalize(d);state.current=0;state.currentTime=0;$("#scriptTitle").textContent=d.title||"Сценарий ролика";$("#scriptHook").textContent=d.hook||state.scenes[0].text;$("#ctaText").textContent=d.cta?"Финальный CTA: "+d.cta:"";$("#scriptSection").hidden=false;renderEditor();timeline();$("#scriptSection").scrollIntoView({behavior:"smooth",block:"start"});toast("Сценарий готов — предпросмотр обновлён.")}catch(e){showError(e,"Генерация сценария");toast(e.message||"Не удалось создать сценарий.")}finally{b.disabled=false;b.classList.remove("busy");b.innerHTML="<span>✦</span> Создать сценарий <b>↗</b>"}}
function stop(){if(state.playing)state.currentTime=Math.min(totalSeconds()*1000,state.playOffset+performance.now()-state.playStartedAt);state.playing=false;$("#videoFrame").classList.remove("is-playing");cancelAnimationFrame(state.raf);$("#playPreview").textContent="▶　Смотреть ролик";$("#playBtn").textContent="▶";updatePlayerUI()}
function play(){if(!state.scenes.length){toast("Сначала создай сценарий.");return}if(state.currentTime>=totalSeconds()*1000)state.currentTime=0;state.playing=true;$("#videoFrame").classList.add("is-playing");state.playOffset=state.currentTime;state.playStartedAt=performance.now();$("#playPreview").textContent="Ⅱ　Пауза";$("#playBtn").textContent="Ⅱ";const tick=now=>{if(!state.playing)return;const elapsed=Math.min(totalSeconds()*1000,state.playOffset+now-state.playStartedAt);state.currentTime=elapsed;let acc=0,i=0;for(;i<state.scenes.length-1;i++){const end=acc+(+state.scenes[i].duration||1)*1000;if(elapsed<end)break;acc=end}if(i!==state.current){state.current=i;timeline()}const sceneDuration=(+state.scenes[i].duration||1)*1000,progress=Math.max(0,Math.min(1,(elapsed-acc)/sceneDuration));draw(progress);updatePlayerUI();if(elapsed>=totalSeconds()*1000){state.currentTime=totalSeconds()*1000;stop();draw(1);return}state.raf=requestAnimationFrame(tick)};state.raf=requestAnimationFrame(tick)}

function init(){health();setInterval(health,60000);fit();timeline();$("#formatOptions").onclick=e=>{const b=e.target.closest("[data-ratio]");if(!b)return;state.ratio=b.dataset.ratio;$$(".ratio").forEach(x=>x.classList.toggle("selected",x===b));fit()};$("#durationInput").oninput=e=>{state.duration=+e.target.value;$("#durationValue").textContent=state.duration+" сек"};$("#toneOptions").onclick=e=>{const b=e.target.closest("[data-tone]");if(!b)return;state.tone=b.dataset.tone;$$(".tone").forEach(x=>x.classList.toggle("selected",x===b))};$("#generateBtn").onclick=generate;$("#regenerateBtn").onclick=generate;$("#sceneEditor").addEventListener("click",sceneEditorClick);$("#sceneEditor").addEventListener("change",sceneEditorChange);$("#sceneEditor").addEventListener("input",sceneEditorChange);$("#addSceneBtn").onclick=()=>{stop();state.scenes.push({title:"Новая сцена",text:"ДОБАВЬ СВОЙ ТЕКСТ",subtitle:"",visual:"",imageData:"",duration:3});state.current=state.scenes.length-1;state.currentTime=sceneStart(state.current)*1000;renderEditor();timeline();};$("#playPreview").onclick=()=>state.playing?stop():play();$("#playBtn").onclick=e=>{e.stopPropagation();state.playing?stop():play()};$("#videoFrame").onclick=e=>{if(e.target.id!=="playBtn")state.playing?stop():play()};$("#seekBar").oninput=e=>{const wasPlaying=state.playing;if(wasPlaying)stop();select(0);const target=Math.max(0,Math.min(totalSeconds(),+e.target.value));state.currentTime=target*1000;let elapsed=0,index=0;for(;index<state.scenes.length-1;index++){const end=elapsed+(+state.scenes[index].duration||1)*1000;if(state.currentTime<end)break;elapsed=end}state.current=index;timeline();const activeDuration=(+state.scenes[index].duration||1)*1000;draw(Math.max(0,Math.min(1,(state.currentTime-elapsed)/activeDuration)));updatePlayerUI();if(wasPlaying)play()};$("#prevScene").onclick=()=>{stop();select(state.current-1)};$("#nextScene").onclick=()=>{stop();select(state.current+1)};$("#fullscreenBtn").onclick=()=>$("#videoFrame").requestFullscreen?.();$("#copyBtn").onclick=async()=>{const text=[$("#scriptTitle").textContent,"HOOK: "+$("#scriptHook").textContent,...state.scenes.map((s,i)=>"СЦЕНА "+(i+1)+" ("+s.duration+" сек)\n"+s.title+"\n"+s.text+"\nВизуал: "+s.visual),"CTA: "+$("#ctaText").textContent].join("\n\n");try{await navigator.clipboard.writeText(text);toast("Сценарий скопирован.")}catch{toast("Не удалось скопировать — проверь разрешения браузера.")}}}
init();
window.addEventListener("error",event=>showError(event.error||event.message,"JavaScript"));window.addEventListener("unhandledrejection",event=>showError(event.reason,"Необработанная ошибка"));
