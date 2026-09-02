import React, { useMemo, useState } from "react";
import { useStore, summarizeAll, workedOn, wsName } from "../lib/store";
import { todayKey, addDaysKey, monthStart, monthEnd, monthTitle, fmtMoney, rangeKeys, hDec } from "../lib/time";
import { I, Seg, StatTile, useToast, Field, Toggle, Empty } from "../components/ui";

type Insight = { icon: string; tone: "ok" | "warn" | "bad" | "night" | "accent"; title: string; text: string };

export default function AIView() {
  const { db, setSettings, askOllama } = useStore();
  const { toast } = useToast();
  const s = db.settings;
  const [ans, setAns] = useState("");
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState({ ollamaOn: s.ollamaOn, ollamaUrl: s.ollamaUrl, ollamaModel: s.ollamaModel });

  const insights = useMemo(() => buildInsights(), [db]);
  const mode = s.aiMode;
  const shown = mode === "off" ? [] : mode === "light" ? insights.slice(0, 3) : insights;

  function buildInsights(): Insight[] {
    const out: Insight[] = [];
    const tk = todayKey();
    const mf = monthStart(tk), mt = monthEnd(tk);
    const rows = summarizeAll(db, mf, mt);
    const plan = rows.reduce((x, r) => x + r.planMin, 0);
    const fact = rows.reduce((x, r) => x + r.factMin, 0);
    const att = plan > 0 ? (fact / plan) * 100 : 100;
    const fot = rows.reduce((x, r) => x + r.salary, 0);

    out.push({
      icon: att >= 92 ? "check" : att >= 75 ? "warn" : "x", tone: att >= 92 ? "ok" : att >= 75 ? "warn" : "bad",
      title: `Посещаемость месяца: ${att.toFixed(0)}%`,
      text: `Факт ${hDec(fact)} ч при плане ${hDec(plan)} ч (${monthTitle(mf)}). ${att < 85 ? "Ниже нормы — проверьте больничные и пустые ячейки графика." : "В пределах нормы."}`,
    });

    const late = rows.filter((r) => r.late > 0).sort((a, b) => b.late - a.late);
    out.push({
      icon: "history", tone: late.length ? "warn" : "ok",
      title: late.length ? `Опоздания: ${late.length} чел.` : "Опозданий нет",
      text: late.length ? `Чаще других: ${late.slice(0, 3).map((r) => `${r.user.name.split(" ")[0]} (${r.late})`).join(", ")}.` : "Дисциплина в норме за текущий месяц.",
    });

    const last7 = rangeKeys(addDaysKey(tk, -6), tk);
    const prev7 = rangeKeys(addDaysKey(tk, -13), addDaysKey(tk, -7));
    const kg = (keys: string[]) => db.production.filter((r) => keys.includes(r.date)).reduce((x, r) => x + r.qty, 0);
    const k1 = kg(last7), k0 = kg(prev7);
    if (k1 > 0 || k0 > 0) {
      const d = k0 > 0 ? ((k1 - k0) / k0) * 100 : 100;
      out.push({
        icon: "box", tone: d >= 0 ? "ok" : "bad",
        title: `Обвалка: ${Math.round(k1 * 10) / 10} кг за неделю (${d >= 0 ? "+" : ""}${d.toFixed(0)}%)`,
        text: d < -15
          ? "Объём упал более чем на 15% к прошлой неделе — стоит проверить состав смен и простои линии."
          : d > 15 ? "Рост объёма — проследите за переработками и усталостью смен." : "Динамика стабильная, неделя к неделе.",
      });
    }

    const byUserProd = new Map<string, number>();
    db.production.forEach((r) => byUserProd.set(r.userId, (byUserProd.get(r.userId) || 0) + r.qty));
    const top = [...byUserProd.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) {
      const u = db.users.find((x) => x.id === top[0]);
      const hours = rangeKeys(addDaysKey(tk, -13), tk).reduce((x2, k) => x2 + workedOn(db, top[0], k), 0) / 60;
      out.push({
        icon: "flame", tone: "accent",
        title: `Лучший по выработке: ${u?.name || "—"}`,
        text: `${Math.round(top[1] * 10) / 10} кг за 2 недели${hours > 0 ? `, скорость ≈ ${(top[1] / hours).toFixed(1)} кг/ч` : ""}. Используйте как ориентир нормы.`,
      });
    }

    out.push({
      icon: "coin", tone: "night",
      title: `ФОТ ${monthTitle(mf)}: ${fmtMoney(fot)}`,
      text: `Средний дневной фонд ${fmtMoney(fot / Math.max(1, Number(tk.slice(8, 10))))}. Прогноз на полный месяц: ${fmtMoney(fot / Math.max(1, Number(tk.slice(8, 10))) * new Date(Number(tk.slice(0, 4)), Number(tk.slice(5, 7)), 0).getDate())}.`,
    });

    if (mode === "adv") {
      const lateDays = new Set(db.punches.filter((p) => {
        const cell = db.schedule.find((c) => c.userId === p.userId && c.date === p.date);
        return cell && (cell.type === "day" || cell.type === "night") && p.tin > 485;
      }).map((p) => p.userId + p.date));
      const prodLate = db.production.filter((r) => lateDays.has(r.userId + r.date)).reduce((x, r) => x + r.qty, 0);
      const prodAll = db.production.reduce((x, r) => x + r.qty, 0);
      out.push({
        icon: "brain", tone: "warn",
        title: "Связь опозданий и выработки",
        text: prodAll > 0
          ? `В дни с опозданиями сделано ${Math.round(prodLate)} из ${Math.round(prodAll)} кг (${((prodLate / prodAll) * 100).toFixed(0)}%). ${prodLate / prodAll < 0.3 && prodAll > 10 ? "Опоздания заметно снижают объём — имеет смысл разобрать причины." : "Существенной потери объёма не видно."}`
          : "Недостаточно данных о выработке для корреляции.",
      });
      const next7 = rangeKeys(addDaysKey(tk, 1), addDaysKey(tk, 7));
      const uncovered = next7.filter((k) => !db.schedule.some((c) => c.date === k && (c.type === "day" || c.type === "night") && db.users.find((u) => u.id === c.userId)?.role === "employee"));
      out.push({
        icon: "cal", tone: uncovered.length ? "bad" : "ok",
        title: uncovered.length ? `График: ${uncovered.length} дн. без людей` : "График на неделю покрыт",
        text: uncovered.length ? `Дни без запланированных смен: ${uncovered.map((k) => k.slice(8)).join(", ")}. Назначьте сотрудников, иначе план встанет.` : "На ближайшие 7 дней смены назначены.",
      });
    }
    return out;
  }

  return (
    <div className="grid gap-4 max-w-5xl">
      <div className="card p-4 flex items-center gap-3 flex-wrap">
        <span className="w-10 h-10 rounded-xl bg-accent-soft text-accent-deep grid place-items-center"><I n="brain" size={20} /></span>
        <div className="flex-1 min-w-[200px]">
          <b className="text-sm block font-display">Режим встроенного аналитика</b>
          <span className="text-[12px] text-mute font-bold">Лайт — минимум нагрузки · Стандарт — по умолчанию · Продвинутый — корреляции и прогнозы · Выкл — отключить</span>
        </div>
        <Seg opts={[
          { v: "off", label: "Выкл" }, { v: "light", label: "Лайт" }, { v: "std", label: "Стандарт" }, { v: "adv", label: "Продвинутый" },
        ]} val={mode} onChange={(v) => { setSettings({ aiMode: v }); toast(`ИИ-аналитик: ${v === "off" ? "выключен" : v}`, "ok"); }} />
      </div>

      {mode === "off" ? (
        <div className="card"><Empty icon="brain" title="Аналитик выключен" text="Включите стандартный режим — выводы по посещаемости, выработке, ФОТ и рискам строятся автоматически из базы и журналов, без нагрузки на сервер." /></div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {shown.map((x, i) => (
            <div key={i} className={`card p-4 anim-rise border-l-4 ${x.tone === "ok" ? "!border-l-ok" : x.tone === "bad" ? "!border-l-bad" : x.tone === "warn" ? "!border-l-warn" : x.tone === "night" ? "!border-l-night" : "!border-l-accent"}`} style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-center gap-2 mb-1.5">
                <I n={x.icon} size={16} className={x.tone === "ok" ? "text-ok" : x.tone === "bad" ? "text-bad" : x.tone === "warn" ? "text-warn" : x.tone === "night" ? "text-night" : "text-accent-deep"} />
                <b className="text-[13px]">{x.title}</b>
              </div>
              <p className="text-[12.5px] text-mute font-semibold leading-relaxed">{x.text}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="w-10 h-10 rounded-xl bg-night-soft text-night grid place-items-center"><I n="bot" size={20} /></span>
          <div className="flex-1 min-w-[220px]">
            <b className="text-sm block font-display">Локальная нейросеть (Ollama)</b>
            <span className="text-[12px] text-mute font-bold">По умолчанию отключена. Подключается к вашей локальной модели: анализ, прогнозы, предложения по графику, ответы по данным.</span>
          </div>
        </div>
        <div className="grid sm:grid-cols-[auto_1fr_1fr_auto] gap-3 mt-4 items-end">
          <div className="pb-1"><Toggle checked={local.ollamaOn} onChange={(v) => setLocal({ ...local, ollamaOn: v })} label="Включена" /></div>
          <Field label="Адрес Ollama"><input className="input font-mono !text-[13px]" value={local.ollamaUrl} onChange={(e) => setLocal({ ...local, ollamaUrl: e.target.value })} placeholder="http://localhost:11434" /></Field>
          <Field label="Модель"><input className="input font-mono !text-[13px]" value={local.ollamaModel} onChange={(e) => setLocal({ ...local, ollamaModel: e.target.value })} placeholder="llama3" /></Field>
          <button className="btn btn-dark" onClick={() => { setSettings(local); toast("Настройки нейросети сохранены", "ok"); }}><I n="check" size={15} />Сохранить</button>
        </div>
        {s.ollamaOn && (
          <div className="mt-4 border-t border-line pt-4">
            <div className="flex gap-2 flex-wrap">
              <button className="btn btn-pri btn-sm" disabled={busy} onClick={() => run("Проанализируй данные: посещаемость, выработку и ФОТ. Дай 5 кратких выводов и 3 рекомендации на русском.")}>
                <I n="brain" size={14} />{busy ? "Нейросеть думает…" : "Полный анализ"}
              </button>
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run("Предложи график смен на следующую неделю: кому поставить день, кому ночь, кому выходной, чтобы покрыть норму часов.")}>
                <I n="cal" size={14} />Предложить график
              </button>
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run("Почему могла упасть выработка обвалки? Проанализируй объёмы по дням и сотрудникам.")}>
                <I n="box" size={14} />Разбор выработки
              </button>
            </div>
            {ans && (
              <pre className="mt-4 bg-steel-900 text-paper rounded-xl p-4 text-[12.5px] font-sans font-semibold whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto dark-scroll">{ans}</pre>
            )}
          </div>
        )}
      </div>
    </div>
  );

  async function run(q: string) {
    setBusy(true); setAns("");
    try {
      const rows = summarizeAll(db, monthStart(todayKey()), monthEnd(todayKey()));
      const summary = rows.map((r) => `${r.user.name} (${wsName(db, r.user.workshopId)}): план ${hDec(r.planMin)}ч, факт ${hDec(r.factMin)}ч, перераб ${hDec(r.otMin)}ч, опозд ${r.late}, выплата ${Math.round(r.salary)}р`).join("\n");
      const prod = db.production.slice(0, 60).map((r) => {
        const p = db.products.find((x) => x.id === r.productId);
        const u = db.users.find((x) => x.id === r.userId);
        return `${r.date} ${u?.name || "?"} ${p?.name || "?"} ${r.qty}${p?.unit || ""}`;
      }).join("\n");
      const resp = await askOllama(`Ты — аналитик системы учёта рабочего времени «СменаЛАН» на производстве. Данные за месяц:\n${summary}\n\nВыработка (последние записи):\n${prod}\n\nЗадание: ${q}`);
      setAns(resp);
    } catch (e) {
      setAns(`Не удалось связаться с Ollama.\n\nПроверьте: 1) модель запущена: ollama serve\n2) модель скачана: ollama pull ${s.ollamaModel}\n3) адрес: ${s.ollamaUrl}`);
      toast("Ollama недоступна — детали в ответе", "bad");
    }
    setBusy(false);
  }
}
