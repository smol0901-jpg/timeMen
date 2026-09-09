# 🚨 КРИТИЧНЫЕ ПРОБЛЕМЫ И РЕШЕНИЯ

## Проблема 1: Камера работает постоянно
**Симптом**: Камера включается при открытии настроек и не выключается
**Причина**: Камера открывается глобально в Kiosk.tsx
**Решение**: Камера должна открываться ТОЛЬКО в модальном окне FaceCheck

**Код для исправления**:
```tsx
// В Kiosk.tsx убрать глобальное превью камеры
// Оставить только в FaceCheck модальном окне

{bioFor && (
  <FaceCheck
    target={bioUser}
    users={db.users}
    threshold={db.settings.camThreshold || 0.58}
    mirror={db.settings.camMirror}
    title={`Биометрия: ${bioUser.name}`}
    onClose={() => setBioFor(null)}
    onResult={(r) => {
      if (r.ok) {
        doPunch(bioUser.id);
        if (db.settings.camOn) addCamShot(null, bioUser.id, r.frame, "in");
      }
      setBioFor(null);
    }}
  />
)}
```

## Проблема 2: Игры с ИИ перезагружают страницу
**Симптом**: При нажатии "Играть с ИИ" сервер обновляется, страница перезагружается
**Причина**: Создание игры вызывает синхронизацию с сервером
**Решение**: Игры с ИИ должны быть локальными

**Код для исправления**:
```tsx
// В ai-games.tsx использовать локальное состояние
const [localGame, setLocalGame] = useState<{
  id: string;
  kind: LiveKind;
  level: AILevel;
  board: string;
  turn: number;
} | null>(null);

const startGame = () => {
  setLocalGame({
    id: 'local-' + Date.now(),
    kind,
    level,
    board: initBoard(kind),
    turn: 0
  });
};

// AI ход локально
const makeAIMove = () => {
  if (!localGame || localGame.turn !== 1) return;
  const move = calculateAIMove(localGame.kind, localGame.board, 1, localGame.level);
  if (move) {
    const result = applyMove(localGame.kind, localGame.board, move);
    if (result) {
      setLocalGame({
        ...localGame,
        board: result.board,
        turn: 0
      });
    }
  }
};
```

## Проблема 3: Версия сервера постоянно растёт
**Симптом**: Версия растёт с каждым изменением настроек (v155, v178)
**Причина**: Каждое изменение настроек вызывает синхронизацию
**Решение**: Debounce для сохранения настроек

**Код для исправления**:
```tsx
// В store.tsx добавить debounce
const settingsTimeout = useRef<NodeJS.Timeout>();

const setSettingsDebounced = (patch: Partial<Settings>) => {
  if (settingsTimeout.current) clearTimeout(settingsTimeout.current);
  settingsTimeout.current = setTimeout(() => {
    up((d) => {
      Object.assign(d.settings, patch);
      audit(d, who(), "Настройки", "Изменены настройки");
    });
  }, 2000); // 2 секунды задержка
};
```

## Проблема 4: Чаты вылетают после сообщений
**Симптом**: После отправки сообщения происходит перезагрузка
**Причина**: Синхронизация после каждого сообщения
**Решение**: Оптимистичное обновление UI

**Код для исправления**:
```tsx
// В misc.tsx оптимистичное обновление
const sendMessage = (text: string) => {
  // Добавляем сообщение локально сразу
  setMessages(prev => [...prev, {
    id: 'temp-' + Date.now(),
    text,
    userId: me.id,
    ts: new Date().toISOString(),
    file: null
  }]);
  
  // Отправка на сервер
  store.sendMessage(threadId, text, null);
};
```

## Проблема 5: Автозапуск не сохраняется
**Симптом**: Тумблер автозапуска не работает
**Причина**: Нет API эндпоинта для автозапуска
**Решение**: Добавить API эндпоинт

**Код для исправления в launcher.py**:
```python
if path == "/api/autostart":
    if not self._token_ok():
        return self._send(403, {"error": "token required"})
    on = bool(body.get("on", True))
    SETTINGS["autostart"] = on
    save_settings(SETTINGS)
    set_autostart(on)
    reqlog("POST", "/api/autostart", f"autostart={'on' if on else 'off'}")
    return self._send(200, {"ok": True, "autostart": on})
```

## Проблема 6: Загрузка файлов по одному
**Симптом**: Можно загрузить только по одному файлу вместо 10
**Причина**: Неправильный обработчик файлов
**Решение**: Исправить обработчик

**Код для исправления в feed.tsx**:
```tsx
const handleFiles = async (files: FileList) => {
  const attachments: Attachment[] = [];
  const maxFiles = Math.min(files.length, 10);
  
  for (let i = 0; i < maxFiles; i++) {
    try {
      const att = await uploadAttachment(files[i]);
      attachments.push(att);
    } catch (e) {
      toast(`Ошибка загрузки: ${files[i].name}`, "bad");
    }
  }
  
  setFiles(prev => [...prev, ...attachments]);
};
```

## Проблема 7: Рисунки не отображаются на стене
**Симптом**: Нарисованные рисунки не сохраняются
**Причина**: Canvas не конвертируется в dataURL
**Решение**: Исправить конвертацию

**Код для исправления в feed.tsx**:
```tsx
const saveDrawing = () => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  
  const dataUrl = canvas.toDataURL('image/png');
  setImg(dataUrl);
  setDraw(false);
  toast("Рисунок добавлен", "ok");
};
```

## Проблема 8: Стена постоянно обновляется
**Симптом**: Стена перезагружается каждые несколько секунд
**Причина**: Синхронизация каждую секунду
**Решение**: Увеличить интервал синхронизации

**Код для исправления в store.tsx**:
```tsx
// Синхронизация каждые 5 секунд вместо 1
const syncInterval = setInterval(sync, 5000);
```

## Проблема 9: Онлайн игры не работают
**Симптом**: Баги в крестиках-ноликах
**Причина**: Неправильная проверка ходов
**Решение**: Исправить логику игры

**Код для исправления в games.ts**:
```tsx
// Исправить проверку цвета фигур в шахматах
if (target !== "." && (target === target.toUpperCase()) === isWhite) return null;
```

## Проблема 10: Telegram бот 400 ошибка
**Симптом**: Ошибка 400 при отправке в Telegram
**Причина**: Неправильный формат запроса
**Решение**: Исправить отправку

**Код для исправления в launcher.py**:
```python
if path == "/api/telegram":
    text = body.get("text", "")
    token = SETTINGS.get("tgToken", "")
    chat = SETTINGS.get("tgChat", "")
    
    if not token or not chat:
        return self._send(400, {"error": "telegram not configured"})
    
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=json.dumps({"chat_id": chat, "text": text}).encode(),
        headers={"Content-Type": "application/json"}
    )
    urllib.request.urlopen(req, timeout=10)
    return self._send(200, {"ok": True})
```

## Проблема 11: Бот не понимает команды с маркерами
**Симптом**: Команды с "•" не распознаются
**Причина**: Маркеры не удаляются перед парсингом
**Решение**: Очистить текст от маркеров

**Код для исправления в store.tsx**:
```tsx
const cleanText = text.replace(/^[\s•\-\*]+/, "").trim();
const parts = cleanText.split(/\s+/);
const cmd = (parts[0] || "").toLowerCase();
```

## 📋 Чек-лист исправлений

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

## 🚀 Быстрое восстановление

```bash
# Запустить скрипт восстановления
chmod +x restore.sh
./restore.sh

# Запустить проект
npm run dev

# В другом терминале
cd server && python launcher.py
```

## 📞 Поддержка

При возникновении проблем:
- Telegram: @ASV_PROD
- Email: smolyaninovchef@vk.com
- Телефон: +79934894429

---

**Версия**: 3.0  
**Дата**: 2026  
**Статус**: Требуется применение исправлений
