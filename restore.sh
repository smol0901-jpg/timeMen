#!/bin/bash
# Скрипт автоматического восстановления проекта СменаЛАН

echo "🔄 Восстановление проекта СменаЛАН..."

# Создание структуры директорий
echo "📁 Создание структуры..."
mkdir -p src/{lib,screens,components}
mkdir -p server/data/{files,backups}
mkdir -p public

# Восстановление package.json
echo "📦 Восстановление зависимостей..."
cat > package.json << 'EOF'
{
  "name": "smenalan",
  "private": true,
  "version": "3.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "recharts": "^2.12.7",
    "xlsx": "^0.18.5",
    "qrcode": "^1.5.4",
    "face-api.js": "^0.22.2"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "~5.6.2",
    "vite": "^6.0.3",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0"
  }
}
EOF

# Установка зависимостей
echo "📥 Установка npm пакетов..."
npm install

# Восстановление index.html
echo "🌐 Восстановление index.html..."
cat > index.html << 'EOF'
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/icon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#14181f" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <title>СменаЛАН — сервер учёта смен</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF

# Восстановление PWA манифеста
echo "📱 Восстановление PWA..."
cat > public/manifest.webmanifest << 'EOF'
{
  "name": "СменаЛАН — учёт рабочего времени",
  "short_name": "СменаЛАН",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#edf0f3",
  "theme_color": "#14181f",
  "lang": "ru",
  "icons": [
    { "src": "icon.svg", "sizes": "any", "type": "image/svg+xml" }
  ]
}
EOF

# Восстановление service worker
cat > public/sw.js << 'EOF'
const CACHE = "smenalan-v3";
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { self.clients.claim(); });
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
EOF

# Восстановление иконки
cat > public/icon.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="116" fill="#14181f"/>
  <circle cx="256" cy="256" r="148" fill="none" stroke="#e56f24" stroke-width="40"/>
  <path d="M256 108v148l100 60" fill="none" stroke="#edf0f3" stroke-width="26" stroke-linecap="round"/>
  <circle cx="256" cy="256" r="20" fill="#e56f24"/>
</svg>
EOF

echo "✅ Восстановление завершено!"
echo ""
echo "📋 Следующие шаги:"
echo "1. Проверьте FIXES.md для исправления критичных багов"
echo "2. Запустите: npm run dev"
echo "3. В другом терминале: cd server && python launcher.py"
echo ""
echo "📞 Поддержка: @ASV_PROD | smolyaninovchef@vk.com | +79934894429"
