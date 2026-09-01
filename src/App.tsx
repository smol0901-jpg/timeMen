import React, { useEffect, useMemo, useRef, useState } from "react";
import { StoreProvider, useStore, myNotices } from "./lib/store";
import { MODULES, ModuleId } from "./lib/types";
import { ToastProvider, useToast, I, Avatar, Logo, OnlineDot, RoleBadge } from "./components/ui";
import Login from "./components/Login";
import Kiosk from "./components/Kiosk";
import FeedView from "./components/feed";
import { PunchView, StatsView, ScheduleView, RequestsView, ProfileView } from "./screens/employee";
import { DashboardView, EmployeesView, ScheduleEditor } from "./screens/admin";
import { RequestsAdminView, ReportsView, PermissionsView, DataIOView, AuditView, SettingsView } from "./screens/admin2";
import { relTime } from "./lib/time";

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </StoreProvider>
  );
}

type LayoutPref = "auto" | "desktop" | "mobile";

function Shell() {
  const { me } = useStore();
  const [kiosk, setKiosk] = useState(false);
  const [pref, setPref] = useState<LayoutPref>(() => (localStorage.getItem("smenalan.layout") as LayoutPref) || "auto");
  const [winW, setWinW] = useState(window.innerWidth);

  useEffect(() => {
    const h = () => setWinW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  useEffect(() => localStorage.setItem("smenalan.layout", pref), [pref]);

  const isMobile = pref === "auto" ? winW < 980 : pref === "mobile";

  if (kiosk) return <Kiosk onExit={() => setKiosk(false)} />;
  if (!me) return <Login onKiosk={() => setKiosk(true)} />;
  return <AppShell key={me.id + String(isMobile)} isMobile={isMobile} pref={pref} setPref={setPref} />;
}

function AppShell({ isMobile, pref, setPref }: { isMobile: boolean; pref: LayoutPref; setPref: (p: LayoutPref) => void }) {
  const { db, me, can, logout } = useStore();
  const device = isMobile ? "mobile" : "desktop";
  const nav = useMemo(() => MODULES.filter((m) => can(m.id, device)), [db.perms, me?.role, device]); // eslint-disable-line
  const [view, setView] = useState<ModuleId>(() => nav[0]?.id || "profile");
  const [reqDraft, setReqDraft] = useState<{ kind: "swap" | "vacation" | "extra"; date?: string } | null>(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    if (!nav.some((m) => m.id === view)) setView(nav[0]?.id || "profile");
  }, [nav, view]);

  if (!me) return null;
  const isAdminSide = me.role !== "employee";
  const userNav = nav.filter((m) => m.group === "user");
  const adminNav = nav.filter((m) => m.group === "admin");
  const title = MODULES.find((m) => m.id === view)?.label || "";

  const content = (() => {
    switch (view) {
      case "punch": return <PunchView />;
      case "stats": return <StatsView />;
      case "schedule": return isAdminSide ? <ScheduleEditor /> : <ScheduleView onAskSwap={(d) => { setReqDraft({ kind: "swap", date: d }); setView("requests"); }} />;
      case "requests": return isAdminSide ? <RequestsAdminView /> : <RequestsView draft={reqDraft} onDraftUsed={() => setReqDraft(null)} />;
      case "feed": return <FeedView />;
      case "profile": return <ProfileView />;
      case "dashboard": return <DashboardView go={(v) => setView(v as ModuleId)} />;
      case "employees": return <EmployeesView />;
      case "reports": return <ReportsView />;
      case "dataio": return <DataIOView />;
      case "permissions": return <PermissionsView />;
      case "audit": return <AuditView />;
      case "settings": return <SettingsView />;
    }
  })();

  if (isMobile) {
    const tabs = nav.slice(0, 5);
    const rest = nav.slice(5);
    return (
      <div className="h-full flex flex-col">
        <header className="bg-steel-900 text-paper px-4 py-3 flex items-center gap-3 shrink-0 z-30">
          <Logo size={32} />
          <div className="min-w-0">
            <div className="font-display font-bold text-[13px] leading-none truncate">{title}</div>
            <div className="text-[9.5px] font-bold text-steel-400 uppercase tracking-widest mt-1 truncate">СменаЛАН · {me.dept}</div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <OnlineDot />
            <Bell />
            <button className="w-9 h-9 rounded-full grid place-items-center" onClick={() => setView("profile")}><Avatar u={me} size={32} /></button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-3.5 sm:p-5 pb-24">
          <div key={view} className="anim-rise">{content}</div>
        </main>

        <nav className="fixed bottom-0 inset-x-0 bg-steel-900 text-steel-200 border-t border-steel-700 flex z-40 pb-[env(safe-area-inset-bottom)]">
          {tabs.map((m) => (
            <button key={m.id} onClick={() => setView(m.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[9.5px] font-extrabold transition ${view === m.id ? "text-accent" : "hover:text-paper"}`}>
              <I n={m.icon} size={19} />{m.label.split(" ")[0]}
            </button>
          ))}
          {rest.length > 0 && (
            <button onClick={() => setMore(true)} className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[9.5px] font-extrabold transition ${rest.some((m) => m.id === view) ? "text-accent" : "hover:text-paper"}`}>
              <I n="menu" size={19} />Ещё
            </button>
          )}
        </nav>

        {more && (
          <div className="fixed inset-0 z-50 flex items-end" onClick={() => setMore(false)}>
            <div className="absolute inset-0 bg-steel-950/60" />
            <div className="relative w-full bg-surface rounded-t-2xl p-4 pb-8 anim-pop" onClick={(e) => e.stopPropagation()}>
              <div className="w-10 h-1 rounded-full bg-line mx-auto mb-4" />
              <div className="grid grid-cols-3 gap-2">
                {rest.map((m) => (
                  <button key={m.id} onClick={() => { setView(m.id); setMore(false); }}
                    className={`card p-3.5 flex flex-col items-center gap-2 text-xs font-extrabold transition ${view === m.id ? "!border-accent text-accent-deep" : "hover:border-steel-400"}`}>
                    <I n={m.icon} size={20} />{m.label}
                  </button>
                ))}
                <button onClick={() => { logout(); }} className="card p-3.5 flex flex-col items-center gap-2 text-xs font-extrabold text-bad hover:!border-bad">
                  <I n="logout" size={20} />Выйти
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---- десктоп: админка ----
  return (
    <div className="h-full flex">
      <aside className="w-[232px] shrink-0 bg-steel-900 text-steel-200 flex flex-col">
        <div className="px-5 pt-5 pb-4 flex items-center gap-2.5">
          <Logo size={38} />
          <div>
            <div className="font-display font-bold text-[15px] text-paper leading-none">СМЕНА<span className="text-accent">ЛАН</span></div>
            <div className="text-[9px] font-bold text-steel-400 uppercase tracking-[0.16em] mt-1">сервер · LAN</div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto dark-scroll px-3 pb-3">
          {userNav.length > 0 && <NavGroup label="Работа" items={userNav} view={view} setView={setView} />}
          {adminNav.length > 0 && <NavGroup label="Управление" items={adminNav} view={view} setView={setView} />}
        </div>
        <div className="p-3 border-t border-steel-700">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <Avatar u={me} size={34} />
            <div className="min-w-0 flex-1">
              <div className="text-paper text-xs font-extrabold truncate">{me.name}</div>
              <div className="text-[10px] font-bold text-steel-400 truncate">{me.dept}</div>
            </div>
            <button className="w-8 h-8 rounded-lg grid place-items-center text-steel-400 hover:text-bad hover:bg-steel-800 transition" title="Выйти" onClick={logout}><I n="logout" size={16} /></button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 bg-surface border-b border-line flex items-center gap-4 px-6 sticky top-0 z-30">
          <div>
            <h1 className="font-display font-semibold text-[17px] leading-none">{title}</h1>
            <div className="text-[10.5px] font-bold text-mute mt-1">{db.settings.orgName} · {db.settings.orgAddress}</div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <OnlineDot />
            <div className="hidden md:flex items-center bg-paper border border-line rounded-lg p-0.5 gap-0.5">
              {([["auto", "info", "Авто"], ["desktop", "desk", "ПК"], ["mobile", "phone", "PWA"]] as [LayoutPref, string, string][]).map(([p, ic, l]) => (
                <button key={p} onClick={() => setPref(p)} title={`Интерфейс: ${l}`}
                  className={`w-8 h-7 rounded-md grid place-items-center transition ${pref === p ? "bg-steel-900 text-paper" : "text-mute hover:text-ink"}`}><I n={ic} size={14} /></button>
              ))}
            </div>
            <Bell />
            <button className="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-xl hover:bg-paper transition" onClick={() => setView("profile")}>
              <Avatar u={me} size={34} />
              <div className="text-left hidden lg:block">
                <div className="text-xs font-extrabold leading-none">{me.name.split(" ").slice(0, 2).join(" ")}</div>
                <div className="mt-1"><RoleBadge role={me.role} /></div>
              </div>
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <div key={view} className="anim-rise max-w-[1400px] mx-auto">{content}</div>
        </main>
      </div>
    </div>
  );
}

function NavGroup({ label, items, view, setView }: {
  label: string; items: { id: ModuleId; label: string; icon: string }[]; view: ModuleId; setView: (v: ModuleId) => void;
}) {
  const { db } = useStore();
  const pending = db.requests.filter((r) => r.status === "pending").length;
  return (
    <div className="mt-4">
      <div className="px-2.5 text-[9.5px] font-extrabold uppercase tracking-[0.16em] text-steel-400 mb-1.5">{label}</div>
      {items.map((m) => (
        <button key={m.id} onClick={() => setView(m.id)}
          className={`relative w-full flex items-center gap-2.5 px-2.5 h-9.5 h-10 rounded-lg text-[13px] font-bold mb-0.5 transition-all duration-150 cursor-pointer
            ${view === m.id ? "bg-steel-800 text-paper" : "text-steel-200 hover:bg-steel-800/60 hover:text-paper"}`}>
          {view === m.id && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-accent" />}
          <I n={m.icon} size={16} />
          {m.label}
          {m.id === "requests" && pending > 0 && <span className="ml-auto badge bg-accent text-white !px-1.5 tnum">{pending}</span>}
        </button>
      ))}
    </div>
  );
}

function Bell() {
  const { db, me, markNoticesRead } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  if (!me) return null;
  const list = myNotices(db, me).slice(0, 20);
  const unread = list.filter((n) => !n.readBy.includes(me.id)).length;

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button className="relative w-9 h-9 rounded-xl grid place-items-center text-mute hover:bg-paper hover:text-ink transition" onClick={() => setOpen(!open)}>
        <I n="bell" size={18} />
        {unread > 0 && <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-accent text-white text-[9px] font-extrabold grid place-items-center tnum">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-11 w-[340px] card shadow-xl z-50 anim-pop overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <b className="text-sm font-display font-semibold">Уведомления</b>
            {unread > 0 && <button className="text-[11px] font-extrabold text-accent-deep hover:underline" onClick={markNoticesRead}>Прочитать всё</button>}
          </div>
          <div className="max-h-[380px] overflow-y-auto">
            {list.length === 0 ? <div className="p-6 text-center text-xs font-bold text-mute">Пока тихо</div> : list.map((n) => {
              const isUnread = !n.readBy.includes(me.id);
              return (
                <div key={n.id} className={`px-4 py-3 border-b border-line/60 text-sm flex gap-2.5 ${isUnread ? "bg-accent-soft/40" : ""}`}>
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isUnread ? "bg-accent" : "bg-line"}`} />
                  <div>
                    <div className={`leading-snug ${isUnread ? "font-bold" : "font-semibold text-mute"}`}>{n.text}</div>
                    <div className="text-[10px] font-bold text-mute mt-1">{relTime(n.ts)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
