import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  Play,
  Square,
  Download,
  Settings2,
  Sun,
  Moon,
  Sparkles,
  Globe,
  Cpu,
  Palette,
  Type,
  Gauge,
  Layers,
  Box,
  Code2,
  Image,
  FileCode,
  LayoutGrid,
  Activity,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

type DetectionStatus = 'checking' | 'detected' | 'not-detected';

interface SessionData {
  commitCount: number;
  avgDuration: number;
  isRecording: boolean;
}

interface FrameworkInfo {
  name: string;
  version?: string;
  confidence: 'high' | 'medium' | 'low';
}

interface TechStackData {
  frameworks: FrameworkInfo[];
  meta: {
    title: string;
    description: string;
    viewport: string;
    themeColor: string | undefined;
    ogImage: string | undefined;
    ogTitle: string | undefined;
    ogDescription: string | undefined;
  };
  fonts: Array<{ family: string; source: string }>;
  colorPalette: string[];
  cssTools: FrameworkInfo[];
  buildTools: string[];
  performance: {
    domSize: number;
    scriptCount: number;
    stylesheetCount: number;
    imageCount: number;
  };
}

function sendMessage<T>(message: object): Promise<T> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response: T) => {
        resolve(response);
      });
    } catch {
      resolve(undefined as T);
    }
  });
}

function App() {
  const [dark, setDark] = useState(false);
  const [autoStart, setAutoStart] = useState(false);
  const [maxCommits, setMaxCommits] = useState(50);
  const [detectionStatus, setDetectionStatus] = useState<DetectionStatus>('checking');
  const [isRecording, setIsRecording] = useState(false);
  const [commitCount, setCommitCount] = useState(0);
  const [avgDuration, setAvgDuration] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [techStack, setTechStack] = useState<TechStackData | null>(null);
  const [loadingTechStack, setLoadingTechStack] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  const checkReact = useCallback(async () => {
    setDetectionStatus('checking');
    try {
      const response = await sendMessage<{ hasReact: boolean }>({ type: 'CHECK_REACT' });
      setDetectionStatus(response?.hasReact ? 'detected' : 'not-detected');
    } catch {
      setDetectionStatus('not-detected');
    }
  }, []);

  const fetchTechStack = useCallback(async () => {
    setLoadingTechStack(true);
    try {
      const response = await sendMessage<TechStackData | null>({ type: 'DETECT_TECH_STACK' });
      setTechStack(response);
    } catch {
      setTechStack(null);
    } finally {
      setLoadingTechStack(false);
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const response = await sendMessage<{ sessions: SessionData[] }>({ type: 'GET_ACTIVE_SESSIONS' });
      const active = response?.sessions?.find((s) => s.isRecording);
      if (active) {
        setIsRecording(true);
        setCommitCount(active.commitCount);
        setAvgDuration(active.avgDuration);
      }
    } catch {
      // no active sessions
    }
  }, []);

  useEffect(() => {
    checkReact();
    fetchTechStack();
    fetchSessions();
  }, [checkReact, fetchTechStack, fetchSessions]);

  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(fetchSessions, 2000);
    return () => clearInterval(interval);
  }, [isRecording, fetchSessions]);

  const handleToggleRecording = async () => {
    if (isRecording) {
      await sendMessage({ type: 'STOP_PROFILING' });
      setIsRecording(false);
    } else {
      await sendMessage({ type: 'START_PROFILING' });
      setIsRecording(true);
      setCommitCount(0);
      setAvgDuration(0);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const profileData = await sendMessage<{
        commits?: unknown[];
        analysisResults?: unknown;
        performanceScore?: number;
      }>({ type: 'EXPORT_PROFILE' }).catch(() => null);

      const exportPayload = profileData?.commits
        ? { ...profileData, exportedAt: new Date().toISOString(), source: 'react-perf-profiler' }
        : {
            commitCount,
            avgDuration,
            exportedAt: new Date().toISOString(),
            source: 'react-perf-profiler',
            note: 'For full profile data with fiber details, export from the DevTools panel',
          };

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `react-profile-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const performanceScore =
    avgDuration === 0 ? 100 : Math.max(0, Math.min(100, Math.round(100 - avgDuration * 2)));

  const domSizeRating = (size: number) => {
    if (size < 800) return { label: 'Good', color: 'text-foreground' };
    if (size < 1500) return { label: 'Fair', color: 'text-muted-foreground' };
    return { label: 'Heavy', color: 'text-muted-foreground' };
  };

  const statusDot = {
    checking: 'bg-foreground/30 animate-pulse',
    detected: 'bg-foreground',
    'not-detected': 'bg-foreground/20',
  }[detectionStatus];

  const statusLabel = {
    checking: 'Checking...',
    detected: 'React detected',
    'not-detected': 'React not found',
  }[detectionStatus];

  return (
    <TooltipProvider>
      <div className="w-[380px] select-none font-sans">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Activity className="size-3.5 text-foreground" />
            <span className="text-sm font-semibold tracking-tight">RPP</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
              v1.0
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setDark(!dark)}
                >
                  {dark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle theme</TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* Status + Actions */}
        <div className="px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn('size-1.5 rounded-full shrink-0', statusDot)} />
            <span className="text-xs text-muted-foreground">{statusLabel}</span>
            {isRecording && (
              <>
                <Separator orientation="vertical" className="h-3" />
                <span className="flex items-center gap-1.5">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-foreground/50" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-foreground" />
                  </span>
                  <span className="text-xs font-medium">{commitCount} commits</span>
                  {avgDuration > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      {avgDuration.toFixed(1)}ms avg
                    </span>
                  )}
                  {commitCount > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      {performanceScore} score
                    </span>
                  )}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isRecording ? 'destructive' : 'default'}
                  size="xs"
                  onClick={handleToggleRecording}
                  disabled={detectionStatus !== 'detected'}
                  className="gap-1"
                >
                  {isRecording ? <Square className="size-3" /> : <Play className="size-3" />}
                  <span className="text-[11px]">{isRecording ? 'Stop' : 'Record'}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isRecording ? 'Stop profiling' : 'Start profiling'}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={handleExport}
                  disabled={commitCount === 0 || exporting}
                >
                  <Download className={cn('size-3.5', exporting && 'animate-bounce')} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export profile</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                      if (tabs[0]?.id) {
                        chrome.tabs.sendMessage(tabs[0].id, { type: 'OPEN_DEVTOOLS_PANEL' });
                      }
                    });
                    window.close();
                  }}
                >
                  <Sparkles className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open DevTools panel</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <Separator />

        {/* Tech Stack Tabs */}
        <section className="px-4 pt-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList variant="line" className="w-full h-7">
              <TabsTrigger value="overview" className="text-[11px] flex-1 gap-1">
                <Layers className="size-3" />
                Stack
              </TabsTrigger>
              <TabsTrigger value="design" className="text-[11px] flex-1 gap-1">
                <Palette className="size-3" />
                Design
              </TabsTrigger>
              <TabsTrigger value="performance" className="text-[11px] flex-1 gap-1">
                <Gauge className="size-3" />
                Perf
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[310px] mt-1 -mx-1 px-1">

              {/* ===== STACK TAB ===== */}
              <TabsContent value="overview" className="mt-0 space-y-3 pb-4">
                {loadingTechStack ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    <span className="text-xs">Detecting tech stack...</span>
                  </div>
                ) : techStack ? (
                  <>
                    {techStack.meta.title && (
                      <div className="space-y-1.5">
                        <SectionLabel icon={Globe} label="Page Info" />
                        <div className="rounded-lg border border-border bg-card px-3 py-2.5 space-y-1">
                          <p className="text-xs font-medium truncate">{techStack.meta.title}</p>
                          {techStack.meta.description && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2">
                              {techStack.meta.description}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {techStack.frameworks.length > 0 && (
                      <div className="space-y-1.5">
                        <SectionLabel icon={Cpu} label="Frameworks" />
                        <div className="flex flex-wrap gap-1">
                          {techStack.frameworks.map((fw) => (
                            <Badge key={fw.name} variant="outline" className="gap-1 text-[11px] px-1.5 py-0">
                              {fw.name}
                              {fw.version && (
                                <span className="opacity-50 font-mono text-[10px]">
                                  {fw.version.startsWith('v') ? fw.version : `v${fw.version}`}
                                </span>
                              )}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {techStack.cssTools.length > 0 && (
                      <div className="space-y-1.5">
                        <SectionLabel icon={LayoutGrid} label="CSS Frameworks" />
                        <div className="flex flex-wrap gap-1">
                          {techStack.cssTools.map((tool) => (
                            <Badge key={tool.name} variant="outline" className="gap-1 text-[11px] px-1.5 py-0">
                              {tool.name}
                              {tool.version && (
                                <span className="opacity-50 font-mono text-[10px]">
                                  {tool.version.startsWith('v') ? tool.version : `v${tool.version}`}
                                </span>
                              )}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {techStack.buildTools.length > 0 && (
                      <div className="space-y-1.5">
                        <SectionLabel icon={Code2} label="Build Tools" />
                        <div className="flex flex-wrap gap-1">
                          {techStack.buildTools.map((tool) => (
                            <Badge key={tool} variant="outline" className="text-[11px] px-1.5 py-0">
                              {tool}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {techStack.fonts.length > 0 && (
                      <div className="space-y-1.5">
                        <SectionLabel icon={Type} label="Fonts" />
                        <div className="rounded-lg border border-border bg-card px-3 py-2 space-y-1">
                          {techStack.fonts.slice(0, 6).map((font) => (
                            <div key={font.family} className="flex items-center justify-between">
                              <span className="text-[11px] truncate">{font.family}</span>
                              <span className="text-[10px] text-muted-foreground ml-2 shrink-0">{font.source}</span>
                            </div>
                          ))}
                          {techStack.fonts.length > 6 && (
                            <p className="text-[10px] text-muted-foreground">
                              +{techStack.fonts.length - 6} more
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {techStack.frameworks.length === 0 && techStack.cssTools.length === 0 && techStack.buildTools.length === 0 && (
                      <EmptyState icon={Box} label="No frameworks detected" hint="Try navigating to a web application" />
                    )}
                  </>
                ) : (
                  <EmptyState icon={Globe} label="Unable to detect tech stack" hint="Make sure you're on a web page" />
                )}
              </TabsContent>

              {/* ===== DESIGN TAB ===== */}
              <TabsContent value="design" className="mt-0 space-y-3 pb-4">
                {loadingTechStack ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    <span className="text-xs">Detecting design info...</span>
                  </div>
                ) : techStack ? (
                  <>
                    {techStack.colorPalette.length > 0 && (
                      <div className="space-y-1.5">
                        <SectionLabel icon={Palette} label="Color Palette" />
                        <div className="rounded-lg border border-border bg-card px-3 py-2.5">
                          <div className="grid grid-cols-8 gap-1">
                            {techStack.colorPalette.slice(0, 24).map((color) => (
                              <div
                                key={color}
                                className="size-6 rounded border border-border/50 cursor-pointer transition-transform hover:scale-110"
                                style={{ backgroundColor: color }}
                                title={color}
                              />
                            ))}
                          </div>
                          {techStack.colorPalette.length > 24 && (
                            <p className="text-[10px] text-muted-foreground mt-1.5">
                              +{techStack.colorPalette.length - 24} more
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {techStack.meta.themeColor && (
                      <div className="space-y-1.5">
                        <SectionLabel label="Theme Color" />
                        <div className="rounded-lg border border-border bg-card px-3 py-2 flex items-center gap-2">
                          <div
                            className="size-5 rounded border border-border/50"
                            style={{ backgroundColor: techStack.meta.themeColor }}
                          />
                          <span className="text-[11px] font-mono text-muted-foreground">{techStack.meta.themeColor}</span>
                        </div>
                      </div>
                    )}

                    {techStack.meta.ogImage && (
                      <div className="space-y-1.5">
                        <SectionLabel icon={Image} label="OG Image" />
                        <div className="rounded-lg border border-border bg-card p-2">
                          <img
                            src={techStack.meta.ogImage}
                            alt="OG preview"
                            className="w-full h-auto rounded object-cover max-h-[100px]"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        </div>
                      </div>
                    )}

                    {techStack.fonts.length > 0 && (
                      <div className="space-y-1.5">
                        <SectionLabel icon={Type} label="Typography" />
                        <div className="rounded-lg border border-border bg-card px-3 py-2 space-y-2">
                          {techStack.fonts.slice(0, 4).map((font) => (
                            <div key={font.family}>
                              <p className="text-sm" style={{ fontFamily: font.family }}>{font.family}</p>
                              <p className="text-[10px] text-muted-foreground">{font.source}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {techStack.colorPalette.length === 0 && techStack.fonts.length === 0 && !techStack.meta.themeColor && (
                      <EmptyState icon={Palette} label="No design info detected" />
                    )}
                  </>
                ) : (
                  <EmptyState icon={Palette} label="No design data available" />
                )}
              </TabsContent>

              {/* ===== PERFORMANCE TAB ===== */}
              <TabsContent value="performance" className="mt-0 space-y-3 pb-4">
                {loadingTechStack ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    <span className="text-xs">Analyzing page...</span>
                  </div>
                ) : techStack ? (
                  <>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <SectionLabel icon={FileCode} label="DOM Size" />
                        <span className={cn('text-[11px] font-medium', domSizeRating(techStack.performance.domSize).color)}>
                          {domSizeRating(techStack.performance.domSize).label}
                        </span>
                      </div>
                      <div className="rounded-lg border border-border bg-card px-3 py-2.5 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Elements</span>
                          <span className="font-mono font-medium">{techStack.performance.domSize.toLocaleString()}</span>
                        </div>
                        <Progress value={Math.min(100, (techStack.performance.domSize / 2000) * 100)} className="h-1" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <SectionLabel icon={Layers} label="Resources" />
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { icon: FileCode, count: techStack.performance.scriptCount, label: 'Scripts' },
                          { icon: Code2, count: techStack.performance.stylesheetCount, label: 'Styles' },
                          { icon: Image, count: techStack.performance.imageCount, label: 'Images' },
                          { icon: Globe, count: techStack.fonts.length, label: 'Fonts' },
                        ].map(({ icon: Icon, count, label }) => (
                          <div key={label} className="rounded-lg border border-border bg-card px-3 py-2 flex items-center gap-2">
                            <Icon className="size-3.5 text-muted-foreground shrink-0" />
                            <div>
                              <p className="text-xs font-medium leading-none">{count}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {isRecording && commitCount > 0 && (
                      <div className="space-y-1.5">
                        <SectionLabel icon={Gauge} label="Profiling Stats" />
                        <div className="rounded-lg border border-border bg-card px-3 py-2.5 space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Total commits</span>
                            <span className="font-mono font-medium">{commitCount}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Avg duration</span>
                            <span className="font-mono font-medium">{avgDuration.toFixed(2)}ms</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Score</span>
                            <span className="font-mono font-medium">{performanceScore}/100</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <EmptyState icon={Gauge} label="No performance data available" />
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </section>

        {/* Footer */}
        <footer className="px-4 py-2 border-t border-border flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            shadcn + WXT
          </p>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon-xs" className="text-muted-foreground">
                <Settings2 className="size-3" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Settings</DialogTitle>
                <DialogDescription>Configure profiler preferences.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Dark Mode</Label>
                    <p className="text-xs text-muted-foreground">Switch appearance</p>
                  </div>
                  <Switch checked={dark} onCheckedChange={setDark} size="sm" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Auto-start Profiling</Label>
                    <p className="text-xs text-muted-foreground">Begin recording on React pages</p>
                  </div>
                  <Switch checked={autoStart} onCheckedChange={setAutoStart} size="sm" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Max Commits</Label>
                    <p className="text-xs text-muted-foreground">Buffer size: {maxCommits}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="icon-xs"
                      onClick={() => setMaxCommits(Math.max(10, maxCommits - 10))}
                    >
                      -
                    </Button>
                    <span className="text-xs font-medium tabular-nums w-6 text-center">
                      {maxCommits}
                    </span>
                    <Button
                      variant="outline"
                      size="icon-xs"
                      onClick={() => setMaxCommits(Math.min(500, maxCommits + 10))}
                    >
                      +
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </footer>
      </div>
    </TooltipProvider>
  );
}

function SectionLabel({ icon: Icon, label }: { icon?: typeof Layers; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
      {Icon && <Icon className="size-3" />}
      {label}
    </div>
  );
}

function EmptyState({ icon: Icon, label, hint }: { icon: typeof Box; label: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
      <Icon className="size-5 mb-2 opacity-30" />
      <p className="text-xs">{label}</p>
      {hint && <p className="text-[10px] mt-0.5">{hint}</p>}
    </div>
  );
}

export default App;
