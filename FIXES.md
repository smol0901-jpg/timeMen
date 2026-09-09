# СменаЛАН - Полное исправление всех проблем

## 🚨 Критичные проблемы и их решения

### 1. Камера работает постоянно вместо только при входе
**Проблема**: Камера включается при открытии настроек и не выключается
**Решение**: Камера должна включаться ТОЛЬКО в модальном окне FaceCheck при входе через киоск

**Исправление в Kiosk.tsx**:
```tsx
// Убрать глобальное превью камеры
// Камера открывается только в FaceCheck компоненте
{bioFor && (
  <FaceCheck
    target={bioUser}
    users={db.users}
    threshold={db.settings.camThreshold || 0.58}
    mirror={db.settings.camMirror}
    title={`Биометрия: ${bioUser.name}`}
    onClose={() => setBioFor(null)}
    onResult={(r) => {
      // обработка результата
      if (db.settings.camOn) addCamShot(null, bioUser.id, r.frame, "in");
    }}
  />
)}
```

### 2. Игры с ИИ перезагружают страницу
**Проблема**: При создании игры с ИИ происходит синхронизация с сервером
**Решение**: Игры с ИИ должны быть локальными, без синхронизации

**Исправление в ai-games.tsx**:
```tsx
// Использовать локальное состояние вместо store
const [localGame, setLocalGame] = useState<LocalGame | null>(null);

const startGame = () => {
  setLocalGame({
    id: 'local-' + Date.now(),
    kind,
    level,
    board: initBoard(kind),
    turn: 0,
    moves: []
  });
};
```

### 3. Версия сервера постоянно растёт (v155, v178)
**Проблема**: Каждое изменение настроек увеличивает версию
**Решение**: Уменьшить частоту синхронизации настроек

**Исправление в store.tsx**:
```tsx
// Debounce для сохранения настроек
useEffect(() => {
  const timeout = setTimeout(() => {
    if (settingsChanged) {
      setSettings(localSettings);
      setSettingsChanged(false);
    }
  }, 2000); // 2 секунды задержка
  return () => clearTimeout(timeout);
}, [localSettings]);
```

### 4. Чаты вылетают после сообщений
**Проблема**: После отправки сообщения происходит перезагрузка
**Решение**: Использовать оптимистичное обновление UI

**Исправление в misc.tsx**:
```tsx
const sendMessage = (text: string) => {
  // Оптимистичное обновление
  setMessages(prev => [...prev, { id: 'temp', text, userId: me.id, ts: new Date().toISOString() }]);
  
  // Отправка на сервер
  store.sendMessage(threadId, text, null);
};
```

### 5. Автозапуск не сохраняется
**Проблема**: Тумблер автозапуска не работает
**Решение**: Добавить API эндпоинт для автозапуска

**Исправление в launcher.py**:
```python
if path == "/api/autostart":
    on = body.get("on", False)
    set_autostart(on)
    SETTINGS["autostart"] = on
    save_settings(SETTINGS)
    return self._send(200, {"ok": True, "autostart": on})
```

### 6. Загрузка файлов по одному вместо 10
**Проблема**: Множественная загрузка не работает
**Решение**: Исправить обработчик файлов

**Исправление в feed.tsx**:
```tsx
const handleFiles = async (files: FileList) => {
  const attachments: Attachment[] = [];
  for (let i = 0; i < Math.min(files.length, 10); i++) {
    const att = await uploadAttachment(files[i]);
    attachments.push(att);
  }
  setFiles(attachments);
};
```

### 7. Рисунки не отображаются на стене
**Проблема**: Canvas не конвертируется в изображение
**Решение**: Исправить конвертацию

**Исправление в feed.tsx**:
```tsx
const saveDrawing = () => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const dataUrl = canvas.toDataURL('image/png');
  setImg(dataUrl);
  setDraw(false);
};
```

### 8. Стена постоянно обновляется
**Проблема**: Синхронизация каждую секунду
**Решение**: Увеличить интервал синхронизации

**Исправление в store.tsx**:
```tsx
// Синхронизация каждые 5 секунд вместо 1
const syncInterval = setInterval(sync, 5000);
```

### 9. Онлайн игры не работают
**Проблема**: Баги в логике игр
**Решение**: Исправить проверку ходов

**Исправление в games.ts**:
```tsx
// Исправить проверку цвета фигур в шахматах
if (target !== "." && (target === target.toUpperCase()) === isWhite) return null;
```

### 10. Telegram бот 400 ошибка
**Проблема**: Неправильный формат запроса
**Решение**: Исправить отправку в Telegram

**Исправление в launcher.py**:
```python
if path == "/api/telegram":
    text = body.get("text", "")
    token = SETTINGS.get("tgToken", "")
    chat = SETTINGS.get("tgChat", "")
    
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=json.dumps({"chat_id": chat, "text": text}).encode(),
        headers={"Content-Type": "application/json"}
    )
    urllib.request.urlopen(req, timeout=10)
```

### 11. Бот не понимает команды с маркерами
**Проблема**: Команды с "•" не распознаются
**Решение**: Очистить текст от маркеров

**Исправление в store.tsx**:
```tsx
const cleanText = text.replace(/^[\s•\-\*]+/, "").trim();
const parts = cleanText.split(/\s+/);
```

## 📝 Восстановление проекта

### Шаг 1: Восстановить структуру файлов
```bash
# Создать директории
mkdir -p src/{lib,screens,components}
mkdir -p server/data/{files,backups}
mkdir -p public
```

### Шаг 2: Восстановить типы
```bash
# Скопировать из документации types.ts
```

### Шаг 3: Восстановить store
```bash
# Скопировать из документации store.tsx с исправлениями
```

### Шаг 4: Восстановить экраны
```bash
# Скопировать все экраны из документации
```

### Шаг 5: Восстановить сервер
```bash
# Скопировать launcher.py с исправлениями
```

## 🔧 Автоматическое восстановление

Создан скрипт `restore.sh` который автоматически восстановит весь проект.

## ✅ Чек-лист исправлений

- [ ] Камера только при входе
- [ ] Игры с ИИ локальные
- [ ] Версия сервера стабильна
- [ ] Чаты не вылетают
- [ ] Автозапуск работает
- [ ] Загрузка 10 файлов
- [ ] Рисунки на стене
- [ ] Стена не обновляется постоянно
- [ ] Онлайн игры работают
- [ ] Telegram работает
- [ ] Бот понимает команды

## 📞 Поддержка

При возникновении проблем обращайтесь:
- Telegram: @ASV_PROD
- Email: smolyaninovchef@vk.com
- Телефон: +79934894429

---

**Версия**: 3.0  
**Дата**: 2026  
**Статус**: Требуется восстановление проекта
