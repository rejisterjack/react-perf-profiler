/**
 * AISuggestionsPanel — UI for configuring an AI provider and viewing
 * optimization suggestions for a selected React component.
 */

import { useState, useCallback } from 'react';

import type { AIConfig, AIProvider, AISuggestion } from '@/src/panel/ai/types';
import type { ComponentMetrics, CommitData, SourceLocation } from '@/src/shared/types';
import { AIManager } from '@/src/panel/ai/aiManager';
import { generatePatch } from '@/src/panel/ai/patchGenerator';
import { useProfilerStore } from '@/src/panel/stores/profilerStore';
import { useSettingsStore } from '@/src/panel/stores/settingsStore';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Copy, FileCode } from 'lucide-react';

interface AISuggestionsPanelProps {
  componentName: string;
  metrics: ComponentMetrics;
  commits: CommitData[];
}

type AnalysisState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; suggestions: AISuggestion[] }
  | { status: 'error'; message: string };

const PROVIDER_OPTIONS: { value: AIProvider; label: string }[] = [
  { value: 'claude', label: 'Claude (Anthropic)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'ollama', label: 'Ollama (Local)' },
];

const PROVIDER_MODELS: Record<AIProvider, string[]> = {
  claude: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250414', 'claude-opus-4-20250514'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  ollama: ['llama3.2', 'codellama', 'mistral'],
};

const aiManager = new AIManager();

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  let variantClass: string;
  if (pct >= 80) {
    variantClass = 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400';
  } else if (pct >= 50) {
    variantClass = 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400';
  } else {
    variantClass = 'bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-400';
  }
  return (
    <Badge variant="outline" className={`text-[10px] ${variantClass}`}>
      {pct}% confidence
    </Badge>
  );
}

function SuggestionCard({ suggestion, sourceLocation }: { suggestion: AISuggestion; sourceLocation?: SourceLocation | null }) {
  const [codeExpanded, setCodeExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const editorProtocol = useSettingsStore((s) => s.editorProtocol);

  const handleCopyPatch = useCallback(() => {
    const patch = generatePatch(suggestion, {
      fileName: sourceLocation?.fileName ?? '',
      lineNumber: sourceLocation?.lineNumber ?? undefined,
    });
    navigator.clipboard.writeText(patch).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [suggestion, sourceLocation]);

  const handleOpenInEditor = useCallback(() => {
    if (sourceLocation?.fileName) {
      const line = sourceLocation.lineNumber ?? 1;
      let url: string;
      switch (editorProtocol) {
        case 'cursor':
          url = `cursor://file/${sourceLocation.fileName}:${line}`;
          break;
        case 'custom':
          url = `editor://open?file=${encodeURIComponent(sourceLocation.fileName)}&line=${line}`;
          break;
        case 'vscode':
        default:
          url = `vscode://file/${sourceLocation.fileName}:${line}`;
          break;
      }
      window.open(url);
    }
  }, [sourceLocation, editorProtocol]);

  return (
    <Card size="sm">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-xs font-mono">
            {suggestion.componentName}
          </CardTitle>
          <ConfidenceBadge confidence={suggestion.confidence} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div>
          <p className="text-[10px] font-medium text-destructive">Issue</p>
          <p className="text-[11px] text-muted-foreground">{suggestion.issue}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Suggestion</p>
          <p className="text-[11px] text-muted-foreground">{suggestion.suggestion}</p>
        </div>
        {suggestion.codeExample && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-[10px] px-1 mb-1"
              onClick={() => setCodeExpanded((prev) => !prev)}
            >
              {codeExpanded ? 'Hide' : 'Show'} code example
            </Button>
            {codeExpanded && (
              <pre className="text-[10px] bg-muted/50 rounded-md p-2 overflow-x-auto whitespace-pre-wrap break-words">
                <code>{suggestion.codeExample}</code>
              </pre>
            )}
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-1">
          <Button variant="outline" size="sm" className="h-5 text-[10px] px-2 gap-1" onClick={handleCopyPatch}>
            <Copy className="size-2.5" />
            {copied ? 'Copied!' : 'Copy as Patch'}
          </Button>
          {sourceLocation?.fileName && (
            <Button variant="outline" size="sm" className="h-5 text-[10px] px-2 gap-1" onClick={handleOpenInEditor}>
              <FileCode className="size-2.5" />
              Open in Editor
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function AISuggestionsPanel({
  componentName,
  metrics,
  commits,
}: AISuggestionsPanelProps) {
  const [provider, setProvider] = useState<AIProvider>('claude');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(PROVIDER_MODELS.claude[0]);
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434/api/generate');
  const [state, setState] = useState<AnalysisState>({ status: 'idle' });
  const sourceLocations = useProfilerStore((s) => s.sourceLocations);

  const handleProviderChange = useCallback((value: AIProvider) => {
    setProvider(value);
    setModel(PROVIDER_MODELS[value][0]);
    setState({ status: 'idle' });
  }, []);

  const handleAnalyze = useCallback(async () => {
    const config: AIConfig = {
      provider,
      apiKey: provider === 'ollama' ? '' : apiKey,
      model,
      ...(provider === 'ollama' ? { baseUrl: ollamaUrl } : {}),
    };

    setState({ status: 'loading' });

    try {
      const suggestions = await aiManager.analyze(
        { componentName, metrics, commits },
        config,
      );
      setState({ status: 'success', suggestions });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown analysis error';
      setState({ status: 'error', message });
    }
  }, [provider, apiKey, model, ollamaUrl, componentName, metrics, commits]);

  const handleRetry = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  const isConfigValid =
    provider === 'ollama' || apiKey.trim().length > 0;

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">AI Optimization Analysis</CardTitle>
          <CardDescription>
            Get AI-powered suggestions for <span className="font-mono">{componentName}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {/* Provider selector */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Provider</Label>
            <Select value={provider} onValueChange={(v) => handleProviderChange(v as AIProvider)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Model selector */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_MODELS[provider].map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* API key for Claude / OpenAI */}
          {provider !== 'ollama' && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">API Key</Label>
              <Input
                type="password"
                placeholder={`Enter your ${provider === 'claude' ? 'Anthropic' : 'OpenAI'} API key`}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
          )}

          {/* Ollama base URL */}
          {provider === 'ollama' && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Ollama URL</Label>
              <Input
                type="text"
                placeholder="http://localhost:11434/api/generate"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
              />
            </div>
          )}

          {/* Analyze button */}
          <Button
            className="w-full mt-1"
            disabled={!isConfigValid || state.status === 'loading'}
            onClick={handleAnalyze}
          >
            {state.status === 'loading' ? (
              <span className="flex items-center gap-2">
                <span className="size-3.5 border-2 border-current border-r-transparent rounded-full animate-spin" />
                Analyzing...
              </span>
            ) : (
              'Analyze'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {state.status === 'error' && (
        <Card size="sm">
          <CardContent className="flex flex-col items-center gap-3 py-4">
            <p className="text-xs text-destructive text-center">{state.message}</p>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {state.status === 'success' && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-foreground">
            Suggestions ({state.suggestions.length})
          </h3>
          {state.suggestions.length === 0 ? (
            <Card size="sm">
              <CardContent className="py-4">
                <p className="text-xs text-muted-foreground text-center">
                  No optimization suggestions found for this component.
                </p>
              </CardContent>
            </Card>
          ) : (
            state.suggestions.map((suggestion, idx) => (
              <SuggestionCard
                key={`${suggestion.componentName}-${idx}`}
                suggestion={suggestion}
                sourceLocation={sourceLocations.get(suggestion.componentName)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
