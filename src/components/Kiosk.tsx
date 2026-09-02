import React, { useState } from "react";
import { useStore, openPunchOf, punchDur, wsName } from "../lib/store";
import { Avatar, I, Logo, Modal, OnlineDot, useNow, useToast } from "./ui";
import { fmtClock, fmtMin, nowMin, MONTHS, WD_FULL, fmtDurH } from "../lib/time";

export default function Kiosk({ onExit }: { onExit: () => void }) {
  const { db, kioskPunch } = useStore();
  const { toast } = useToast();
  const now = useNow();
  const [flash, setFlash] = useState<{ name: string; dir: "in" | "out"; time: string } | null>(null);
  const [pinFor, setPinFor] = useState<string | null>(null); // userId or 'exit'
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState("");

  const emps = db.users.filter((u) => u.active);
  const free = db.settings.kioskFree;

  const doPunch = (userId: string) => {
    const dir = kioskPunch(userId);
    if (!dir) return;
    const u = db.users.find((x) => x.id === userId)!;
    setFlash({ name: u.name, dir, time: fmtMin(nowMin()) });
    setTimeout(() => setFlash(null), 1700);
  };
  const tap = (userId: string) => {
    const u = db.users.find((x) => x.id === userId)!;
    if (!free && u.password) { setPinFor(userId); setPin(""); setPinErr(""); return; }
    doPunch(userId);
  };

  return (
    <div className="h-full flex flex-col bg-steel-950 text-paper">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-steel-700">
        <Logo size={36} />
        <div>
          <div className="font-display font-bold text-sm leading-none">СМЕНА<span className="text-accent">ЛАН</span> · ТЕРМИНАЛ</div>
          <div className="text-[10px] font-bold text-steel-400 uppercase tracking-widest mt-1">цеховой проход · отметки без оператора</div>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <OnlineDot />
          <button className="btn btn-sm btn-ghost !border-steel-600 !bg-steel-800 !text-steel-200" onClick={() => { setPinFor("exit"); setPin(""); setPinErr(""); }}>
            <I n="lock" size={13} />Служебный выход
          </button>
        </div>
      </div>

      <div className="text-center py-5 sm:py-7 shrink-0">
        <div className="font-mono tnum font-semibold text-6xl sm:text-7xl tracking-tight leading-none">{fmtClock(now)}</div>
        <div className="text-steel-400 font-bold mt-2 capitalize">{WD_FULL[(now.getDay() + 6) % 7]}, {now.getDate()} {MONTHS[now.getMonth()]}</div>
      </div>

      <div className="flex-1 overflow-y-auto dark-scroll px-5 pb-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {emps.map((u) => {
            const open = openPunchOf(db, u.id);
            return (
              <button key={u.id} onClick={() => tap(u.id)}
                className={`relative rounded-2xl border p-4 text-left transition-all duration-150 active:scale-[0.97] cursor-pointer
                  ${open ? "bg-ok/15 border-ok/50 hover:bg-ok/25" : "bg-steel-800 border-steel-700 hover:bg-steel-700 hover:-translate-y-0.5"}`}>
                <div className="flex items-center gap-3">
                  <Avatar u={u} size={44} />
                  <div className="min-w-0">
                    <div className="font-extrabold text-sm leading-tight truncate">{u.name}</div>
                    <div className="text-[11px] text-steel-400 font-bold truncate mt-0.5">{wsName(db, u.workshopId)}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  {open ? (
                    <>
                      <span className="badge bg-ok text-white"><span className="w-1.5 h-1.5 rounded-full bg-white pulse-ok" />на смене</span>
                      <span className="font-mono tnum text-sm font-semibold text-ok">{fmtDurH(punchDur(open, db.settings.breakMin, true))}</span>
                    </>
                  ) : (
                    <>
                      <span className="badge bg-steel-700 text-steel-200">не на смене</span>
                      <span className="text-[11px] font-bold text-steel-400">с {fmtMin(480)} план</span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-center text-[11px] font-bold text-steel-400 mt-5">
          {free ? "Нажмите на карточку — отметка ставится сразу" : "Отметка после ввода личного пароля"} · {emps.length} сотрудников в системе
        </p>
      </div>

      {flash && (
        <div className="fixed inset-0 z-[80] grid place-items-center pointer-events-none">
          <div className={`anim-flash absolute inset-0 ${flash.dir === "in" ? "bg-ok/25" : "bg-steel-950/80"}`} />
          <div className={`anim-pop relative card !rounded-3xl px-10 py-8 text-center border-2 ${flash.dir === "in" ? "!border-ok" : "!border-accent"}`}>
            <div className={`mx-auto w-14 h-14 rounded-2xl grid place-items-center ${flash.dir === "in" ? "bg-ok-soft text-ok" : "bg-accent-soft text-accent-deep"}`}>
              <I n={flash.dir === "in" ? "in" : "out"} size={26} />
            </div>
            <div className="font-display text-xl font-bold mt-3">{flash.name}</div>
            <div className="text-mute font-bold text-sm mt-1">
              {flash.dir === "in" ? "Начало смены" : "Конец смены"} · {flash.time}
            </div>
          </div>
        </div>
      )}

      <Modal open={!!pinFor} onClose={() => setPinFor(null)} title={pinFor === "exit" ? "Служебный выход" : "Подтвердите отметку"} w="max-w-sm"
        foot={<>
          <button className="btn btn-ghost" onClick={() => setPinFor(null)}>Отмена</button>
          <button className="btn btn-pri" onClick={() => {
            if (pinFor === "exit") {
              if (pin === db.settings.adminPin) onExit();
              else setPinErr("Неверный PIN администратора");
            } else {
              const u = db.users.find((x) => x.id === pinFor)!;
              if (pin === u.password) doPunch(u.id), setPinFor(null);
              else setPinErr("Неверный пароль");
            }
          }}>{pinFor === "exit" ? "Выйти" : "Отметиться"}</button>
        </>}>
        <input autoFocus type="password" inputMode="numeric" className="input text-center font-mono tracking-[0.3em]"
          placeholder={pinFor === "exit" ? "PIN администратора" : "Ваш пароль"} value={pin}
          onChange={(e) => { setPin(e.target.value); setPinErr(""); }}
          onKeyDown={(e) => e.key === "Enter" && setPinFor(pinFor === "exit" ? (pin === db.settings.adminPin ? (onExit(), null) : (setPinErr("Неверный PIN администратора"), pinFor)) : (db.users.find((x) => x.id === pinFor)?.password === pin ? (doPunch(pinFor!), null) : (setPinErr("Неверный пароль"), pinFor)))} />
        {pinErr && <div className="mt-2 text-xs font-bold text-bad flex items-center gap-1.5"><I n="warn" size={13} />{pinErr}</div>}
      </Modal>
    </div>
  );
  void toast;
}
