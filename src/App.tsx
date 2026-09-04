import React, { useEffect, useMemo, useState } from "react";
import { StoreProvider, useStore, myNotices, remindersFor } from "./lib/store";
import { MODULES, ModuleId } from "./lib/types";
import { ToastProvider, I, Avatar, Logo, OnlineDot } from "./components/ui";
import Login from "./components/Login";
import Kiosk from "./components/Kiosk";
import { PunchView, StatsView, ScheduleView, RequestsView, ProfileView } from "./screens/employee";
import { DashboardView, EmployeesView, ScheduleEditor } from "./screens/admin";
import { RequestsAdmin, ReportsView, PermsView, DataIOView, AuditView, RemindersView, SettingsView, PayrollView, ArchiveView } from "./screens/admin2";
import { FeedView, ChatView, GamesView, AIView, BotView, CameraView, OrgView, ProductionView, HelpView } from "./screens/misc";
import { relTime, todayKey } from "./lib/time";

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <Root />
      </ToastProvider>
    </StoreProvider>
  );
}

function Root() {
  const { me } = useStore();
  const [kiosk, setKiosk] = useState(false);
  if (kiosk) return <Kiosk onExit={() => setKiosk(false)} />;
  if (!me) return <Login onKiosk={() => setKiosk(true)} />;
  return <Shell onKiosk={() => setKiosk(true)} />;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: unknown) { return { err: e instanceof Error ? e.message : String(e) }; }
  render() {
    if (this.state.err)
      return (
        <div className="card max-w-lg mx-auto mt-10 p-6 text-center anim-pop">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-bad-soft text-bad grid place-items-center"><I n="warn" size={22} /></div>
          <b className="font-display text-sm block mt-3">Экран не смог отрисоваться</b>
          <p className="text-[12.5px] text-mute font-bold mt-1.5">Ошибка: {this.state.err}. Данные целы — база на сервере.</p>
          <button className="btn btn-pri mt-4" onClick={() => window.location.reload()}>Перезагрузить</button>
        </div>
      );
    return this.props.children;
  }
}

function Shell({ onKiosk }: { onKiosk: () => void }) {
  const { db, me, can, logout, markNoticesRead } = useStore();
  const [view, setView] = useState<ModuleId>("punch");
  const [wide, setWide] = useState(() => window.innerWidth >= 1024);
  const [bell, setBell] = useState(false);
  const [nav, setNav] = useState(false);
  const [installEvt, setInstallEvt] = useState<(Event & { prompt?: () => void }) | null>(null);

  useEffect(() => {
    const h = () => setWide(window.innerWidth >= 1024);
    window.addEventListener("resize", h);
    const bi = (e: Event) => { e.preventDefault(); setInstallEvt(e as Event & { prompt?: () => void }); };
    window.addEventListener("beforeinstallprompt", bi);
    return () => { window.removeEventListener("resize", h); window.removeEventListener("beforeinstallprompt", bi); };
  }, []);

  const device = wide ? "desktop" : "mobile";
  const allowed = useMemo(() => MODULES.filter((m) => can(m.id, device)), [db, me, device]);
  const isDesktop = device === "desktop";
  useEffect(() => {
    if (!allowed.some((m) => m.id === view) && allowed.length) setView(allowed[0].id);
  }, [allowed, view]);
  if (!me) return null;

  const notices = myNotices(db, me);
  const unread = notices.filter((n) => !n.readBy.includes(me.id));
  const myRem = remindersFor(db, me).filter((r) => r.due <= todayKey() && !r.doneBy.includes(me.id));
  const title = MODULES.find((m) => m.id === view)?.label || "";
  const isAdmin = me.role !== "employee";
  const go = (v: ModuleId) => { setView(v); setNav(false); setBell(false); };

  const content = (() => {
    switch (view) {
      case "punch": return <PunchView />;
      case "stats": return <StatsView />;
      case "schedule": return isDesktop && isAdmin ? <ScheduleEditor /> : <ScheduleView />;
      case "requests": return isAdmin && isDesktop ? <RequestsAdmin /> : <RequestsView />;
      case "feed": return <FeedView />;
      case "chat": return <ChatView />;
      case "production": return <ProductionView />;
      case "games": return <GamesView />;
      case "profile": return <ProfileView />;
      case "dashboard": return <DashboardView />;
      case "employees": return <EmployeesView />;
      case "org": return <OrgView />;
      case "reports": return <ReportsView />;
      case "ai": return <AIView />;
      case "bot": return <BotView />;
      case "camera": return <CameraView />;
      case "payroll": return <PayrollView />;
      case "archive": return <ArchiveView />;
      case "reminders": return <RemindersView />;
      case "dataio": return <DataIOView />;
      case "permissions": return <PermsView />;
      case "audit": return <AuditView />;
      case "settings": return <SettingsView />;
      case "help": return <HelpView />;
      default: return null;
    }
  })();

  const userMods = allowed.filter((m) => m.group === "user");
  const adminMods = allowed.filter((m) => m.group === "admin");

  const NavBtn = ({ m, horizontal }: { m: (typeof MODULES)[number]; horizontal?: boolean }) => (
    <button onClick={() => go(m.id)}
      className={`flex items-center gap-2.5 rounded-lg font-bold transition-all ${horizontal ? "flex-col gap-1 px-2 py-1.5 text-[9.5px] min-w-[56px]" : "px-3 h-10 text-[13px] w-full text-left"}
      ${view === m.id ? (horizontal ? "text-accent" : "bg-accent text-white shadow-[0_3px_12px_-4px_rgba(229,111,36,0.7)]") : horizontal ? "text-steel-200" : "text-steel-200 hover:bg-steel-800 hover:text-paper"}`}>
      <I n={m.icon} size={horizontal ? 18 : 16} />
      <span className={horizontal ? "truncate max-w-[56px]" : "truncate"}>{m.label}</span>
    </button>
  );

  return (
    <div className="h-full flex flex-col lg:flex-row">
      {!isDesktop && (
        <div className="bg-steel-950 text-paper px-4 pt-[max(10px,env(safe-area-inset-top))] pb-2.5 flex items-center gap-3 shrink-0 sticky top-0 z-40">
          <Logo size={30} />
          <b className="font-display text-[13px] tracking-tight">СМЕНА<span className="text-accent">ЛАН</span></b>
          <OnlineDot />
          <div className="ml-auto flex items-center gap-1.5">
            <BellBtn bell={bell} setBell={setBell} unread={unread.length + myRem.length} notices={notices} onRead={markNoticesRead} reminders={myRem} />
            {isAdmin && <button className="btn btn-sm !border-steel-600 !bg-steel-800 !text-steel-200 !px-2" onClick={onKiosk} title="Терминал"><I n="desk" size={14} /></button>}
            <button className="w-8 h-8 rounded-full grid place-items-center" onClick={() => go("profile")}><Avatar u={me} size={30} /></button>
          </div>
        </div>
      )}

      {isDesktop && (
        <aside className="w-60 shrink-0 bg-steel-950 text-paper flex flex-col sticky top-0 h-screen">
          <div className="flex items-center gap-3 px-4 py-4 border-b border-steel-700">
            <Logo size={38} />
            <div>
              <b className="font-display text-sm tracking-tight block leading-none">СМЕНА<span className="text-accent">ЛАН</span></b>
              <span className="text-[9.5px] font-extrabold text-steel-400 uppercase tracking-[0.16em]">сервер учёта смен</span>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto dark-scroll px-3 py-3 grid gap-0.5 content-start">
            <span className="text-[9.5px] font-extrabold uppercase tracking-[0.16em] text-steel-400 px-3 pt-1 pb-2">Работа</span>
            {userMods.map((m) => <NavBtn key={m.id} m={m} />)}
            {adminMods.length > 0 && <span className="text-[9.5px] font-extrabold uppercase tracking-[0.16em] text-steel-400 px-3 pt-4 pb-2">Управление</span>}
            {adminMods.map((m) => <NavBtn key={m.id} m={m} />)}
          </nav>
          <div className="p-3 border-t border-steel-700 grid gap-2">
            <OnlineDot />
            {isAdmin && <button className="btn btn-sm !border-steel-600 !bg-steel-800 !text-steel-200" onClick={onKiosk}><I n="desk" size={14} />Режим терминала</button>}
            {installEvt && <button className="btn btn-sm btn-soft" onClick={() => installEvt.prompt?.()}><I n="phone" size={14} />Установить PWA</button>}
            <div className="flex items-center gap-2.5 bg-steel-800 rounded-xl px-3 py-2.5">
              <Avatar u={me} size={34} />
              <div className="min-w-0 flex-1">
                <b className="text-[12.5px] block truncate">{me.name}</b>
                <span className="text-[10px] font-extrabold text-steel-400 uppercase">{me.role === "superadmin" ? "суперадмин" : me.role === "admin" ? "админ" : me.role === "accountant" ? "бухгалтерия" : "сотрудник"}</span>
              </div>
              <button className="w-8 h-8 rounded-lg grid place-items-center text-steel-400 hover:text-bad hover:bg-steel-700 transition" onClick={logout} title="Выйти"><I n="logout" size={15} /></button>
            </div>
          </div>
        </aside>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {isDesktop && (
          <header className="bg-surface/90 backdrop-blur border-b border-line px-6 py-3 flex items-center gap-4 sticky top-0 z-30">
            <h1 className="font-display text-[17px] font-semibold tracking-tight">{title}</h1>
            <div className="ml-auto flex items-center gap-3">
              <BellBtn bell={bell} setBell={setBell} unread={unread.length + myRem.length} notices={notices} onRead={markNoticesRead} reminders={myRem} />
              <button className="w-9 h-9 rounded-full grid place-items-center" onClick={() => go("profile")}><Avatar u={me} size={34} /></button>
            </div>
          </header>
        )}

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <ErrorBoundary key={view}>{content}</ErrorBoundary>
        </main>
      </div>

      {!isDesktop && (
        <nav className="bg-steel-950 text-paper flex items-stretch justify-around px-1 pt-1.5 pb-[max(6px,env(safe-area-inset-bottom))] shrink-0 sticky bottom-0 z-40 border-t border-steel-700 overflow-x-auto dark-scroll">
          {allowed.slice(0, 6).map((m) => <NavBtn key={m.id} m={m} horizontal />)}
          {allowed.length > 6 && (
            <button onClick={() => setNav(true)} className={`flex flex-col items-center gap-1 px-2 py-1.5 text-[9.5px] font-bold min-w-[56px] ${nav ? "text-accent" : "text-steel-200"}`}>
              <I n="grid" size={18} />Ещё
            </button>
          )}
        </nav>
      )}

      {nav && !isDesktop && (
        <div className="fixed inset-0 z-[60] bg-steel-950/70 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setNav(false)}>
          <div className="card !bg-steel-900 !border-steel-700 p-4 max-w-sm mx-auto mt-10 anim-pop" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <b className="font-display text-sm text-paper">Все разделы</b>
              <button className="w-8 h-8 rounded-lg grid place-items-center text-steel-200 hover:bg-steel-700" onClick={() => setNav(false)}><I n="x" size={16} /></button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {allowed.map((m) => (
                <button key={m.id} onClick={() => go(m.id)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-[10px] font-extrabold transition ${view === m.id ? "bg-accent text-white" : "bg-steel-800 text-steel-200 hover:bg-steel-700"}`}>
                  <I n={m.icon} size={19} />{m.label}
                </button>
              ))}
            </div>
            <button className="btn !border-steel-600 !bg-steel-800 !text-steel-200 btn-sm w-full mt-3" onClick={logout}><I n="logout" size={13} />Выйти</button>
          </div>
        </div>
      )}
    </div>
  );
}

function BellBtn({ bell, setBell, unread, notices, onRead, reminders }: {
  bell: boolean; setBell: (v: boolean) => void; unread: number; notices: ReturnType<typeof myNotices>;
  onRead: () => void; reminders: { id: string; title: string; due: string }[];
}) {
  return (
    <div className="relative">
      <button className={`w-9 h-9 rounded-full grid place-items-center transition relative ${bell ? "bg-paper" : "hover:bg-paper"}`} onClick={() => { setBell(!bell); if (!bell) onRead(); }}>
        <I n="bell" size={17} />
        {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-bad text-white text-[10px] font-extrabold grid place-items-center">{unread}</span>}
      </button>
      {bell && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setBell(false)} />
          <div className="absolute right-0 top-11 w-[min(360px,86vw)] card z-50 anim-pop overflow-hidden">
            <div className="px-4 py-3 border-b border-line flex items-center gap-2">
              <b className="font-display text-sm">Уведомления</b>
              <span className="text-[11px] text-mute font-bold ml-auto">прочитано при открытии</span>
            </div>
            <div className="max-h-[380px] overflow-y-auto">
              {reminders.map((r) => (
                <div key={r.id} className="px-4 py-2.5 border-b border-line/60 flex gap-2.5 bg-warn-soft/40">
                  <I n="bell" size={15} className="text-warn shrink-0 mt-0.5" />
                  <div><b className="text-[12.5px] block">Напоминание: {r.title}</b><span className="text-[11px] text-mute font-bold">раздел «Моя смена»</span></div>
                </div>
              ))}
              {notices.length === 0 && reminders.length === 0 && <p className="text-center text-[12px] font-bold text-mute py-8">Пока тихо</p>}
              {notices.slice(0, 20).map((n) => (
                <div key={n.id} className="px-4 py-2.5 border-b border-line/60 flex gap-2.5">
                  <I n="info" size={15} className="text-night shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold leading-snug">{n.text}</p>
                    <span className="text-[10.5px] text-mute font-bold">{relTime(n.ts)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
