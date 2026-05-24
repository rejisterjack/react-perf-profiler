import { useEffect } from 'react';
import { useSettingsStore } from '@/src/panel/stores/settingsStore';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useSettingsStore((s) => s.colorScheme);

  useEffect(() => {
    const root = document.documentElement;
    if (colorScheme === 'dark') {
      root.classList.add('dark');
    } else if (colorScheme === 'light') {
      root.classList.remove('dark');
    } else {
      // System preference
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      root.classList.toggle('dark', mq.matches);
      const handler = (e: MediaQueryListEvent) => root.classList.toggle('dark', e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [colorScheme]);

  return <>{children}</>;
}
