/**
 * Claude (Anthropic) AI provider for React profiling analysis.
 * Uses structural context (render causes, source locations, prop diffs) for deeper diagnosis.
 */

import type { AIAnalysisRequest, AIConfig, AISuggestion } from './types';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

export async function analyzeWithClaude(
  request: AIAnalysisRequest,
  config: AIConfig,
): Promise<AISuggestion[]> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(request);

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.model || 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error');
    throw new Error(`Claude API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const textContent = data.content?.[0]?.text;

  if (!textContent) {
    throw new Error('Claude returned an empty response');
  }

  return parseSuggestions(textContent);
}

function buildSystemPrompt(): string {
  return `You are a senior React performance optimization expert. You receive detailed profiling data including render metrics, render cause traces, component tree context, and source locations.

Your job is to provide STRUCTURAL, NON-OBVIOUS diagnoses — not generic advice like "use useCallback." Developers using this tool already know the basics. Focus on:

1. **Root cause identification**: Trace WHY re-renders happen (state change cascade, context granularity, selector issues)
2. **Architectural suggestions**: State colocation, component decomposition, context splitting, lazy loading boundaries
3. **Prop dependency analysis**: Identify which specific props are unstable and trace them to their origin
4. **Pattern recognition**: Detect common anti-patterns like:
   - Selector returning new references on every call
   - Context provider wrapping too many children
   - Object/array props recreated inline
   - State updates triggering unnecessary cascades
   - Missing React.lazy for route-level components

Return a JSON array of suggestion objects:
[
  {
    "componentName": "string",
    "issue": "string - root cause description",
    "suggestion": "string - specific structural fix",
    "codeExample": "string - before/after code",
    "confidence": 0.0-1.0,
    "category": "memoization|state-colocation|prop-optimization|context-optimization|lazy-loading|render-strategy"
  }
]

Guidelines:
- If render causes show "parent-rerendered", trace the chain upward to the actual state source
- If props are unstable, explain WHY they're unstable (inline creation vs selector returning new ref)
- If source location is available, reference the file in the suggestion
- Provide code examples that show the structural change, not just wrapping in useCallback
- Return ONLY the JSON array, no markdown formatting`;
}

function buildUserPrompt(request: AIAnalysisRequest): string {
  const { componentName, metrics, commits, renderContext } = request;

  // Build structured context sections
  const sections: string[] = [];

  // Basic metrics
  sections.push(`## Component: ${componentName}
- Render count: ${metrics.renderCount}
- Wasted renders: ${metrics.wastedRenderCount} (${metrics.wastedRenderRate.toFixed(1)}% waste rate)
- Total render time: ${metrics.totalRenderTime.toFixed(2)}ms
- Average: ${metrics.averageRenderTime.toFixed(2)}ms, Max: ${metrics.maxRenderTime.toFixed(2)}ms
- Memoized: ${metrics.isMemoized}${metrics.memoHitRate != null ? `, Hit rate: ${(metrics.memoHitRate * 100).toFixed(1)}%` : ''}`);

  // Source location
  if (renderContext?.sourceLocation?.fileName) {
    sections.push(`## Source Location
- File: ${renderContext.sourceLocation.fileName}:${renderContext.sourceLocation.lineNumber ?? '?'}`);
  }

  // Render causes (the "why did this render?" trace)
  if (renderContext?.renderCauses && renderContext.renderCauses.length > 0) {
    const causeSummary = renderContext.renderCauses.slice(-5).map((rc) => {
      const causes = rc.causes.map((c) => `${c.type}: ${c.details}${c.changedKeys ? ` [${c.changedKeys.join(', ')}]` : ''}`).join('; ');
      return `- ${causes}`;
    }).join('\n');
    sections.push(`## Render Causes (last ${Math.min(5, renderContext.renderCauses.length)} traces)
${causeSummary}`);
  }

  // Unstable props
  if (renderContext?.unstableProps && renderContext.unstableProps.length > 0) {
    sections.push(`## Unstable Props (frequently changing)
${renderContext.unstableProps.map((p) => `- ${p}`).join('\n')}`);
  }

  // Component tree context
  if (renderContext) {
    const treeInfo: string[] = [];
    if (renderContext.parentChain.length > 0) {
      treeInfo.push(`Parent chain: ${renderContext.parentChain.join(' → ')}`);
    }
    if (renderContext.childRenders.length > 0) {
      treeInfo.push(`Re-rendering children: ${renderContext.childRenders.join(', ')}`);
    }
    treeInfo.push(`Tree depth: ${renderContext.treeDepth}, Siblings: ${renderContext.treeSiblingCount}`);
    sections.push(`## Tree Context\n${treeInfo.join('\n')}`);
  }

  // Commit data sample
  const commitSummaries = commits.slice(0, 10).map((c) => ({
    id: c.id.slice(0, 20),
    duration: c.duration?.toFixed(2),
    priority: c.priorityLevel,
    fiberCount: c.fibers?.length ?? 0,
  }));
  sections.push(`## Recent Commits (${commitSummaries.length} of ${commits.length})
${JSON.stringify(commitSummaries, null, 2)}`);

  return `Analyze this React component's performance and provide structural optimization suggestions.

${sections.join('\n\n')}

Provide specific, non-obvious diagnosis based on the render cause traces and component tree context.`;
}

function parseSuggestions(text: string): AISuggestion[] {
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [normalizeSuggestion(parsed)];
    return parsed.map(normalizeSuggestion);
  } catch {
    throw new Error('Failed to parse Claude response as JSON suggestions');
  }
}

function normalizeSuggestion(raw: Record<string, unknown>): AISuggestion {
  return {
    componentName: String(raw.componentName ?? ''),
    issue: String(raw.issue ?? ''),
    suggestion: String(raw.suggestion ?? ''),
    codeExample: String(raw.codeExample ?? ''),
    confidence: typeof raw.confidence === 'number' ? Math.min(1, Math.max(0, raw.confidence)) : 0.5,
    category: (raw.category as AISuggestion['category']) ?? undefined,
  };
}
