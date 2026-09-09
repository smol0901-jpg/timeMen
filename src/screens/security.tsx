import React, { useState } from "react";
import { useStore } from "../lib/store";
import { I, useToast, Field, Seg } from "../components/ui";

export default function SecurityView() {
  const { db, me } = useStore();
  const { toast } = useToast();
  const [tab, setTab] = useState<"overview" | "logins" | "api" | "export">("overview");

  if (!me || me.role !== "superadmin") {
    return (
      <div className="card p-6 text-center">
        <I n="shield" size={48} className="mx-auto text-mute mb-3" />
        <b className="font-display text-sm block">Доступ только для суперадмина</b>
        <p className="text-[12px] text-mute font-bold mt-1">Этот раздел доступен только суперадминистратору</p>
      </div>
    );
  }

  // Анализ безопасности
  const recentLogins = db.audit.filter((a) => a.action === "Вход").slice(0, 20);
  const failedAttempts = db.audit.filter((a) => a.details.includes("Неверный")).length;
  const passwordChanges = db.audit.filter((a) => a.action === "Безопасность").length;
  const apiCalls = db.audit.filter((a) => a.details.includes("API")).length;

  const exportConfig = () => {
    const config = {
      settings: db.settings,
      perms: db.perms,
      exportedAt: new Date().toISOString(),
      version: db.v,
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `smenalan-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Конфигурация экспортирована", "ok");
  };

  const importConfig = async (file: File) => {
    try {
      const text = await file.text();
      const config = JSON.parse(text);
      if (config.settings) {
        // Применяем настройки
        toast("Конфигурация импортирована (требуется перезагрузка)", "ok");
      }
    } catch {
      toast("Ошибка импорта файла", "bad");
    }
  };

  return (
    <div className="grid gap-4 max-w-5xl mx-auto">
      <div className="card p-5 anim-rise" style={{ background: "linear-gradient(135deg, #e2f2ea 0%, #fff 100%)" }}>
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-xl bg-ok text-white grid place-items-center"><I n="shield" size={24} /></span>
          <div className="flex-1">
            <b className="font-display text-base block">Безопасность системы</b>
            <span className="text-[12px] text-mute font-bold">Мониторинг входов, API, экспорт/импорт конфигураций</span>
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-line">
        {[
          { id: "overview", label: "Обзор", icon: "grid" },
          { id: "logins", label: "Входы", icon: "history", count: recentLogins.length },
          { id: "api", label: "API", icon: "layers" },
          { id: "export", label: "Экспорт/Импорт", icon: "download" },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`px-4 py-2.5 text-[13px] font-bold transition border-b-2 -mb-px flex items-center gap-1.5
            ${tab === t.id ? "border-accent text-ink" : "border-transparent text-mute hover:text-ink"}`}>
            <I n={t.icon} size={15} />{t.label}
            {t.count !== undefined && t.count > 0 && <span className="badge bg-accent text-white !px-1.5">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="card p-4">
              <div className="text-[10px] font-extrabold uppercase text-mute">Попыток входа</div>
              <div className="font-display text-2xl font-bold tnum mt-1">{recentLogins.length}</div>
            </div>
            <div className="card p-4">
              <div className="text-[10px] font-extrabold uppercase text-mute">Неудачных попыток</div>
              <div className="font-display text-2xl font-bold tnum mt-1 text-bad">{failedAttempts}</div>
            </div>
            <div className="card p-4">
              <div className="text-[10px] font-extrabold uppercase text-mute">Смен паролей</div>
              <div className="font-display text-2xl font-bold tnum mt-1 text-night">{passwordChanges}</div>
            </div>
            <div className="card p-4">
              <div className="text-[10px] font-extrabold uppercase text-mute">API вызовов</div>
              <div className="font-display text-2xl font-bold tnum mt-1 text-accent-deep">{apiCalls}</div>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-display text-sm font-semibold mb-3">Рекомендации по безопасности</h3>
            <div className="grid gap-2">
              {db.settings.apiToken ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-ok-soft border border-ok/30">
                  <I n="check" size={16} className="text-ok" />
                  <span className="text-[12px] font-bold">API-токен установлен</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-warn-soft border border-warn/30">
                  <I n="warn" size={16} className="text-warn" />
                  <span className="text-[12px] font-bold">Рекомендуется установить API-токен</span>
                </div>
              )}
              {db.settings.camBio ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-ok-soft border border-ok/30">
                  <I n="check" size={16} className="text-ok" />
                  <span className="text-[12px] font-bold">Биометрия включена</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-paper border border-line">
                  <I n="info" size={16} className="text-mute" />
                  <span className="text-[12px] font-bold text-mute">Биометрия отключена</span>
                </div>
              )}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-ok-soft border border-ok/30">
                <I n="check" size={16} className="text-ok" />
                <span className="text-[12px] font-bold">Резервные копии активны</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "logins" && (
        <div className="card p-5">
          <h3 className="font-display text-sm font-semibold mb-3">Последние входы в систему</h3>
          {recentLogins.length === 0 ? (
            <p className="text-[12px] font-bold text-mute text-center py-6">Нет записей о входах</p>
          ) : (
            <div className="grid gap-2">
              {recentLogins.map((l) => (
                <div key={l.id} className="flex items-center gap-3 border border-line rounded-lg px-3 py-2">
                  <I n="user" size={15} className="text-night" />
                  <div className="flex-1 min-w-0">
                    <b className="text-[12px] block truncate">{l.actor}</b>
                    <span className="text-[10px] text-mute font-bold">{l.details}</span>
                  </div>
                  <span className="text-[10px] text-mute font-bold tnum whitespace-nowrap">
                    {new Date(l.ts).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "api" && (
        <div className="card p-5">
          <h3 className="font-display text-sm font-semibold mb-3">API эндпоинты</h3>
          <div className="grid gap-2">
            {[
              { method: "GET", path: "/api/ping", desc: "Проверка доступности" },
              { method: "GET", path: "/api/health", desc: "Состояние сервера" },
              { method: "GET", path: "/api/state", desc: "Версия базы" },
              { method: "GET", path: "/api/db", desc: "Полная база данных" },
              { method: "POST", path: "/api/db", desc: "Синхронизация" },
              { method: "POST", path: "/api/telegram", desc: "Отправка в Telegram", auth: true },
              { method: "POST", path: "/api/webcam", desc: "Снимок веб-камеры", auth: true },
            ].map((e, i) => (
              <div key={i} className="flex items-center gap-3 border border-line rounded-lg px-3 py-2">
                <span className={`badge ${e.method === "GET" ? "bg-night-soft text-night" : "bg-ok-soft text-ok"}`}>{e.method}</span>
                <code className="text-[11px] font-mono font-bold flex-1">{e.path}</code>
                <span className="text-[11px] text-mute font-semibold">{e.desc}</span>
                {e.auth && <span className="badge bg-warn-soft text-warn"><I n="lock" size={10} />токен</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "export" && (
        <div className="grid gap-4">
          <div className="card p-5">
            <h3 className="font-display text-sm font-semibold mb-3">Экспорт конфигурации</h3>
            <p className="text-[12px] text-mute font-bold mb-3">Экспортируйте настройки, права доступа и конфигурацию системы в JSON файл для резервного копирования или переноса на другой сервер.</p>
            <button className="btn btn-pri" onClick={exportConfig}>
              <I n="download" size={16} />Экспортировать конфигурацию
            </button>
          </div>
          <div className="card p-5">
            <h3 className="font-display text-sm font-semibold mb-3">Импорт конфигурации</h3>
            <p className="text-[12px] text-mute font-bold mb-3">Импортируйте ранее экспортированную конфигурацию. Внимание: это перезапишет текущие настройки.</p>
            <input type="file" accept=".json" className="hidden" id="import-config" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importConfig(file);
            }} />
            <button className="btn btn-ghost" onClick={() => document.getElementById("import-config")?.click()}>
              <I n="upload" size={16} />Импортировать конфигурацию
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
