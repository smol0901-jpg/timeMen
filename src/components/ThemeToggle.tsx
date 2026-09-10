import React from 'react';
import { I } from './ui';
import { useThemeStore } from '../store/themeStore';

export function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();

  const themes = [
    { id: 'light' as const, label: 'Светлая', icon: 'sun' },
    { id: 'dark' as const, label: 'Тёмная', icon: 'moon' },
    { id: 'system' as const, label: 'Системная', icon: 'monitor' },
  ];

  return (
    <div className="flex items-center gap-1 bg-paper/50 border border-line rounded-xl p-1">
      {themes.map((t) => (
        <button
          key={t.id}
          onClick={() => setTheme(t.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            theme === t.id
              ? 'bg-accent text-white shadow-sm'
              : 'text-mute hover:text-ink hover:bg-paper'
          }`}
          title={t.label}
        >
          <I n={t.icon} size={14} />
          <span className="hidden sm:inline">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
