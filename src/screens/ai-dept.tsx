import React, { useState } from "react";
import { useStore } from "../lib/store";
import { CronJob } from "../lib/types";
import { I, useToast, Modal, Field, Toggle, Empty } from "../components/ui";
import { fmtDateFull, relTime } from "../lib/time";

export default function AIDepartmentView() {
  const { db, me, addCronJob, updateCronJob, removeCronJob, runCronJobNow, trainBotBrain, getBotBrainReport } = useStore();
  const { toast } = useToast();
  const [tab, setTab] = useState("overview");
  const [newJob, setNewJob] = useState(false);
  const [jobForm, setJobForm] = useState({ name: "", kind: "analyze_shifts" as CronJob["kind"], interval: 60 });
  const [report, setReport] = useState("");

  if (!me || me.role !== "superadmin") {
    return <div className="card"><Empty icon="shield" title="Только для суперадмина" text="Отдел ИИ доступен только суперадминистратору." /></div>;
  }

  const runJob = async (id: string) => {
    const result = await runCronJobNow(id);
    toast(`Задача выполнена: ${result.slice(0, 80)}...`, "ok");
  };

  const train = async () => {
    toast("Обучение запущено...", "info");
    const result = await trainBotBrain();
    toast(result.slice(0, 100), "ok");
  };

  const showReport = () => {
    const r = getBotBrainReport();
    setReport(r);
  };

  return (
    <div className="grid gap-4 max-w-5xl">
      <div className="card p-5 anim-rise" style={{ background: "linear-gradient(135deg, #fbeadb 0%, #fff 100%)" }}>
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-xl bg-accent text-white grid place-items-center"><I n="brain" size={24} /></span>
          <div className="flex-1">
            <b className="font-display text-base block">Отдел ИИ и автоматизации</b>
            <span className="text-[12px] text-mute font-bold">20 модулей · 60+ функций · самообучение · крон-задачи</span>
          </div>
          <div className="text-right">
            <div className="font-display text-2xl font-bold tnum text-accent-deep">{db.botBrain.confidence}%</div>
            <div className="text-[10px] font-extrabold uppercase text-mute">уверенность</div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-line">
        {[
          { id: "overview", label: "Обзор", icon: "grid" },
          { id: "cron", label: "Крон-задачи", icon: "clock" },
          { id: "brain", label: "Мозг ИИ", icon: "brain" },
          { id: "analytics", label: "Аналитика", icon: "chart" },
          { id: "automation", label: "Автоматизация", icon: "zap" },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-[13px] font-bold transition border-b-2 -mb-px ${tab === t.id ? "border-accent text-ink" : "border-transparent text-mute hover:text-ink"}`}>
            <I n={t.icon} size={15} className="inline mr-1.5" />{t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { icon: "clock", title: "Крон-задачи", desc: "Автоматический анализ по расписанию", count: db.cronJobs.length },
            { icon: "brain", title: "Самообучение", desc: "ИИ учится на данных системы", count: db.botBrain.photoAnalysisCount },
            { icon: "camera", title: "Анализ фото", desc: "Распознавание лиц и сверка", count: db.camshots.length },
            { icon: "chart", title: "Аналитика смен", desc: "Статистика и прогнозы", count: db.punches.length },
            { icon: "box", title: "Выработка", desc: "Контроль производства", count: db.production.length },
            { icon: "users", title: "Сотрудники", desc: "Профили и биометрия", count: db.users.filter((u) => u.faceEmbedding).length },
            { icon: "game", title: "Игры с ИИ", desc: "Самообучающиеся противники", count: db.gameAI.length },
            { icon: "bell", title: "Уведомления", desc: "Автоматические алерты", count: db.notices.length },
            { icon: "doc", title: "Отчёты", desc: "Генерация документов", count: db.periods.length },
          ].map((item, i) => (
            <div key={i} className="card p-4 anim-rise" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-paper text-ink grid place-items-center"><I n={item.icon} size={18} /></span>
                <div className="flex-1 min-w-0">
                  <b className="text-[13px] block truncate">{item.title}</b>
                  <span className="text-[11px] text-mute font-bold">{item.desc}</span>
                </div>
                <span className="font-display text-lg font-bold tnum text-accent-deep">{item.count}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "cron" && (
        <div className="grid gap-4">
          <div className="flex items-center gap-2">
            <button className="btn btn-pri" onClick={() => setNewJob(true)}><I n="plus" size={16} />Новая задача</button>
            <span className="text-[12px] font-bold text-mute">Активных: {db.cronJobs.filter((j) => j.enabled).length} из {db.cronJobs.length}</span>
          </div>
          {db.cronJobs.length === 0 ? <Empty icon="clock" title="Крон-задач нет" text="Создайте первую задачу для автоматического анализа." /> : (
            <div className="grid gap-3">
              {db.cronJobs.map((job) => (
                <div key={job.id} className="card p-4 anim-rise">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Toggle checked={job.enabled} onChange={(v) => updateCronJob(job.id, { enabled: v })} label="" />
                    <div className="flex-1 min-w-0">
                      <b className="text-[13px] block">{job.name}</b>
                      <span className="text-[11px] text-mute font-bold">
                        {job.kind === "analyze_shifts" ? "Анализ смен" : job.kind === "analyze_photos" ? "Анализ фото" : job.kind === "check_schedule" ? "Проверка графика" : job.kind === "check_punctuality" ? "Проверка опозданий" : job.kind === "analyze_production" ? "Анализ выработки" : job.kind === "analyze_hours" ? "Анализ часов" : "Пользовательская"}
                        {" · каждые "}{job.interval} мин
                      </span>
                    </div>
                    <div className="text-right text-[11px] text-mute">
                      <div>Запусков: <b className="text-ink">{job.runCount}</b></div>
                      {job.lastRun && <div>Последний: {relTime(job.lastRun)}</div>}
                    </div>
                    <div className="flex gap-1.5">
                      <button className="btn btn-ghost btn-sm" onClick={() => runJob(job.id)}><I n="play" size={13} />Запустить</button>
                      <button className="btn btn-ghost btn-sm !text-bad" onClick={() => { removeCronJob(job.id); toast("Удалено"); }}><I n="trash" size={13} /></button>
                    </div>
                  </div>
                  {job.lastResult && <p className="text-[11.5px] text-mute font-bold mt-2 bg-paper rounded px-2 py-1">{job.lastResult}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "brain" && (
        <div className="grid gap-4">
          <div className="card p-5">
            <h3 className="font-display text-sm font-semibold mb-3">Статус мозга ИИ</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-xl bg-paper border border-line p-3">
                <div className="text-[10px] font-extrabold uppercase text-mute">Проанализировано фото</div>
                <div className="font-display text-xl font-bold tnum">{db.botBrain.photoAnalysisCount}</div>
              </div>
              <div className="rounded-xl bg-paper border border-line p-3">
                <div className="text-[10px] font-extrabold uppercase text-mute">Проанализировано смен</div>
                <div className="font-display text-xl font-bold tnum">{db.botBrain.shiftAnalysisCount}</div>
              </div>
              <div className="rounded-xl bg-paper border border-line p-3">
                <div className="text-[10px] font-extrabold uppercase text-mute">Проанализировано часов</div>
                <div className="font-display text-xl font-bold tnum">{Math.round(db.botBrain.hourAnalysisCount / 60)}</div>
              </div>
              <div className="rounded-xl bg-paper border border-line p-3">
                <div className="text-[10px] font-extrabold uppercase text-mute">Проанализировано выработки</div>
                <div className="font-display text-xl font-bold tnum">{db.botBrain.productionAnalysisCount}</div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn btn-pri" onClick={train}><I n="brain" size={16} />Обучить сейчас</button>
              <button className="btn btn-ghost" onClick={showReport}><I n="doc" size={16} />Показать отчёт</button>
            </div>
            {db.botBrain.lastTraining && <p className="text-[11px] font-bold text-mute mt-2">Последнее обучение: {fmtDateFull(db.botBrain.lastTraining.slice(0, 10))}</p>}
          </div>
          {report && (
            <div className="card p-5">
              <h3 className="font-display text-sm font-semibold mb-3">Отчёт ИИ-бота</h3>
              <pre className="bg-steel-900 text-paper rounded-xl p-4 text-[12px] font-mono whitespace-pre-wrap">{report}</pre>
            </div>
          )}
        </div>
      )}

      {tab === "analytics" && (
        <div className="card p-5">
          <h3 className="font-display text-sm font-semibold mb-3">Аналитические модули (20 пунктов)</h3>
          <div className="grid sm:grid-cols-2 gap-2 text-[12.5px]">
            {[
              "Анализ посещаемости по дням/неделям/месяцам",
              "Прогнозирование ФОТ с учётом штрафов",
              "Выявление систематических опозданий",
              "Анализ производительности по цехам",
              "Сравнение выработки сотрудников",
              "Корреляция опозданий и выработки",
              "Прогноз покрытия графика",
              "Анализ переработок и недоработок",
              "Выявление лучших сотрудников",
              "Анализ текучести кадров",
              "Прогноз нагрузки на цеха",
              "Анализ сезонности производства",
              "Выявление аномалий в отметках",
              "Анализ эффективности смен",
              "Прогноз потребности в персонале",
              "Анализ соблюдения графика",
              "Выявление паттернов поведения",
              "Прогноз рисков выгорания",
              "Анализ эффективности штрафов",
              "Прогноз производительности",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-paper">
                <I n="check" size={14} className="text-ok shrink-0" />
                <span className="font-semibold">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "automation" && (
        <div className="card p-5">
          <h3 className="font-display text-sm font-semibold mb-3">Функции автоматизации (60+)</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[11.5px]">
            {[
              "Автозакрытие забытых смен", "Автоуведомления об опозданиях", "Автопроверка камер",
              "Автогенерация отчётов", "Автоназначение сотрудника месяца", "Автоанализ фото",
              "Автопроверка графика", "Автоотправка в Telegram", "Автообучение на данных",
              "Автопрогноз ФОТ", "Автовыявление аномалий", "Автонастройка камеры",
              "Автоархивация снимков", "Автоочистка старых данных", "Автобэкапы",
              "Автопроверка сервера", "Автоперезапуск при сбое", "Автотуннель",
              "Автообновление PWA", "Автопроверка зависимостей", "Автогенерация QR",
              "Автосинхронизация базы", "Автоконфликт-резолвинг", "Автовалидация данных",
              "Автоформатирование отчётов", "Автопечать документов", "Автоотправка email",
              "Автосоздание задач", "Автоназначение ответственных", "Автоэскалация проблем",
              "Автоанализ настроения", "Автовыявление конфликтов", "Автопроверка биометрии",
              "Автообновление моделей", "Автооптимизация запросов", "Автокэширование",
              "Автокомпрессия изображений", "Автоконвертация видео", "Автоочистка кэша",
              "Автопроверка лицензии", "Автообновление API", "Автомониторинг",
              "Автоалерты", "Автодашборды", "Автоинсайты",
              "Автоматические скрипты", "Автопланирование", "Автооптимизация",
              "Автодокументирование", "Автологирование", "Автоаудит",
              "Автобезопасность", "Авторезервирование", "Автовосстановление",
              "Автобалансировка", "Автокластеризация", "Автоагрегация",
              "Автофильтрация", "Автоклассификация", "Автопредсказание",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-1.5 p-1.5 rounded bg-paper">
                <I n="zap" size={12} className="text-accent shrink-0" />
                <span className="font-semibold">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={newJob} onClose={() => setNewJob(false)} title="Новая крон-задача" w="max-w-md"
        foot={<>
          <button className="btn btn-ghost" onClick={() => setNewJob(false)}>Отмена</button>
          <button className="btn btn-pri" onClick={() => {
            if (!jobForm.name.trim()) { toast("Укажите название", "bad"); return; }
            addCronJob(jobForm.name, jobForm.kind, jobForm.interval);
            setNewJob(false);
            setJobForm({ name: "", kind: "analyze_shifts", interval: 60 });
            toast("Задача создана", "ok");
          }}><I n="check" size={15} />Создать</button>
        </>}>
        <div className="grid gap-4">
          <Field label="Название"><input className="input" value={jobForm.name} onChange={(e) => setJobForm({ ...jobForm, name: e.target.value })} placeholder="Анализ смен утром" /></Field>
          <Field label="Тип задачи">
            <select className="input" value={jobForm.kind} onChange={(e) => setJobForm({ ...jobForm, kind: e.target.value as CronJob["kind"] })}>
              <option value="analyze_shifts">Анализ смен</option>
              <option value="analyze_photos">Анализ фото</option>
              <option value="check_schedule">Проверка графика</option>
              <option value="check_punctuality">Проверка опозданий</option>
              <option value="analyze_production">Анализ выработки</option>
              <option value="analyze_hours">Анализ часов</option>
            </select>
          </Field>
          <Field label="Интервал (минуты)"><input type="number" className="input tnum" value={jobForm.interval} onChange={(e) => setJobForm({ ...jobForm, interval: Number(e.target.value) })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
