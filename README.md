# VideoClipzy

AI-редактор коротких видео: сценарии Gemini, сцены, фотографии, оформление, озвучка и экспорт WebM.

## Структура

- `index.html` — приложение.
- `css/style.css` — адаптивный интерфейс.
- `js/app.js` — редактор, Canvas-превью, медиатека и экспорт.
- `worker/worker.js` — Cloudflare Worker API.
- `wrangler.toml` — конфигурация деплоя Worker.

## Frontend

Публикуй корень репозитория через GitHub Pages (Settings → Pages → Deploy from a branch → main → /(root)). API-адрес настроен на:

`https://video-radar-api.bahmetevdanil2005.workers.dev`

## Worker

В репозитории находится исходник Worker. Для развертывания из этого репозитория:

1. Установи Node.js и Wrangler: `npm install -g wrangler`.
2. Выполни `wrangler login`.
3. Укажи ключ Gemini как секрет: `wrangler secret put GEMINI_API_KEY`.
4. Выполни `wrangler deploy`.

Не помещай ключ Gemini в HTML, JavaScript фронтенда или Git.

## API

- `GET /health` — состояние сервиса и наличие серверного ключа.
- `POST /director` — генерация сценария. JSON: `{ "idea", "ratio", "duration", "tone" }`.
- `POST /edit` — редактирование сцены. JSON: `{ "scene", "instruction" }`.
- `POST /tts` — генерация речи Gemini. JSON: `{ "text", "voice" }`.
- `POST /logo` — загрузка изображения логотипа с ограниченного списка HTTPS-доменов.

## Важно

Проверка /health подтверждает доступность API, а поле `aiConfigured` показывает, установлен ли секрет. Успешная генерация требует действующего Gemini API key и доступной модели. Экспорт браузером сохраняет WebM; поддержка MP4 зависит от браузера и кодеков. Проект сохраняется локально в браузере, JSON проекта можно экспортировать и импортировать.
