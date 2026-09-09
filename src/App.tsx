import React, { useState } from "react";
import { StoreProvider, useStore } from "./lib/store";
import { ToastProvider } from "./components/ui";
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
import { I, Logo, Avatar, OnlineDot } from "./components/ui";
import { MODULES, ModuleId } from "./lib/types";

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
  
  if (!me) return null;
  
  const allowed = MODULES.filter((m) => {
    if (me.role === "superadmin") return true;
    if (me.role === "admin" || me.role === "foreman") {
      return m.group !== "Система" || ["dataio", "settings", "audit"].includes(m.id);
    }
    return m.group === "Работа" || m.group === "Общение" || m.group === "Личное";
  });
  
  const currentModule = MODULES.find((m) => m.id === view);
  
  const Content = () => {
    switch (view) {
      case "punch": return <PunchView />;
      case "stats": return <StatsView />;
      case "schedule": return me.role === "employee" ? <ScheduleView /> : <ScheduleEditor />;
      case "requests": return <RequestsView />;
      case "feed": return <FeedView />;
      case "chat": return <ChatView />;
      case "games": return <GamesView />;
      case "profile": return <ProfileView />;
      case "help": return <HelpView />;
      case "dashboard": return <DashboardView />;
      case "employees": return <EmployeesView />;
      case "ai": return <AIView />;
      case "support": return <SupportView />;
      case "orders": return <OrdersView />;
      case "server-monitor": return <ServerMonitor />;
      case "security": return <SecurityView />;
      default: return <div className="card p-6">Модуль в разработке</div>;
    }
  };
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="h-14 bg-surface border-b border-line flex items-center gap-3 px-4 shrink-0">
        <Logo size={32} />
        <div className="min-w-0 flex-1">
          <b className="font-display text-sm block leading-tight truncate">
            СМЕНА<span className="text-accent">ЛАН</span>
          </b>
          <span className="text-[10px] font-bold text-mute uppercase tracking-wider">
            {currentModule?.label}
          </span>
        </div>
        <OnlineDot />
        <button 
          className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-lg hover:bg-paper transition"
          onClick={() => setView("profile")}
        >
          <Avatar u={me} size={32} />
          <span className="hidden md:block text-left">
            <b className="text-xs block leading-tight">{me.name.split(" ")[0]}</b>
          </span>
        </button>
      </header>
      
      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <aside className="w-56 bg-steel-900 text-paper flex flex-col shrink-0 hidden md:flex">
          <nav className="flex-1 overflow-y-auto p-3">
            {["Работа", "Общение", "Личное", "Управление", "Интеллект"].map((group) => {
              const mods = allowed.filter((m) => m.group === group);
              if (mods.length === 0) return null;
              return (
                <div key={group} className="mb-4">
                  <div className="text-[9px] font-extrabold uppercase tracking-wider text-steel-400 px-3 mb-2">
                    {group}
                  </div>
                  {mods.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setView(m.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-bold transition ${
                        view === m.id ? "bg-accent text-white" : "text-steel-200 hover:bg-steel-800"
                      }`}
                    >
                      <I n={m.icon} size={16} />
                      <span className="truncate">{m.label}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </nav>
          <div className="p-3 border-t border-steel-800">
            <button 
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-bold text-steel-200 hover:bg-steel-800 transition"
              onClick={logout}
            >
              <I n="logout" size={16} />
              Выйти
            </button>
          </div>
        </aside>
        
        {/* Content area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-paper">
          <div className="max-w-5xl mx-auto">
            <Content />
          </div>
        </main>
      </div>
      
      {/* Mobile bottom nav */}
      <nav className="md:hidden bg-steel-900 text-paper flex items-stretch justify-around px-1 py-2 border-t border-steel-700 shrink-0">
        {allowed.slice(0, 5).map((m) => (
          <button
            key={m.id}
            onClick={() => setView(m.id)}
            className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-bold ${
              view === m.id ? "text-accent" : "text-steel-200"
            }`}
          >
            <I n={m.icon} size={18} />
            <span className="truncate max-w-[56px]">{m.label.split(" ")[0]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
