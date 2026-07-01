/**
 * Zod runtime schemas mirroring the TypeScript types in `./types.ts`.
 *
 * Used by the web API to validate uploaded profiles at the boundary, and by
 * the extension to validate deserialized payloads (defense in depth).
 *
 * Keep in sync with `./types.ts`. The TypeScript types are the source of
 * truth; these schemas are checked against them via the type-level assertions
 * at the bottom of this file.
 */

import { z } from 'zod';
import type { AnalysisResult, CommitData, FiberData } from './types.js';

export const severitySchema = z.enum(['low', 'medium', 'high', 'critical']);

export const sourceLocationSchema = z.object({
  fileName: z.string().nullable(),
  lineNumber: z.number().nullable(),
  columnNumber: z.number().nullable(),
});

/**
 * Fiber `type`, `elementType`, and `memoizedState` are intentionally
 * `unknown`-typed in the contract because they carry heterogeneous runtime
 * values. We accept any JSON-serializable value here.
 */
const jsonValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValue),
    z.record(z.string(), jsonValue),
  ]),
);

export const fiberDataSchema = z.lazy(() =>
  z.object({
    id: z.string(),
    displayName: z.string(),
    key: z.string().nullable(),
    child: fiberDataSchema.nullable(),
    sibling: fiberDataSchema.nullable(),
    return: fiberDataSchema.nullable(),
    type: jsonValue,
    elementType: jsonValue,
    memoizedProps: z.record(z.string(), jsonValue),
    memoizedState: jsonValue,
    actualDuration: z.number(),
    actualStartTime: z.number(),
    selfBaseDuration: z.number(),
    treeBaseDuration: z.number(),
    tag: z.number(),
    index: z.number(),
    flags: z.number().optional(),
    mode: z.number(),
    sourceLocation: sourceLocationSchema.optional(),
  }),
) as z.ZodType<FiberData>;

export const renderCauseEntrySchema = z.object({
  type: z.enum([
    'props-changed',
    'state-changed',
    'parent-rerendered',
    'context-changed',
    'hooks-changed',
  ]),
  details: z.string(),
  changedKeys: z.array(z.string()).optional(),
});

export const renderCauseSchema = z.object({
  fiberId: z.string(),
  componentName: z.string(),
  causes: z.array(renderCauseEntrySchema),
});

export const interactionDataSchema = z.object({
  id: z.number(),
  name: z.string(),
  timestamp: z.number(),
});

export const priorityLevelStringSchema = z.enum([
  'Immediate',
  'UserBlocking',
  'Normal',
  'Low',
  'Idle',
]);

export const commitDataSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  priorityLevel: priorityLevelStringSchema,
  interactions: z.array(interactionDataSchema).optional(),
  duration: z.number(),
  rootFiber: fiberDataSchema.nullable().optional(),
  fibers: z.array(fiberDataSchema).optional(),
  nodes: z.array(z.record(z.string(), z.unknown())).optional(),
  rootId: z.number().optional(),
  reactVersion: z.string().optional(),
  priorityLevelString: priorityLevelStringSchema.optional(),
  actualDuration: z.number().optional(),
  actualStartTime: z.number().optional(),
  renderCauses: z.array(renderCauseSchema).optional(),
  changedFiberIds: z.array(z.string()).optional(),
  isDelta: z.boolean().optional(),
  deltaChangedFibers: z.array(fiberDataSchema).optional(),
  deltaRemovedFiberIds: z.array(z.string()).optional(),
}) as z.ZodType<CommitData>;

/**
 * The canonical "profile body" — an array of commits. Used directly by the
 * web API's `POST /api/profiles` route.
 */
export const profileDataSchema = z.array(commitDataSchema);

// ---------------------------------------------------------------------------
// Analysis output schemas
// ---------------------------------------------------------------------------

export const componentMetricsSchema = z.object({
  componentName: z.string(),
  renderCount: z.number(),
  wastedRenderCount: z.number(),
  wastedRenderRate: z.number(),
  totalRenderTime: z.number(),
  averageRenderTime: z.number(),
  maxRenderTime: z.number(),
  minRenderTime: z.number(),
  isMemoized: z.boolean(),
  memoHitRate: z.number().optional(),
  firstSeen: z.number(),
  lastSeen: z.number(),
});

export const wastedRenderIssueSchema = z.object({
  type: z.enum([
    'prop-reference',
    'state-reference',
    'inline-function',
    'inline-object',
    'inline-array',
    'context-change',
  ]),
  description: z.string(),
  suggestion: z.string(),
  occurrences: z.array(z.string()),
  severity: severitySchema,
});

export const wastedRenderReportSchema = z.object({
  componentName: z.string(),
  renderCount: z.number(),
  totalRenders: z.number(),
  wastedRenders: z.number(),
  wastedRenderRate: z.number(),
  recommendedAction: z.enum(['memo', 'useMemo', 'useCallback', 'none']),
  estimatedSavingsMs: z.number(),
  severity: severitySchema,
  issues: z.array(wastedRenderIssueSchema),
});

export const memoIssueSchema = z.object({
  type: z.enum([
    'unstable-callback',
    'unstable-object',
    'unstable-array',
    'inline-jsx',
    'deep-prop',
  ]),
  propName: z.string(),
  description: z.string(),
  suggestion: z.string(),
  severity: severitySchema,
});

export const memoRecommendationSchema = z.object({
  type: z.enum(['useCallback', 'useMemo', 'React.memo', 'split-props']),
  description: z.string(),
  codeExample: z.string().optional(),
});

export const memoReportSchema = z.object({
  componentName: z.string(),
  hasMemo: z.boolean(),
  currentHitRate: z.number(),
  optimalHitRate: z.number(),
  isEffective: z.boolean(),
  issues: z.array(memoIssueSchema),
  recommendations: z.array(memoRecommendationSchema),
});

export const optimizationOpportunitySchema = z.object({
  componentName: z.string(),
  type: z.enum(['memo', 'useMemo', 'useCallback', 'split-props', 'colocate-state']),
  impact: z.enum(['high', 'medium', 'low']),
  estimatedSavings: z.number(),
  description: z.string(),
});

export const anomalyReportEntrySchema = z.object({
  commitIndex: z.number(),
  duration: z.number(),
  expectedRange: z.object({ low: z.number(), high: z.number() }),
  zScore: z.number(),
  severity: severitySchema,
});

export const anomalyReportGroupSchema = z.object({
  componentName: z.string(),
  reports: z.array(anomalyReportEntrySchema),
});

export const trendReportEntrySchema = z.object({
  componentName: z.string(),
  slope: z.number(),
  rSquared: z.number(),
  direction: z.enum(['improving', 'stable', 'degrading']),
  sampleSize: z.number(),
});

export const patternReportEntrySchema = z.object({
  pattern: z.enum(['burst', 'periodic', 'cascade', 'escalating']),
  components: z.array(z.string()),
  description: z.string(),
  confidence: z.number(),
});

export const analysisResultSchema = z.object({
  timestamp: z.number(),
  totalCommits: z.number(),
  wastedRenderReports: z.array(wastedRenderReportSchema),
  memoReports: z.array(memoReportSchema),
  performanceScore: z.number(),
  topOpportunities: z.array(optimizationOpportunitySchema),
  anomalyReports: z.array(anomalyReportGroupSchema).optional(),
  trendReports: z.array(trendReportEntrySchema).optional(),
  patternReports: z.array(patternReportEntrySchema).optional(),
}) as z.ZodType<AnalysisResult>;

// ---------------------------------------------------------------------------
// API envelope schemas
// ---------------------------------------------------------------------------

export const profileMetadataSchema = z
  .object({
    reactVersion: z.string().optional(),
    totalCommits: z.number().optional(),
    totalComponents: z.number().optional(),
    performanceScore: z.number().optional(),
    durationMs: z.number().optional(),
    source: z.enum(['extension', 'cli', 'import']).optional(),
  })
  .catchall(z.unknown());

export const profileUploadRequestSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name is too long'),
  data: profileDataSchema,
  analysis: analysisResultSchema.optional(),
  metadata: profileMetadataSchema.optional(),
  isPublic: z.boolean().optional().default(false),
});

export const profileUploadResponseSchema = z.object({
  profile: z.object({
    id: z.string(),
    userId: z.string(),
    name: z.string(),
    isPublic: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
    metadata: profileMetadataSchema,
  }),
});
