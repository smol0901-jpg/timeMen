import React, { useState, useEffect, useRef } from "react";
import { I } from "./ui";
import { ModuleId } from "../lib/types";

interface QuickAction {
  label: string;
  icon: string;
  action: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  actions: QuickAction[];
  onClose: () => void;
}

export function ContextMenu({ x, y, actions, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Adjust position to keep menu in viewport
  const adjustedX = Math.min(x, window.innerWidth - 250);
  const adjustedY = Math.min(y, window.innerHeight - actions.length * 40 - 20);

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] bg-white/95 backdrop-blur-xl border border-line rounded-xl shadow-2xl py-2 min-w-[220px] anim-pop"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {actions.map((action, i) => (
        <button
          key={i}
          onClick={() => {
            action.action();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-[13px] font-bold text-steel-700 hover:bg-accent-soft hover:text-accent-deep transition"
        >
          <I n={action.icon} size={16} />
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
}

// Быстрые действия для каждой вкладки
export function getQuickActions(
  moduleId: ModuleId,
  actions: {
    onRefresh?: () => void;
    onSettings?: () => void;
    onNew?: () => void;
    onExport?: () => void;
    onHelp?: () => void;
  }
): QuickAction[] {
  const baseActions: QuickAction[] = [];

  switch (moduleId) {
    case "punch":
      baseActions.push(
        { label: "Начать смену", icon: "play", action: () => {} },
        { label: "Завершить смену", icon: "stop", action: () => {} },
        { label: "Обновить", icon: "history", action: actions.onRefresh || (() => {}) }
      );
      break;
    case "stats":
      baseActions.push(
        { label: "Экспорт в Excel", icon: "xls", action: actions.onExport || (() => {}) },
        { label: "Обновить", icon: "history", action: actions.onRefresh || (() => {}) }
      );
      break;
    case "schedule":
      baseActions.push(
        { label: "Новая смена", icon: "plus", action: actions.onNew || (() => {}) },
        { label: "Экспорт графика", icon: "xls", action: actions.onExport || (() => {}) },
        { label: "Обновить", icon: "history", action: actions.onRefresh || (() => {}) }
      );
      break;
    case "requests":
      baseActions.push(
        { label: "Новая заявка", icon: "plus", action: actions.onNew || (() => {}) },
        { label: "Обновить", icon: "history", action: actions.onRefresh || (() => {}) }
      );
      break;
    case "feed":
      baseActions.push(
        { label: "Новая запись", icon: "plus", action: actions.onNew || (() => {}) },
        { label: "Обновить ленту", icon: "history", action: actions.onRefresh || (() => {}) }
      );
      break;
    case "chat":
      baseActions.push(
        { label: "Новый чат", icon: "plus", action: actions.onNew || (() => {}) },
        { label: "Обновить", icon: "history", action: actions.onRefresh || (() => {}) }
      );
      break;
    case "games":
      baseActions.push(
        { label: "Новая игра", icon: "plus", action: actions.onNew || (() => {}) },
        { label: "Таблица лидеров", icon: "chart", action: () => {} }
      );
      break;
    case "profile":
      baseActions.push(
        { label: "Редактировать профиль", icon: "edit", action: actions.onSettings || (() => {}) },
        { label: "Сменить пароль", icon: "lock", action: () => {} }
      );
      break;
    case "dashboard":
      baseActions.push(
        { label: "Обновить дашборд", icon: "history", action: actions.onRefresh || (() => {}) },
        { label: "Настройки", icon: "gear", action: actions.onSettings || (() => {}) }
      );
      break;
    case "employees":
      baseActions.push(
        { label: "Добавить сотрудника", icon: "plus", action: actions.onNew || (() => {}) },
        { label: "Экспорт списка", icon: "xls", action: actions.onExport || (() => {}) },
        { label: "Обновить", icon: "history", action: actions.onRefresh || (() => {}) }
      );
      break;
    case "org":
      baseActions.push(
        { label: "Новый цех", icon: "plus", action: actions.onNew || (() => {}) },
        { label: "Обновить", icon: "history", action: actions.onRefresh || (() => {}) }
      );
      break;
    case "reports":
      baseActions.push(
        { label: "Создать отчёт", icon: "plus", action: actions.onNew || (() => {}) },
        { label: "Экспорт", icon: "xls", action: actions.onExport || (() => {}) }
      );
      break;
    case "ai":
      baseActions.push(
        { label: "Запустить анализ", icon: "play", action: () => {} },
        { label: "Настройки ИИ", icon: "gear", action: actions.onSettings || (() => {}) }
      );
      break;
    case "bot":
      baseActions.push(
        { label: "Новый скрипт", icon: "plus", action: actions.onNew || (() => {}) },
        { label: "Обновить", icon: "history", action: actions.onRefresh || (() => {}) }
      );
      break;
    case "ai-dept":
      baseActions.push(
        { label: "Новая задача", icon: "plus", action: actions.onNew || (() => {}) },
        { label: "Обновить", icon: "history", action: actions.onRefresh || (() => {}) }
      );
      break;
    case "server-monitor":
      baseActions.push(
        { label: "Перезапустить сервер", icon: "history", action: () => {} },
        { label: "Настройки", icon: "gear", action: actions.onSettings || (() => {}) }
      );
      break;
    case "security":
      baseActions.push(
        { label: "Проверить безопасность", icon: "shield", action: () => {} },
        { label: "Экспорт логов", icon: "xls", action: actions.onExport || (() => {}) }
      );
      break;
    case "dataio":
      baseActions.push(
        { label: "Резервная копия", icon: "download", action: () => {} },
        { label: "Восстановить", icon: "upload", action: () => {} }
      );
      break;
    case "settings":
      baseActions.push(
        { label: "Сохранить настройки", icon: "check", action: () => {} },
        { label: "Сбросить", icon: "history", action: () => {} }
      );
      break;
    case "permissions":
      baseActions.push(
        { label: "Обновить права", icon: "history", action: actions.onRefresh || (() => {}) }
      );
      break;
    case "audit":
      baseActions.push(
        { label: "Экспорт журналов", icon: "xls", action: actions.onExport || (() => {}) },
        { label: "Обновить", icon: "history", action: actions.onRefresh || (() => {}) }
      );
      break;
    case "support":
      baseActions.push(
        { label: "Новое обращение", icon: "plus", action: actions.onNew || (() => {}) },
        { label: "Обновить", icon: "history", action: actions.onRefresh || (() => {}) }
      );
      break;
    case "orders":
      baseActions.push(
        { label: "Новый заказ", icon: "plus", action: actions.onNew || (() => {}) },
        { label: "Экспорт", icon: "xls", action: actions.onExport || (() => {}) }
      );
      break;
    case "camera":
      baseActions.push(
        { label: "Сделать снимок", icon: "camera", action: () => {} },
        { label: "Настройки камеры", icon: "gear", action: actions.onSettings || (() => {}) }
      );
      break;
    case "reminders":
      baseActions.push(
        { label: "Новое напоминание", icon: "plus", action: actions.onNew || (() => {}) },
        { label: "Обновить", icon: "history", action: actions.onRefresh || (() => {}) }
      );
      break;
    case "archive":
      baseActions.push(
        { label: "Обновить", icon: "history", action: actions.onRefresh || (() => {}) }
      );
      break;
    case "ai-games":
      baseActions.push(
        { label: "Новая игра с ИИ", icon: "plus", action: actions.onNew || (() => {}) }
      );
      break;
    case "production":
      baseActions.push(
        { label: "Новая запись", icon: "plus", action: actions.onNew || (() => {}) },
        { label: "Экспорт", icon: "xls", action: actions.onExport || (() => {}) }
      );
      break;
    default:
      baseActions.push(
        { label: "Обновить", icon: "history", action: actions.onRefresh || (() => {}) },
        { label: "Помощь", icon: "help", action: actions.onHelp || (() => {}) }
      );
  }

  // Общие действия для всех вкладок
  baseActions.push(
    { label: "Помощь", icon: "help", action: actions.onHelp || (() => {}) }
  );

  return baseActions;
}
