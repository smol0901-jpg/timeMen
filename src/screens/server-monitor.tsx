import React, { useEffect, useState } from "react";
import { useStore } from "../lib/store";
import { I, StatTile, Empty } from "../components/ui";

interface ServerHealth {
  ok: boolean;
  version?: number;
  uptime_sec?: number;
  db_kb?: number;
  backups?: { name: string; size_kb: number }[];
  ms?: number;
}

export default function ServerMonitor() {
  const { db, online } = useStore();
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const t0 = performance.now();
        const r = await fetch("./api/health", { cache: "no-store" });
        const j = await r.json();
        setHealth({ ...j, ms: Math.round(performance.now() - t0) });
      } catch {
        setHealth(null);
      }
      setLoading(false);
    };
    check();
    const t = setInterval(check, 10000);
    return () => clearInterval(t);
  }, []);

  const formatUptime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h} ч ${m} мин`;
  };

  return (
    <div className="grid gap-4 max-w-5xl mx-auto">
      <div className="card p-5 anim-rise" style={{ background: `linear-gradient(135deg, ${online ? "#e2f2ea" : "#fae8e5"} 0%, #fff 100%)` }}>
        <div className="flex items-center gap-3">
          <span className={`w-12 h-12 rounded-xl grid place-items-center ${online ? "bg-ok text-white" : "bg-bad text-white"}`}>
            <I n={online ? "check" : "warn"} size={24} />
          </span>
          <div className="flex-1">
            <b className="font-display text-base block">Мониторинг сервера</b>
            <span className="text-[12px] text-mute font-bold">
              {online ? "Сервер онлайн · работает стабильно" : "Сервер недоступен · проверьте подключение"}
            </span>
          </div>
          {health?.ms && (
            <div className="text-right">
              <div className="font-display text-2xl font-bold tnum">{health.ms}</div>
              <div className="text-[10px] font-extrabold uppercase text-mute">мс отклик</div>
            </div>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon="zap" tone={online ? "ok" : "bad"} label="Статус" val={online ? "Онлайн" : "Оффлайн"} sub={online ? "работает" : "недоступен"} />
        <StatTile icon="clock" tone="night" label="Аптайм" val={health?.uptime_sec ? formatUptime(health.uptime_sec) : "—"} sub="время работы" />
        <StatTile icon="layers" tone="accent" label="Размер БД" val={health?.db_kb ? `${(health.db_kb / 1024).toFixed(1)} МБ` : "—"} sub="SQLite база" />
        <StatTile icon="history" tone="ink" label="Резервных копий" val={String(health?.backups?.length || 0)} sub="автосохранения" />
      </div>

      <div className="card p-5">
        <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2">
          <I n="grid" size={16} />Статистика системы
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="rounded-xl bg-paper border border-line p-3">
            <div className="text-[10px] font-extrabold uppercase text-mute">Сотрудников</div>
            <div className="font-display text-xl font-bold tnum mt-1">{db.users.filter((u) => u.active && !u.archived).length}</div>
          </div>
          <div className="rounded-xl bg-paper border border-line p-3">
            <div className="text-[10px] font-extrabold uppercase text-mute">Отметок сегодня</div>
            <div className="font-display text-xl font-bold tnum mt-1">{db.punches.filter((p) => p.date === new Date().toISOString().slice(0, 10)).length}</div>
          </div>
          <div className="rounded-xl bg-paper border border-line p-3">
            <div className="text-[10px] font-extrabold uppercase text-mute">На смене сейчас</div>
            <div className="font-display text-xl font-bold tnum mt-1 text-ok">{db.punches.filter((p) => p.tout === null).length}</div>
          </div>
          <div className="rounded-xl bg-paper border border-line p-3">
            <div className="text-[10px] font-extrabold uppercase text-mute">Заявок ожидает</div>
            <div className="font-display text-xl font-bold tnum mt-1 text-warn">{db.requests.filter((r) => r.status === "pending").length}</div>
          </div>
          <div className="rounded-xl bg-paper border border-line p-3">
            <div className="text-[10px] font-extrabold uppercase text-mute">Записей на стене</div>
            <div className="font-display text-xl font-bold tnum mt-1">{db.posts.length}</div>
          </div>
          <div className="rounded-xl bg-paper border border-line p-3">
            <div className="text-[10px] font-extrabold uppercase text-mute">Снимков камер</div>
            <div className="font-display text-xl font-bold tnum mt-1">{db.camshots.length}</div>
          </div>
        </div>
      </div>

      {health?.backups && health.backups.length > 0 && (
        <div className="card p-5">
          <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2">
            <I n="download" size={16} />Последние резервные копии
          </h3>
          <div className="grid gap-2">
            {health.backups.slice(0, 5).map((b, i) => (
              <div key={i} className="flex items-center gap-3 border border-line rounded-lg px-3 py-2">
                <I n="file" size={15} className="text-night" />
                <span className="text-[12px] font-bold truncate flex-1">{b.name}</span>
                <span className="text-[11px] text-mute font-bold tnum">{(b.size_kb / 1024).toFixed(2)} МБ</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-5">
        <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2">
          <I n="info" size={16} />Информация о системе
        </h3>
        <div className="grid sm:grid-cols-2 gap-3 text-[12px]">
          <div className="rounded-xl bg-paper border border-line p-3">
            <b className="block mb-1">Версия приложения</b>
            <span className="text-mute font-bold">v{db.v}</span>
          </div>
          <div className="rounded-xl bg-paper border border-line p-3">
            <b className="block mb-1">Версия сервера</b>
            <span className="text-mute font-bold">{health?.version ? `v${health.version}` : "—"}</span>
          </div>
          <div className="rounded-xl bg-paper border border-line p-3">
            <b className="block mb-1">Организация</b>
            <span className="text-mute font-bold truncate">{db.settings.orgName}</span>
          </div>
          <div className="rounded-xl bg-paper border border-line p-3">
            <b className="block mb-1">Режим работы</b>
            <span className="text-mute font-bold">{online ? "Сетевой" : "Локальный"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
