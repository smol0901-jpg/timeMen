import React, { useEffect, useState } from "react";
import { useStore, openPunchOf } from "../lib/store";
import { User } from "../lib/types";
import { useNow, Avatar, I, Logo, OnlineDot, useToast, RoleBadge } from "./ui";
import { MONTHS, WD_FULL, fmtClock, fmtDurH, nowMin } from "../lib/time";

export default function Login({ onKiosk }: { onKiosk: () => void }) {
  const { db, login } = useStore();
  const { toast } = useToast();
  const now = useNow();
  const [sel, setSel] = useState<User | null>(null);
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [deferred, setDeferred] = useState<Event & { prompt?: () => void } | null>(null);

  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setDeferred(e as never); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  const active = db.users.filter((u) => u.active);
  const submit = () => {
    if (!sel) return;
    const e = login(sel.username, pwd);
    if (e) { setErr(e); setPwd(""); }
    else toast(`С возвращением, ${sel.name.split(" ")[0]}!`, "ok");
  };

  return (
    <div className="min-h-full flex bg-paper">
      {/* левая панель — пульт */}
      <div className="hidden lg:flex flex-col w-[460px] xl:w-[520px] shrink-0 bg-steel-900 text-paper relative overflow-hidden">
        <div className="absolute -right-28 -top-28 w-[420px] h-[420px] rounded-full border-[36px] border-steel-800 pointer-events-none" />
        <div className="absolute -right-28 -top-28 w-[420px] h-[420px] rounded-full border border-steel-700 pointer-events-none" />
        <div className="absolute right-24 top-56 w-3 h-3 rounded-full bg-accent pulse-ok pointer-events-none" />
        <div className="p-10 flex flex-col h-full relative">
          <div className="flex items-center gap-3.5">
            <Logo size={52} />
            <div>
              <div className="font-display font-bold text-xl tracking-tight leading-none">СМЕНА<span className="text-accent">ЛАН</span></div>
              <div className="text-[11px] font-bold text-steel-400 mt-1.5 uppercase tracking-[0.14em]">сервер учёта смен · LAN</div>
            </div>
          </div>

          <div className="mt-12">
            <div className="font-mono tnum font-semibold text-[64px] leading-none tracking-tight">{fmtClock(now)}</div>
            <div className="text-steel-400 font-semibold mt-3 capitalize">
              {WD_FULL[(now.getDay() + 6) % 7]}, {now.getDate()} {MONTHS[now.getMonth()]} {now.getFullYear()}
            </div>
          </div>

          <div className="mt-10 grid gap-2.5 text-sm font-semibold text-steel-200">
            {[
              ["clock", "Отметки прихода и ухода — с ПК, телефона или терминала"],
              ["cal", "Графики по цехам, заявки на замену, отпуск и доп. смены"],
              ["pdf", "Табель и расчёт зарплаты: Excel и бланк PDF для бухгалтерии"],
              ["shield", "Роли: суперадмин, админ, сотрудники — без ограничений по числу"],
            ].map(([ic, t]) => (
              <div key={ic} className="flex items-start gap-3 bg-steel-800/70 border border-steel-700 rounded-xl px-4 py-3">
                <span className="text-accent mt-0.5"><I n={ic} size={17} /></span>{t}
              </div>
            ))}
          </div>

          <div className="mt-auto pt-8 flex items-center justify-between text-[11px] font-bold text-steel-400">
            <span className="flex items-center gap-2"><I n="wifi" size={14} /> http://192.168.1.7:4000 · Wi-Fi «Proton-Shop»</span>
            <OnlineDot />
          </div>
        </div>
      </div>

      {/* правая панель — выбор сотрудника */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="lg:hidden flex items-center gap-3 px-5 py-4 bg-steel-900 text-paper">
          <Logo size={38} />
          <div>
            <div className="font-display font-bold leading-none">СМЕНА<span className="text-accent">ЛАН</span></div>
            <div className="text-[10px] font-bold text-steel-400 uppercase tracking-widest mt-1">учёт смен · LAN</div>
          </div>
          <div className="ml-auto font-mono tnum font-semibold text-lg">{fmtClock(now).slice(0, 5)}</div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-10">
          <div className="max-w-3xl mx-auto">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">Кто выходит на смену?</h1>
            <p className="text-mute font-semibold text-sm mt-2">Выберите себя в списке — пароль нужен, только если он задан администратором.</p>

            <div className="flex flex-wrap gap-2 mt-5 items-center">
              <span className="lbl !mb-0 mr-1">Демо-доступ:</span>
              {[["root", "root", "Суперадмин"], ["plan", "1234", "Админ"], ["igor", "1234", "Сотрудник"], ["marina", "—", "Без пароля"]].map(([l, p, r]) => (
                <button key={l} className="chip" onClick={() => {
                  if (p === "—") { doQuick(l, ""); } else { doQuick(l, p); }
                }}>
                  <span className="text-mute">{r}</span> <b>{l}</b>{p !== "—" && <span className="text-mute">/ {p}</span>}
                </button>
              ))}
            </div>

            {sel && (
              <div className="anim-pop card mt-6 p-5 border-l-4 !border-l-accent">
                <div className="flex items-center gap-3.5">
                  <Avatar u={sel} size={46} />
                  <div className="min-w-0">
                    <div className="font-extrabold truncate">{sel.name}</div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-mute font-semibold">
                      <span>{sel.dept}</span>·<RoleBadge role={sel.role} />
                    </div>
                  </div>
                  {openPunchOf(db, sel.id) && <span className="badge bg-ok-soft text-ok ml-auto"><span className="w-1.5 h-1.5 rounded-full bg-ok pulse-ok" />на смене</span>}
                </div>
                {sel.password ? (
                  <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
                    <input autoFocus type="password" className="input max-w-[240px]" placeholder="Пароль" value={pwd}
                      onChange={(e) => { setPwd(e.target.value); setErr(""); }} />
                    <button className="btn btn-pri" type="submit"><I n="in" size={16} />Войти</button>
                  </form>
                ) : (
                  <button className="btn btn-pri mt-4" onClick={submit}><I n="in" size={16} />Войти без пароля</button>
                )}
                {err && <div className="mt-3 text-xs font-bold text-bad flex items-center gap-1.5"><I n="warn" size={14} />{err}</div>}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-6">
              {active.map((u, i) => (
                <button key={u.id} onClick={() => { setSel(u); setErr(""); setPwd(""); }}
                  className={`anim-rise card p-3.5 flex items-center gap-3 text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md cursor-pointer
                    ${sel?.id === u.id ? "!border-accent ring-2 ring-accent/25" : ""}`}
                  style={{ animationDelay: `${i * 35}ms` }}>
                  <Avatar u={u} size={40} />
                  <div className="min-w-0">
                    <div className="font-bold text-sm truncate leading-tight">{u.name}</div>
                    <div className="text-[11px] text-mute font-semibold truncate mt-0.5">
                      {u.dept}{!u.password && <span className="text-ok ml-1">· без пароля</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2.5 mt-8">
              <button className="btn btn-dark" onClick={onKiosk}><I n="desk" size={17} />Режим терминала (киоск)</button>
              {deferred && (
                <button className="btn btn-ghost" onClick={async () => {
                  (deferred as { prompt: () => void }).prompt();
                  setDeferred(null);
                  toast("Установка PWA…", "ok");
                }}><I n="phone" size={17} />Установить приложение</button>
              )}
            </div>
            <p className="text-[11px] text-mute font-semibold mt-4 flex items-center gap-1.5">
              <I n="info" size={13} /> Работает внутри одной Wi-Fi сети · сегодня на смене: {db.punches.filter((p) => p.tout === null).length} чел · {fmtDurH(nowMin())} с начала суток
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  function doQuick(l: string, p: string) {
    const e = login(l, p);
    if (e) toast(e, "bad");
    else toast("Вход выполнен", "ok");
  }
}
