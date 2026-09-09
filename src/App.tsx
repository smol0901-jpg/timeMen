import React, { useState, useMemo } from "react";
import { StoreProvider, useStore } from "./lib/store";
import { ToastProvider, I, Logo, Avatar, OnlineDot } from "./components/ui";
import { MODULES, ModuleId, NAV_GROUPS } from "./lib/types";
import Login from "./components/Login";
import Kiosk from "./components/Kiosk";
import { PunchView, StatsView, ScheduleView, RequestsView, ProfileView } from "./screens/employee";
import { DashboardView, EmployeesView, ScheduleEditor } from "./screens/admin";
import FeedView from "./components/feed";
import ChatView from "./components/chat";
import GamesView from "./screens/games";
import AIView from "./screens/ai";
import HelpView from "./screens/help";
import SupportView from "./screens/support";
import OrdersView from "./screens/orders";
import ServerMonitor from "./screens/server-monitor";
import SecurityView from "./screens/security";
import { RequestsAdmin, ReportsView, RemindersView, PermsView, DataIOView, AuditView, ArchiveView, SettingsView } from "./screens/admin2";
import AIDepartmentView from "./screens/ai-dept";
import AIGamesView from "./screens/ai-games";
import OrgView from "./screens/org";
import ProductionView from "./screens/production";
import LiveGamesView from "./screens/gameslive";
import { CameraView } from "./screens/misc";

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
  return <Shell />;
}

function Shell() {
  const { me, logout } = useStore();
  const [view, setView] = useState<ModuleId>("punch");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  if (!me) return null;
  
  const allowed = useMemo(() => {
    return MODULES.filter((m) => {
      if (me.role === "superadmin") return true;
      if (me.role === "admin" || me.role === "foreman") {
        return m.group !== "Система" || ["dataio", "settings", "audit", "server-monitor", "security"].includes(m.id);
      }
      if (me.role === "accountant") {
        return ["punch", "stats", "schedule", "requests", "production", "feed", "chat", "games", "profile", "help", "support", "payroll", "reports"].includes(m.id);
      }
      return m.group === "Работа" || m.group === "Общение" || m.group === "Личное";
    });
  }, [me.role]);
  
  const currentModule = MODULES.find((m) => m.id === view);
  
  const Content = () => {
    switch (view) {
      case "punch": return <PunchView />;
      case "stats": return <StatsView />;
      case "schedule": return me.role === "employee" ? <ScheduleView /> : <ScheduleEditor />;
      case "requests": return me.role === "employee" ? <RequestsView /> : <RequestsAdmin />;
      case "production": return <ProductionView />;
      case "feed": return <FeedView />;
      case "chat": return <ChatView />;
      case "games": return <GamesView />;
      case "gameslive": return <LiveGamesView />;
      case "profile": return <ProfileView />;
      case "help": return <HelpView />;
      case "support": return <SupportView />;
      case "orders": return <OrdersView />;
      case "dashboard": return <DashboardView />;
      case "employees": return <EmployeesView />;
      case "org": return <OrgView />;
      case "reports": return <ReportsView />;
      case "camera": return <CameraView />;
      case "reminders": return <RemindersView />;
      case "archive": return <ArchiveView />;
      case "ai": return <AIView />;
      case "bot": return <AIView />;
      case "ai-dept": return <AIDepartmentView />;
      case "ai-games": return <AIGamesView />;
      case "server-monitor": return <ServerMonitor />;
      case "security": return <SecurityView />;
      case "dataio": return <DataIOView />;
      case "settings": return <SettingsView />;
      case "permissions": return <PermsView />;
      case "audit": return <AuditView />;
      default: return <PunchView />;
    }
  };
  
  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-paper via-paper to-[#e8ecf1]">
      {/* Header */}
      <header className="h-16 bg-white/80 backdrop-blur-xl border-b border-line/50 flex items-center gap-3 px-4 lg:px-6 shrink-0 shadow-sm z-30">
        <Logo size={36} />
        <div className="min-w-0 flex-1">
          <b className="font-display text-base block leading-tight">
            СМЕНА<span className="text-accent">ЛАН</span>
          </b>
          <span className="text-[10px] font-bold text-mute uppercase tracking-wider hidden sm:block">
            {currentModule?.group} · {currentModule?.label}
          </span>
        </div>
        
        <OnlineDot />
        
        {/* Mobile menu button */}
        <button 
          className="lg:hidden w-10 h-10 rounded-xl bg-paper/50 grid place-items-center hover:bg-accent-soft transition"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <I n={mobileMenuOpen ? "x" : "menu"} size={20} />
        </button>
        
        {/* Profile button */}
        <button 
          className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-paper/50 transition"
          onClick={() => setView("profile")}
        >
          <Avatar u={me} size={36} />
          <div className="hidden md:block text-left">
            <b className="text-xs block leading-tight">{me.name.split(" ")[0]}</b>
            <span className="text-[9px] font-bold text-mute uppercase">
              {me.role === "superadmin" ? "Суперадмин" : me.role === "admin" ? "Админ" : me.role === "foreman" ? "Ст. смены" : me.role === "accountant" ? "Бухгалтер" : "Сотрудник"}
            </span>
          </div>
        </button>
      </header>
      
      <div className="flex-1 flex min-h-0">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:flex w-64 bg-white/60 backdrop-blur-xl border-r border-line/50 flex-col shrink-0 overflow-hidden">
          <nav className="flex-1 overflow-y-auto p-3 space-y-4">
            {NAV_GROUPS.map((group) => {
              const mods = allowed.filter((m) => m.group === group);
              if (mods.length === 0) return null;
              return (
                <div key={group}>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-mute px-3 mb-2">
                    {group}
                  </div>
                  <div className="space-y-0.5">
                    {mods.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setView(m.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-bold transition-all duration-200 ${
                          view === m.id 
                            ? "bg-gradient-to-r from-accent to-accent-deep text-white shadow-lg shadow-accent/30 scale-[1.02]" 
                            : "text-steel-700 hover:bg-paper/80 hover:scale-[1.01]"
                        }`}
                      >
                        <I n={m.icon} size={18} />
                        <span className="truncate">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
          
          {/* Sidebar footer */}
          <div className="p-3 border-t border-line/50 bg-white/40">
            <button 
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-bold text-steel-700 hover:bg-bad-soft hover:text-bad transition"
              onClick={logout}
            >
              <I n="logout" size={18} />
              Выйти
            </button>
          </div>
        </aside>
        
        {/* Mobile menu overlay */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
            <div className="absolute right-0 top-0 bottom-0 w-80 bg-white shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-line/50 flex items-center justify-between">
                <b className="font-display text-base">Меню</b>
                <button className="w-10 h-10 rounded-xl bg-paper/50 grid place-items-center" onClick={() => setMobileMenuOpen(false)}>
                  <I n="x" size={20} />
                </button>
              </div>
              <nav className="p-3 space-y-4">
                {NAV_GROUPS.map((group) => {
                  const mods = allowed.filter((m) => m.group === group);
                  if (mods.length === 0) return null;
                  return (
                    <div key={group}>
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-mute px-3 mb-2">
                        {group}
                      </div>
                      <div className="space-y-0.5">
                        {mods.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => { setView(m.id); setMobileMenuOpen(false); }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-bold transition-all ${
                              view === m.id 
                                ? "bg-gradient-to-r from-accent to-accent-deep text-white shadow-lg" 
                                : "text-steel-700 hover:bg-paper/80"
                            }`}
                          >
                            <I n={m.icon} size={18} />
                            <span className="truncate">{m.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </nav>
            </div>
          </div>
        )}
        
        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-7xl mx-auto">
            <Content />
          </div>
        </main>
      </div>
      
      {/* Mobile bottom nav */}
      <nav className="lg:hidden bg-white/80 backdrop-blur-xl border-t border-line/50 flex items-stretch justify-around px-1 py-2 shrink-0 shadow-lg z-30">
        {allowed.slice(0, 5).map((m) => (
          <button
            key={m.id}
            onClick={() => setView(m.id)}
            className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-all ${
              view === m.id ? "text-accent scale-105" : "text-steel-400"
            }`}
          >
            <I n={m.icon} size={20} />
            <span className="text-[9px] font-bold truncate max-w-[56px]">{m.label.split(" ")[0]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
