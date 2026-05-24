import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Puzzle, Trash2, Upload } from 'lucide-react';

interface PluginEntry {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
}

interface PluginSettingsPanelProps {
  plugins: PluginEntry[];
  onTogglePlugin: (id: string, enabled: boolean) => void;
  onRemovePlugin: (id: string) => void;
  onLoadPlugin: (code: string) => void;
}

function PluginSettingsPanel({ plugins, onTogglePlugin, onRemovePlugin, onLoadPlugin }: PluginSettingsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const code = await file.text();
      onLoadPlugin(code);
    } catch { /* ignore */ }
    setLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Plugins</h3>
        <div>
          <input ref={fileInputRef} type="file" accept=".js" onChange={handleFileSelect} className="hidden" />
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => fileInputRef.current?.click()} disabled={loading}>
            <Upload className="size-3 mr-1" />
            {loading ? 'Loading...' : 'Load Plugin'}
          </Button>
        </div>
      </div>

      {plugins.length === 0 ? (
        <Card>
          <CardContent className="p-4 text-center text-muted-foreground">
            <Puzzle className="size-6 mx-auto mb-2 opacity-50" />
            <p className="text-xs">No plugins installed</p>
            <p className="text-[10px] mt-1">Load a .js plugin file to extend functionality</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {plugins.map((plugin) => (
            <Card key={plugin.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium truncate">{plugin.name}</span>
                      <Badge variant="secondary" className="text-[9px] shrink-0">{plugin.version}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{plugin.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">by {plugin.author}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={plugin.enabled} onCheckedChange={(v) => onTogglePlugin(plugin.id, v)} />
                    <Button variant="ghost" size="icon-sm" onClick={() => onRemovePlugin(plugin.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export { PluginSettingsPanel };
export type { PluginEntry };
