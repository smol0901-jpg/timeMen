import React, { useEffect, useMemo, useState } from "react";
import { StoreProvider, useStore, userById, myNotices } from "./lib/store";
import { MODULES, NAV_GROUPS, ModuleId, Device, BRAND, ROLE_LABEL } from "./lib/types";
import { I, Logo, Avatar, OnlineDot, ToastProvider, useToast } from "./components/ui";
import { relTime } from "./lib/time";
import Login from "./components/Login";
import Kiosk from "./components/Kiosk";
import { PunchView, StatsView, ScheduleView, RequestsView, ProfileView } from "./screens/employee";
import { DashboardView, EmployeesView, ScheduleEditor } from "./screens/admin";
import { RequestsAdmin, ReportsView, RemindersView, PermsView, DataIOView, AuditView, ArchiveView, SettingsView } from "./screens/admin2";
import { FeedView, ChatView, CameraView, BotView } from "./screens/misc";
import GamesView from "./screens/games";
import LiveGamesView from "./screens/gameslive";
import AIView from "./screens/ai";
import AIDepartmentView from "./screens/ai-dept";
import AIGamesView from "./screens/ai-games";
import OrgView from "./screens/org";
import ProductionView from "./screens/production";
import PayrollView from "./screens/payroll";
import HelpView from "./screens/help";

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
  if (kiosk) return <ErrorBoundary><Kiosk onExit={() => setKiosk(false)} /></ErrorBoundary>;
  if (!me) return <ErrorBoundary><Login onKiosk={() => setKiosk(true)} /></ErrorBoundary>;
  return <ErrorBoundary><Shell onKiosk={() => setKiosk(true)} /></ErrorBoundary>;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: unknown) { return { err: e instanceof Error ? e.message : String(e) }; }
  render() {
    if (this.state.err)
      return (
        <div className="min-h-full grid place-items-center p-6">
          <div className="card max-w-lg w-full p-6 text-center anim-pop">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-bad-soft text-bad grid place-items-center"><I n="warn" size={22} /></div>
            <b className="font-display text-sm block mt-3">Экран не смог отрисоваться</b>
            <p className="text-[12.5px] text-mute font-bold mt-1.5 break-all">Ошибка: {this.state.err}. База на сервере не пострадала.</p>
            <button className="btn btn-pri mt-4" onClick={() => { this.setState({ err: null }); window.location.reload(); }}>Перезагрузить</button>
          </div>
        </div>
      );
    return this.props.children;
  }
}

function useDeviceMode(): [Device, (d: "auto" | Device) => void, "auto" | Device] {
  const [mode, setMode] = useState<"auto" | Device>(() => (localStorage.getItem("sl.mode") as "auto" | Device) || "auto");
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 820px), (pointer: coarse)").matches;
  const dev: Device = mode === "auto" ? (isMobile ? "mobile" : "desktop") : mode;
  const set = (d: "auto" | Device) => { setMode(d); localStorage.setItem("sl.mode", d); };
  return [dev, set, mode];
}

function Shell({ onKiosk }: { onKiosk: () => void }) {
  const { db, me, can, logout, markNoticesRead, markEventsRead } = useStore();
  const { toast } = useToast();
  const [dev, setDev, mode] = useDeviceMode();
  const [route, setRoute] = useState<ModuleId>("punch");
  const [bell, setBell] = useState(false);
  const [more, setMore] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem("sl.groups") || "{}"); } catch { return {}; }
  });

  const allowed = useMemo(() => MODULES.filter((m) => me && can(m.id, dev)), [db, me, dev]);
  const favs = (me?.favs || []).filter((f) => allowed.some((m) => m.id === f));
  const notices = me ? myNotices(db, me) : [];
  const unread = me ? notices.filter((n) => !n.readBy.includes(me.id)).length : 0;
  const unreadEvents = me ? db.events.filter((e) => e.userId === me.id && !e.readBy.includes(me.id)).length : 0;

  useEffect(() => {
    if (!allowed.some((m) => m.id === route)) setRoute(allowed[0]?.id || "profile");
  }, [allowed.length, route]);

  if (!me) return null;

  const toggleGroup = (g: string) => {
    const next = { ...collapsed, [g]: !collapsed[g] };
    setCollapsed(next);
    localStorage.setItem("sl.groups", JSON.stringify(next));
  };
  const toggleFav = (id: ModuleId) => {
    const cur = me.favs || [];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    useStoreUpdateFav(next);
    toast(cur.includes(id) ? "Убрано из избранного" : "Добавлено в избранное", "ok");
  };
  // обновление избранного через updateUser
  const { updateUser } = useStore();
  const useStoreUpdateFav = (next: ModuleId[]) => updateUser(me.id, { favs: next });

  const Content = () => {
    switch (route) {
      case "punch": return <PunchView />;
      case "stats": return <StatsView />;
      case "schedule": return me.role === "employee" || me.role === "accountant" ? <ScheduleView /> : <ScheduleEditor />;
      case "requests": return me.role === "employee" ? <RequestsView /> : <RequestsAdmin />;
      case "production": return <ProductionView />;
      case "feed": return <FeedView />;
      case "chat": return <ChatView />;
      case "games": return <GamesView />;
      case "gameslive": return <LiveGamesView />;
      case "profile": return <ProfileView />;
      case "help": return <HelpView />;
      case "dashboard": return <DashboardView />;
      case "employees": return <EmployeesView />;
      case "org": return <OrgView />;
      case "reports": return <ReportsView />;
      case "payroll": return <PayrollView />;
      case "camera": return <CameraView />;
      case "reminders": return <RemindersView />;
      case "archive": return <ArchiveView />;
      case "ai": return <AIView />;
      case "bot": return <BotView />;
      case "ai-dept": return <AIDepartmentView />;
      case "ai-games": return <AIGamesView />;
      case "dataio": return <DataIOView />;
      case "settings": return <SettingsView />;
      case "permissions": return <PermsView />;
      case "audit": return <AuditView />;
      default: return null;
    }
  };

  const activeMod = MODULES.find((m) => m.id === route);

  const NavBtn = ({ m, horizontal }: { m: (typeof MODULES)[number]; horizontal?: boolean }) => {
    const active = route === m.id;
    const isFav = (me.favs || []).includes(m.id);
    return (
      <button onClick={() => { setRoute(m.id); setMore(false); }}
        className={`group relative flex items-center gap-2.5 rounded-lg font-bold transition-all ${horizontal ? "flex-col !gap-1 px-2.5 py-1.5 text-[9.5px] min-w-[62px]" : "w-full px-3 py-2 text-[13px]"}
        ${active ? "bg-accent text-white shadow-[0_4px_14px_-4px_rgba(229,111,36,0.7)]" : horizontal ? "text-steel-200 hover:text-paper" : "text-steel-200 hover:bg-steel-800 hover:text-paper"}`}>
        <I n={m.icon} size={horizontal ? 17 : 16} />
        <span className={horizontal ? "truncate max-w-[64px]" : "truncate"}>{m.label}</span>
        {!horizontal && (
          <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); toggleFav(m.id); }}
            className={`ml-auto w-6 h-6 rounded-md grid place-items-center transition ${isFav ? "text-accent" : "text-steel-600 opacity-0 group-hover:opacity-100 hover:text-accent"}`}
            title="В избранное">
            <svg width="13" height="13" viewBox="0 0 24 24" fill={isFav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l2.7 5.7 6.3.8-4.6 4.3 1.2 6.2L12 17l-5.6 3 1.2-6.2L3 9.5l6.3-.8z" /></svg>
          </span>
        )}
        {m.id === "requests" && db.requests.filter((r) => r.status === "pending").length > 0 && me.role !== "employee" && (
          <span className={`badge bg-warn text-white !px-1.5 ${horizontal ? "absolute -top-1 -right-1" : ""}`}>{db.requests.filter((r) => r.status === "pending").length}</span>
        )}
      </button>
    );
  };

  // мобильная нижняя панель: избранные ∪ первые модули
  const mobileNav = [...favs.map((f) => allowed.find((m) => m.id === f)!), ...allowed.filter((m) => !favs.includes(m.id))].filter(Boolean).slice(0, 6);

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden">
      {/* -------- сайдбар (ПК) -------- */}
      {dev === "desktop" && (
        <aside className="w-[248px] shrink-0 bg-steel-950 text-paper flex flex-col">
          <div className="flex items-center gap-2.5 px-4 py-4 border-b border-steel-800">
            <Logo size={34} />
            <div className="min-w-0">
              <b className="font-display text-[13px] tracking-tight block leading-none">СМЕНА<span className="text-accent">ЛАН</span></b>
              <span className="text-[9px] font-extrabold text-steel-400 uppercase tracking-[0.18em]">сервер учёта смен</span>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto dark-scroll px-2.5 py-3">
            {favs.length > 0 && (
              <div className="mb-3">
                <div className="px-3 pb-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.16em] text-accent flex items-center gap-1.5"><I n="star" size={11} />Избранное</div>
                <div className="grid gap-0.5">{favs.map((f) => <NavBtn key={f} m={allowed.find((m) => m.id === f)!} />)}</div>
              </div>
            )}
            {NAV_GROUPS.map((g) => {
              const mods = allowed.filter((m) => m.group === g);
              if (mods.length === 0) return null;
              const hid = collapsed[g];
              return (
                <div key={g} className="mb-2">
                  <button onClick={() => toggleGroup(g)} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.16em] text-steel-400 hover:text-steel-200 transition">
                    <I n={hid ? "chevR" : "chevL"} size={10} />{g}
                    <span className="ml-auto text-steel-600">{mods.length}</span>
                  </button>
                  {!hid && <div className="grid gap-0.5 mt-0.5">{mods.map((m) => <NavBtn key={m.id} m={m} />)}</div>}
                </div>
              );
            })}
          </nav>
          <div className="px-4 py-3 border-t border-steel-800 grid gap-1">
            <div className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-steel-400">Поддержка · {BRAND.company}</div>
            <div className="text-[10px] font-bold text-steel-400 leading-relaxed">TG/Zen: {BRAND.telegram} · {BRAND.phone}<br />{BRAND.email}</div>
          </div>
        </aside>
      )}

      {/* -------- основная колонка -------- */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <header className="h-[58px] shrink-0 bg-surface border-b border-line flex items-center gap-2.5 px-3 sm:px-5">
          {dev === "mobile" && <Logo size={30} />}
          <div className="min-w-0">
            <b className="font-display text-[14px] block leading-tight truncate">{activeMod?.label}</b>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-mute hidden sm:block">{activeMod?.group} · {ROLE_LABEL[me.role]}</span>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <OnlineDot />
            {/* переключатель интерфейса */}
            <div className="hidden sm:flex items-center bg-paper border border-line rounded-lg p-0.5 gap-0.5">
              {([["auto", "Авто", "grid"], ["desktop", "ПК", "desk"], ["mobile", "PWA", "phone"]] as const).map(([v, l, ic]) => (
                <button key={v} onClick={() => setDev(v)} title={`Интерфейс: ${l}`}
                  className={`inline-flex items-center gap-1 rounded-md px-2 h-7 text-[10.5px] font-extrabold transition ${mode === v ? "bg-steel-900 text-paper" : "text-mute hover:text-ink"}`}>
                  <I n={ic} size={12} />{l}
                </button>
              ))}
            </div>
            <button className="btn btn-ghost btn-sm hidden md:inline-flex" onClick={onKiosk}><I n="desk" size={14} />Терминал</button>
            {/* уведомления */}
            <div className="relative">
              <button className="relative w-9 h-9 rounded-lg grid place-items-center border border-line bg-surface hover:bg-paper transition" onClick={() => setBell(!bell)}>
                <I n="bell" size={17} />
                {(unread + unreadEvents) > 0 && <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-bad text-white text-[9.5px] font-extrabold grid place-items-center">{unread + unreadEvents}</span>}
              </button>
              {bell && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setBell(false)} />
                  <div className="absolute right-0 top-11 w-[min(360px,88vw)] card z-50 anim-pop overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-line flex items-center gap-2">
                      <b className="font-display text-[12.5px]">Уведомления</b>
                      <button className="btn btn-ghost btn-sm ml-auto" onClick={() => { markNoticesRead(); markEventsRead(); }}>Прочитать всё</button>
                    </div>
                    <div className="max-h-[50vh] overflow-y-auto">
                      {db.events.filter((e) => e.userId === me.id && !e.readBy.includes(me.id)).map((e) => (
                        <div key={e.id} className="px-4 py-2.5 border-b border-line/60 bg-warn-soft/40">
                          <b className="text-[12px] flex items-center gap-1.5"><I n="cal" size={13} className="text-warn" />График изменён</b>
                          <p className="text-[11.5px] text-mute font-bold mt-0.5">{e.changes.length} дн. · {e.comment || "без комментария"} · {relTime(e.ts)}</p>
                        </div>
                      ))}
                      {notices.slice(0, 20).map((n) => (
                        <div key={n.id} className={`px-4 py-2.5 border-b border-line/60 ${n.readBy.includes(me.id) ? "" : "bg-night-soft/40"}`}>
                          <p className="text-[12.5px] font-bold leading-snug">{n.text}</p>
                          <span className="text-[10px] text-mute font-bold">{relTime(n.ts)}</span>
                        </div>
                      ))}
                      {notices.length === 0 && unreadEvents === 0 && <p className="text-[12px] font-bold text-mute text-center py-8">Тишина — уведомлений нет</p>}
                    </div>
                  </div>
                </>
              )}
            </div>
            <button className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-paper transition" onClick={() => setRoute("profile")}>
              <Avatar u={me} size={32} />
              <span className="hidden md:block text-left">
                <b className="text-[12px] block leading-tight max-w-[120px] truncate">{me.name}</b>
                <span className="text-[9.5px] font-extrabold uppercase text-mute">{ROLE_LABEL[me.role]} · №{me.empNo || "—"}</span>
              </span>
            </button>
            <button className="w-9 h-9 rounded-lg grid place-items-center text-mute hover:bg-bad-soft hover:text-bad transition" title="Выйти" onClick={logout}><I n="logout" size={16} /></button>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 lg:p-6">
          <div className="max-w-[1240px] mx-auto anim-rise" key={route}>
            {dev === "mobile" && db.settings.announcement && (
              <div className="card !border-accent/50 p-3 mb-4 text-[12.5px] font-bold" style={{ background: "linear-gradient(100deg,#fbeadb,#fff)" }}>
                <I n="info" size={14} className="inline mr-1.5 text-accent-deep" />{db.settings.announcement}
              </div>
            )}
            <Content />
          </div>
        </main>

        {/* -------- мобильная навигация -------- */}
        {dev === "mobile" && (
          <>
            <nav className="bg-steel-950 text-paper flex items-stretch justify-around px-1 pt-1.5 pb-[max(6px,env(safe-area-inset-bottom))] shrink-0 border-t border-steel-700 overflow-x-auto dark-scroll">
              {mobileNav.map((m) => <NavBtn key={m.id} m={m} horizontal />)}
              <button onClick={() => setMore(!more)} className={`flex flex-col items-center gap-1 px-2.5 py-1.5 text-[9.5px] font-bold rounded-lg ${more ? "text-accent" : "text-steel-200"}`}>
                <I n={more ? "x" : "grid"} size={17} />{more ? "Скрыть" : "Ещё"}
              </button>
            </nav>
            {more && (
              <div className="bg-steel-900 border-t border-steel-700 p-3 grid grid-cols-3 gap-1.5 shrink-0 max-h-[38vh] overflow-y-auto dark-scroll anim-rise">
                {allowed.map((m) => (
                  <button key={m.id} onClick={() => { setRoute(m.id); setMore(false); }}
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11.5px] font-bold ${route === m.id ? "bg-accent text-white" : "text-steel-200 hover:bg-steel-800"}`}>
                    <I n={m.icon} size={15} />{m.label}
                  </button>
                ))}
                <button onClick={onKiosk} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11.5px] font-bold text-steel-200 hover:bg-steel-800"><I n="desk" size={15} />Терминал</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
