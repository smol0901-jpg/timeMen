import React, { useState } from "react";
import { API_ENDPOINTS } from "../lib/types";
import { I, Tabs, CopyBtn } from "../components/ui";

export default function HelpView() {
  const [tab, setTab] = useState("start");
  return (
    <div className="grid gap-4 max-w-4xl">
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: "start", label: "Быстрый старт", icon: "zap" },
        { id: "super", label: "Суперадмину", icon: "shield" },
        { id: "admin", label: "Админу", icon: "gear" },
        { id: "emp", label: "Сотруднику", icon: "user" },
        { id: "local", label: "Локальный режим", icon: "wifi" },
        { id: "api", label: "API и датчики", icon: "layers" },
      ]} />
      {tab === "start" && <Block icon="zap" title="Запуск за 3 шага" items={[
        "Сервер уже работает, если в шапке горит зелёный индикатор «Сервер · синхронно» — все устройства в Wi-Fi видят одну базу в реальном времени (обновление каждую секунду).",
        "Суперадмин входит под root / root и создаёт админов и сотрудников (раздел «Сотрудники»). Пароль сотрудника задавать не обязательно — он установит его сам в профиле.",
        "Админ строит график («График» → шаблоны 5/2, 2/2, 3/3), публикует его — сотрудники получают уведомление с подсветкой изменений.",
        "Терминал у проходной: в админке «Терминал» в шапке (или вход → «Режим терминала»). Выход из терминала — «Служебный выход» по PIN из настроек.",
        "Сотрудники открывают ссылку сервера на телефоне и ставят её на главный экран (PWA) — пункт «Установить» появится в шапке.",
      ]} />}
      {tab === "super" && <Block icon="shield" title="Инструкция суперадмина" items={[
        "Только вы управляете матрицей прав («Права доступа»): какие модули видят админы и сотрудники на ПК и на телефоне — изменения применяются мгновенно.",
        "Журналы («Журналы») хранят каждое действие: входы, смены паролей, правки графика, цены продукции, отметки. Фильтруйте по типу действия.",
        "Резервный код восстановления пароля суперадмина хранится в зашифрованном виде. Если пароль забыт — на экране входа введите код, пароль вернётся к стандартному, и вы сразу его смените.",
        "Раздел «Настройки»: организация для бланков PDF, норма часов, обед, коэффициент переработки, PIN терминала, режим ИИ-аналитика, подключение Ollama, токен API для датчиков.",
        "Резервные копии: сервер делает их автоматически раз в неделю (server/data/backups), плюс кнопка «Копия сейчас» в трее. Полная копия JSON — в «Данные / Excel».",
      ]} />}
      {tab === "admin" && <Block icon="gear" title="Инструкция администратора" items={[
        "Сотрудники: создать карточку (логин, ФИО, цех, должность, тип оплаты: часы / смены / сделка), отключить, но не удалить следом — история сохраняется бессрочно.",
        "График: клик по ячейке ставит смену (Я — день 08–17, Н — ночь 20–08, В, О, Б). Шаблоны заполняют месяц сразу. Впишите комментарий к изменениям — сотрудник увидит причину вместе с уведомлением.",
        "Заявки: отпуска, замены, доп. смены и подтверждения внеплановых смен. Одобрение отпуска само ставит «О» в график.",
        "Отчёты: ежедневный, еженедельный, ежемесячный (кто был и сколько часов + заявки), сводный табель с оплатой, отчёт по выработке — в Excel или PDF-бланк с подписями и печатью.",
        "ФОТ («Цеха · Должности · ФОТ»): фонд по месяцам/кварталам/годам, разбивка по должностям, прогноз и риски.",
        "Обвалка: в «Справочнике продукции» правьте позиции и цены за кг — сразу влияет на расчёт сдельщиков. Скрывайте позиции вместо удаления, чтобы не ломать историю.",
        "Напоминания: создавайте для всех, цеха, должности или конкретного человека с датой — придут уведомления.",
        "Группы и чаты: «Сообщения» → «Группа» — обсуждение цеха; личные диалоги с сотрудниками — туда же.",
      ]} />}
      {tab === "emp" && <Block icon="user" title="Инструкция сотрудника" items={[
        "Отметки: «Моя смена» → «Начать смену» / «Закончить смену», либо одним касанием на терминале у проходной.",
        "Забыли закрыться? Система закроет смену по графику (до 04:00 следующего дня) и попросит подтвердить время ухода — зайдите в «Заявки» и укажите время.",
        "Статистика: часы за день, неделю, месяц, год и любой период; переработка, недоработка, опоздания и сумма к выплате. Всё можно выгрузить в Excel.",
        "График: ваш и вашего цеха. Если админ меняет ваши дни — придёт уведомление, изменённые ячейки подсвечены, причина в комментарии.",
        "Заявки: отпуск, поменяться сменой с коллегой, попросить дополнительный день — всё через «Заявки».",
        "Выработка (сдельные цеха): записывайте объёмы в «Выработке» — позиции из памяти выбираются одним нажатием, сумма считается сразу.",
        "Стена и чаты: новости, фото, файлы; группы цехов и личная переписка с администрацией — в «Сообщениях».",
        "Профиль: поставьте фото, короткую информацию о себе и обязательно свой пароль — вход без пароля означает, что отметиться может кто угодно.",
        "Перерыв: «Игры и утилиты» — змейка, шашки, калькулятор, таймер, секундомер, камера.",
      ]} />}
      {tab === "local" && (
        <div className="grid gap-4">
          <div className="card !border-warn/60 p-4 flex items-start gap-3">
            <span className="w-10 h-10 rounded-xl bg-warn-soft text-warn grid place-items-center shrink-0"><I n="warn" size={19} /></span>
            <div>
              <b className="text-sm block">Сейчас включён локальный режим</b>
              <p className="text-[13px] text-mute font-bold mt-1 leading-relaxed">Индикатор в шапке жёлтый — LAN-сервер недоступен, и данные хранятся только на этом устройстве. Как только сервер поднимется, индикатор станет зелёным и база синхронизируется автоматически.</p>
            </div>
          </div>
          <Block icon="wifi" title="Как запустить сервер" items={[
            "На компьютере-сервере (Windows) запустите server/install.bat один раз — установщик сам проверит Python, поставит зависимости и создаст ярлык «СменаЛАН — сервер» на рабочем столе.",
            "Двойной клик по ярлыку — сервер живёт в трее и работает круглосуточно. Правый клик по иконке: ссылка для сотрудников (копируется в один клик), QR-код, настройки порта, резервная копия.",
            "Если брандмауэр спросит разрешение — разрешите для частных сетей, иначе телефоны не увидят сервер.",
            "Linux/macOS: cd server && ./install.sh, затем python3 launcher.py. Флаг --console — запуск без трея.",
            "База хранится в server/data (SQLite, место не ограничено), фотографии и вложения — в server/data/files, резервные копии — в server/data/backups (еженедельно автоматически).",
            "Если сервер не нужен вовсе — система остаётся работоспособной локально на каждом устройстве, но без общей базы в реальном времени.",
          ]} />
        </div>
      )}
      {tab === "api" && (
        <div className="grid gap-4">
          <div className="card p-5">
            <h3 className="font-display text-sm font-semibold mb-2">Открытые эндпоинты для датчиков и интеграций</h3>
            <p className="text-[13px] text-mute font-bold leading-relaxed mb-3">
              Базовый адрес — текущий хост (см. строку браузера). Запись защищена токеном, если он задан в Настройках («API-токен»): передавайте заголовок <code className="bg-paper px-1.5 py-0.5 rounded font-mono text-[12px]">X-API-Token</code> или <code className="bg-paper px-1.5 py-0.5 rounded font-mono text-[12px]">?token=…</code>.
            </p>
            <div className="grid gap-1.5">
              {API_ENDPOINTS.map((e) => (
                <div key={e.path} className="flex items-center gap-3 border border-line rounded-lg px-3 py-2 flex-wrap">
                  <span className={`badge ${e.method === "GET" ? "bg-night-soft text-night" : "bg-ok-soft text-ok"} w-14 justify-center`}>{e.method}</span>
                  <code className="font-mono text-[12.5px] font-bold">{e.path}</code>
                  <span className="text-[12px] text-mute font-bold flex-1 min-w-[180px]">{e.desc}</span>
                  {e.auth && <span className="badge bg-warn-soft text-warn"><I n="key" size={11} />токен</span>}
                </div>
              ))}
            </div>
          </div>
          <div className="card p-5">
            <h3 className="font-display text-sm font-semibold mb-3">Пример: датчик температуры цеха</h3>
            <pre className="bg-steel-900 text-paper rounded-xl p-4 text-[12px] font-mono overflow-x-auto dark-scroll">{`# раз в минуту отправлять показание:
curl -X POST http://192.168.1.10:8080/api/sensors \\
  -H "Content-Type: application/json" \\
  -d '{"name":"temp_myasnoy","value":4.2,"unit":"°C"}'

# последнее значение:
curl "http://192.168.1.10:8080/api/sensors/latest?name=temp_myasnoy"

# кто сейчас на смене:
curl http://192.168.1.10:8080/api/today`}</pre>
            <div className="mt-3"><CopyBtn text={`curl -X POST http://${window.location.host}/api/sensors -H "Content-Type: application/json" -d '{"name":"temp","value":21.5,"unit":"°C"}'`} label="Скопировать curl" /></div>
          </div>
        </div>
      )}
    </div>
  );
}

function Block({ icon, title, items }: { icon: string; title: string; items: string[] }) {
  return (
    <div className="card p-6">
      <h3 className="font-display text-base font-semibold flex items-center gap-2.5 mb-4">
        <span className="w-9 h-9 rounded-xl bg-accent-soft text-accent-deep grid place-items-center"><I n={icon} size={18} /></span>{title}
      </h3>
      <ol className="grid gap-3">
        {items.map((t, i) => (
          <li key={i} className="flex gap-3 text-[13.5px] leading-relaxed font-semibold text-ink/90">
            <span className="shrink-0 w-6 h-6 rounded-full bg-paper border border-line grid place-items-center text-[11px] font-extrabold text-mute">{i + 1}</span>
            {t}
          </li>
        ))}
      </ol>
    </div>
  );
}
