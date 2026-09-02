import React, { useState } from "react";
import { useStore, openPunchOf, punchDur } from "../lib/store";
import { User } from "../lib/types";
import { MONTHS, WD_FULL, fmtClock, fmtDurH } from "../lib/time";
import { useNow, Avatar, I, Logo, OnlineDot, useToast, RoleBadge } from "./ui";

export default function Login({ onKiosk }: { onKiosk: () => void }) {
  const { db, login, recoverRoot, online } = useStore();
  const { toast } = useToast();
  const now = useNow();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [rec, setRec] = useState(false);
  const [code, setCode] = useState("");

  const quick: { label: string; u: string; p: string }[] = [
    { label: "root · суперадмин", u: "root", p: "root" },
    { label: "demo · песочница (без пароля)", u: "demo", p: "" },
  ];
  const emps = db.users.filter((x) => x.role === "employee" && x.active && !x.password).slice(0, 4);

  const go = (username: string, password: string) => {
    const r = login(username, password);
    if (r) { setErr(r); toast(r, "bad"); }
  };

  return (
    <div className="min-h-full grid lg:grid-cols-[1.1fr_1fr]">
      <div className="bg-steel-950 text-paper p-6 sm:p-10 flex flex-col relative overflow-hidden">
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full border-[28px] border-steel-800/70" />
        <div className="absolute -right-10 -top-10 w-96 h-96 rounded-full border-[10px] border-accent/25" />
        <div className="flex items-center gap-3">
          <Logo size={46} />
          <div>
            <b className="font-display text-xl tracking-tight block leading-none">СМЕНА<span className="text-accent">ЛАН</span></b>
            <span className="text-[10px] font-extrabold text-steel-400 uppercase tracking-[0.2em]">локальный сервер учёта смен</span>
          </div>
        </div>
        <div className="mt-auto pt-10">
          <div className="font-mono tnum font-semibold text-6xl sm:text-7xl">{fmtClock(now)}</div>
          <div className="text-steel-400 font-bold mt-2 capitalize">{WD_FULL[(now.getDay() + 6) % 7]}, {now.getDate()} {MONTHS[now.getMonth()]}</div>
          <div className="mt-6 grid gap-2 max-w-sm">
            {db.punches.filter((x) => x.tout === null).slice(0, 4).map((x) => {
              const user = db.users.find((y) => y.id === x.userId);
              return (
                <div key={x.id} className="flex items-center gap-3 bg-steel-800/80 border border-steel-700 rounded-xl px-3.5 py-2.5 anim-rise">
                  <Avatar u={user} size={32} />
                  <div className="min-w-0 flex-1">
                    <b className="text-[13px] block truncate">{user?.name}</b>
                    <span className="text-[10.5px] text-steel-400 font-bold uppercase">на смене</span>
                  </div>
                  <span className="font-mono tnum font-bold text-ok text-sm">{fmtDurH(punchDur(x, db.settings.breakMin, true))}</span>
                  <span className="w-2 h-2 rounded-full bg-ok pulse-ok" />
                </div>
              );
            })}
          </div>
          <div className="mt-8 pt-6 border-t border-steel-700 flex items-center justify-between text-[11px] font-bold text-steel-400 flex-wrap gap-2">
            <span className="flex items-center gap-2"><I n="wifi" size={14} />{online ? <>{window.location.protocol}//<b className="text-paper">{window.location.host}</b> · реальное время</> : "локальный режим (без сервера)"}</span>
            <OnlineDot />
          </div>
        </div>
      </div>

      <div className="bg-paper p-6 sm:p-10 flex items-center">
        <div className="w-full max-w-md mx-auto">
          <h1 className="font-display text-2xl font-bold tracking-tight">Вход в систему</h1>
          <p className="text-mute font-bold text-sm mt-1.5">Свой логин выдаёт администратор. Пароль не обязателен — установите его в профиле.</p>
          <form className="mt-6 grid gap-3" onSubmit={(e) => { e.preventDefault(); go(u, p); }}>
            <input className="input !h-12 !text-base font-mono" placeholder="Логин" value={u} onChange={(e) => { setU(e.target.value); setErr(""); }} autoFocus />
            <input className="input !h-12 !text-base font-mono" type="password" placeholder="Пароль (если задан)" value={p} onChange={(e) => { setP(e.target.value); setErr(""); }} />
            {err && <div className="text-[12px] font-bold text-bad flex items-center gap-1.5"><I n="warn" size={14} />{err}</div>}
            <button className="btn btn-pri !h-12 !text-base" type="submit"><I n="in" size={18} />Войти</button>
          </form>

          <div className="mt-5">
            <span className="lbl">Быстрый вход</span>
            <div className="grid gap-1.5">
              {quick.map((q) => (
                <button key={q.u} className="btn btn-ghost justify-start !text-[13px]" onClick={() => { setU(q.u); setP(q.p); go(q.u, q.p); }}>
                  <I n="user" size={15} className="text-mute" />{q.label}
                </button>
              ))}
              {emps.map((x) => (
                <button key={x.id} className="btn btn-ghost justify-start !text-[13px]" onClick={() => { setU(x.username); go(x.username, ""); }}>
                  <Avatar u={x} size={20} />{x.name} · без пароля
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-2">
            <button className="btn btn-dark !h-11" onClick={onKiosk}><I n="desk" size={17} />Режим терминала (киоск у проходной)</button>
            <button className="btn btn-ghost btn-sm self-start" onClick={() => setRec(!rec)}><I n="key" size={13} />Забыт пароль суперадмина</button>
          </div>

          {rec && (
            <div className="mt-3 card p-4 anim-pop">
              <p className="text-[12px] font-bold text-mute leading-relaxed">Введите резервный код восстановления (выдаётся владельцу системы). Пароль суперадмина будет сброшен на стандартный — сразу смените его.</p>
              <div className="flex gap-2 mt-2.5">
                <input className="input font-mono !text-[13px]" type="password" placeholder="Резервный код" value={code} onChange={(e) => setCode(e.target.value)} />
                <button className="btn btn-dark" onClick={() => {
                  if (recoverRoot(code)) { toast("Пароль суперадмина сброшен на стандартный", "ok"); setRec(false); setCode(""); setU("root"); }
                  else toast("Неверный резервный код", "bad");
                }}>Сбросить</button>
              </div>
            </div>
          )}

          <p className="mt-6 text-[11px] font-bold text-mute leading-relaxed">Суперадмин создаёт сотрудников в админке; изначально все входят без пароля и устанавливают его сами. Работа идёт в одной Wi-Fi сети — ссылка для телефонов есть в трее сервера.</p>
        </div>
      </div>
    </div>
  );
}

