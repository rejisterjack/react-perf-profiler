import { useSettingsStore } from '@/src/panel/stores/settingsStore';
import { Button } from '@/components/ui/button';
import { Sun, Moon, Monitor } from 'lucide-react';
import type { Theme } from '@/src/shared/types';

export function ThemeToggle() {
  const colorScheme = useSettingsStore((s) => s.colorScheme);
  const updateSetting = useSettingsStore((s) => s.updateSetting);

  const cycle = () => {
    const order: Theme[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(colorScheme) + 1) % order.length];
    updateSetting('colorScheme', next);
  };

  const Icon = colorScheme === 'dark' ? Moon : colorScheme === 'light' ? Sun : Monitor;

  return (
    <Button variant="ghost" size="icon-sm" onClick={cycle} title={`Theme: ${colorScheme}`}>
      <Icon className="size-4" />
    </Button>
  );
}
