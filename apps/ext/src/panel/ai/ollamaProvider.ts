/**
 * Ollama (local model) AI provider for React profiling analysis.
 */

import type { AIAnalysisRequest, AIConfig, AISuggestion } from './types';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434/api/generate';

export async function analyzeWithOllama(
  request: AIAnalysisRequest,
  config: AIConfig,
): Promise<AISuggestion[]> {
  const { componentName, metrics, commits } = request;
  const apiUrl = config.baseUrl || DEFAULT_OLLAMA_URL;

  const prompt = buildPrompt(componentName, metrics, commits);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model || 'llama3.2',
      prompt,
      stream: false,
      format: 'json',
      options: {
        temperature: 0.3,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error');
    throw new Error(
      `Ollama API error (${response.status}): ${errorBody}`,
    );
  }

  const data = await response.json();
  const textContent = data.response;

  if (!textContent) {
    throw new Error('Ollama returned an empty response');
  }

  return parseSuggestions(textContent);
}

function buildPrompt(
  componentName: string,
  metrics: import('@/src/shared/types').ComponentMetrics,
  commits: import('@/src/shared/types').CommitData[],
): string {
  const commitSummaries = commits.slice(0, 20).map((c) => ({
    id: c.id,
    duration: c.duration,
    priority: c.priorityLevel,
    timestamp: c.timestamp,
    nodeCount: c.nodes?.length ?? 0,
  }));

  return `You are a React performance optimization expert. Analyze the provided component metrics and commit data to identify performance issues and suggest specific optimizations.

Return your analysis as a JSON array of suggestion objects with this exact structure:
[
  {
    "componentName": "string",
    "issue": "string - description of the performance issue",
    "suggestion": "string - specific fix recommendation",
    "codeExample": "string - before/after code showing the fix",
    "confidence": number - 0 to 1, how confident you are
  }
]

Guidelines:
- Focus on actionable, specific suggestions
- Include realistic code examples showing before and after
- Consider React best practices (memoization, lazy loading, state colocation, etc.)
- Rate confidence based on how clear the issue is from the data
- Return ONLY valid JSON, no markdown or extra text

Analyze this React component's performance:

Component: ${componentName}

Metrics:
- Render count: ${metrics.renderCount}
- Wasted renders: ${metrics.wastedRenderCount} (${(metrics.wastedRenderRate * 100).toFixed(1)}% waste rate)
- Total render time: ${metrics.totalRenderTime.toFixed(2)}ms
- Average render time: ${metrics.averageRenderTime.toFixed(2)}ms
- Max render time: ${metrics.maxRenderTime.toFixed(2)}ms
- Min render time: ${metrics.minRenderTime.toFixed(2)}ms
- Is memoized: ${metrics.isMemoized}
${metrics.memoHitRate != null ? `- Memo hit rate: ${(metrics.memoHitRate * 100).toFixed(1)}%` : ''}

Recent commits (${commitSummaries.length}):
${JSON.stringify(commitSummaries, null, 2)}

Provide specific optimization suggestions for this component.`;
}

function parseSuggestions(text: string): AISuggestion[] {
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      return [parsed];
    }
    return parsed.map(normalizeSuggestion);
  } catch {
    throw new Error('Failed to parse Ollama response as JSON suggestions');
  }
}

function normalizeSuggestion(raw: Record<string, unknown>): AISuggestion {
  return {
    componentName: String(raw.componentName ?? ''),
    issue: String(raw.issue ?? ''),
    suggestion: String(raw.suggestion ?? ''),
    codeExample: String(raw.codeExample ?? ''),
    confidence: typeof raw.confidence === 'number'
      ? Math.min(1, Math.max(0, raw.confidence))
      : 0.5,
  };
}
