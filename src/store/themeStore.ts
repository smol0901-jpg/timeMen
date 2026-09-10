import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      
      setTheme: (theme: Theme) => {
        set({ theme });
        
        // Применяем тему к document
        const root = document.documentElement;
        
        if (theme === 'dark') {
          root.classList.add('dark');
        } else if (theme === 'light') {
          root.classList.remove('dark');
        } else {
          // system
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          if (prefersDark) {
            root.classList.add('dark');
          } else {
            root.classList.remove('dark');
          }
        }
      },
      
      get isDark() {
        const { theme } = get();
        if (theme === 'dark') return true;
        if (theme === 'light') return false;
        // system
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
    }),
    {
      name: 'smenalan-theme',
    }
  )
);

// Инициализация темы при загрузке
if (typeof window !== 'undefined') {
  const theme = useThemeStore.getState().theme;
  useThemeStore.getState().setTheme(theme);
  
  // Слушаем изменения системной темы
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (useThemeStore.getState().theme === 'system') {
      if (e.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  });
}
