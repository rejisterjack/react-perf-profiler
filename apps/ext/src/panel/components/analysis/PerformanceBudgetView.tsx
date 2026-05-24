/**
 * PerformanceBudgetView — create, manage, and display performance budgets.
 * Allows defining per-component thresholds and shows violations.
 */

import { useState, useCallback } from 'react';
import { useProfilerStore, type PerformanceBudget, type BudgetRule, type BudgetViolation } from '@/src/panel/stores/profilerStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Plus, Trash2, AlertTriangle, CheckCircle, Shield } from 'lucide-react';

export function PerformanceBudgetView() {
  const budgets = useProfilerStore((s) => s.budgets);
  const budgetViolations = useProfilerStore((s) => s.budgetViolations);
  const addBudget = useProfilerStore((s) => s.addBudget);
  const removeBudget = useProfilerStore((s) => s.removeBudget);
  const checkBudgets = useProfilerStore((s) => s.checkBudgets);

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newComponentPattern, setNewComponentPattern] = useState('*');
  const [newMaxRenders, setNewMaxRenders] = useState('');
  const [newMaxWastedRate, setNewMaxWastedRate] = useState('');
  const [newMaxAvgDuration, setNewMaxAvgDuration] = useState('');
  const [newMinMemoHitRate, setNewMinMemoHitRate] = useState('');

  const handleCreate = useCallback(() => {
    if (!newName.trim()) return;

    const rule: BudgetRule = {
      componentPattern: newComponentPattern || '*',
    };
    if (newMaxRenders) rule.maxRenderCount = parseInt(newMaxRenders, 10);
    if (newMaxWastedRate) rule.maxWastedRenderRate = parseFloat(newMaxWastedRate);
    if (newMaxAvgDuration) rule.maxAvgRenderDuration = parseFloat(newMaxAvgDuration);
    if (newMinMemoHitRate) rule.minMemoHitRate = parseFloat(newMinMemoHitRate);

    const budget: PerformanceBudget = {
      id: `budget-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: newName.trim(),
      rules: [rule],
      createdAt: Date.now(),
    };

    addBudget(budget);
    setNewName('');
    setNewComponentPattern('*');
    setNewMaxRenders('');
    setNewMaxWastedRate('');
    setNewMaxAvgDuration('');
    setNewMinMemoHitRate('');
    setIsCreating(false);
    checkBudgets();
  }, [newName, newComponentPattern, newMaxRenders, newMaxWastedRate, newMaxAvgDuration, newMinMemoHitRate, addBudget, checkBudgets]);

  const hasViolations = budgetViolations.length > 0;

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-primary" />
            <h3 className="text-sm font-medium">Performance Budgets</h3>
            {hasViolations && (
              <Badge variant="outline" className="bg-red-500/15 text-red-600 border-red-500/30 dark:text-red-400">
                {budgetViolations.length} violation{budgetViolations.length !== 1 ? 's' : ''}
              </Badge>
            )}
            {!hasViolations && budgets.length > 0 && (
              <Badge variant="outline" className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400">
                All passing
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCreating(!isCreating)}
            className="gap-1"
          >
            <Plus className="size-3" />
            New Budget
          </Button>
        </div>

        {/* Create form */}
        {isCreating && (
          <Card>
            <CardContent className="flex flex-col gap-3">
              <Input
                placeholder="Budget name (e.g., 'Dashboard Performance')"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Input
                placeholder="Component pattern (e.g., 'Dashboard*' or '*')"
                value={newComponentPattern}
                onChange={(e) => setNewComponentPattern(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  placeholder="Max render count"
                  value={newMaxRenders}
                  onChange={(e) => setNewMaxRenders(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Max wasted rate (%)"
                  value={newMaxWastedRate}
                  onChange={(e) => setNewMaxWastedRate(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Max avg duration (ms)"
                  value={newMaxAvgDuration}
                  onChange={(e) => setNewMaxAvgDuration(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Min memo hit rate (%)"
                  value={newMinMemoHitRate}
                  onChange={(e) => setNewMinMemoHitRate(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreate} disabled={!newName.trim()}>
                  Create Budget
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsCreating(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Violations */}
        {hasViolations && (
          <div>
            <h4 className="text-xs font-medium text-red-600 dark:text-red-400 mb-2 flex items-center gap-1">
              <AlertTriangle className="size-3" />
              Budget Violations
            </h4>
            <div className="flex flex-col gap-1.5">
              {budgetViolations.map((v, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs"
                >
                  <AlertTriangle className="size-3 text-red-500 shrink-0" />
                  <span className="font-medium">{v.componentName}</span>
                  <span className="text-muted-foreground">
                    {v.metric}: <span className="font-mono">{v.actualValue.toFixed(1)}</span> exceeds <span className="font-mono">{v.threshold}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Budget list */}
        {budgets.length === 0 && !isCreating ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
            <Shield className="size-8 opacity-40" />
            <p className="text-sm">No performance budgets defined.</p>
            <p className="text-xs">Create a budget to set thresholds for render count, wasted rate, and more.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {budgets.map((budget) => {
              const budgetViolationCount = budgetViolations.filter(
                (v) => budget.rules.some((r) => r.componentPattern === v.rule.componentPattern)
              ).length;

              return (
                <Card key={budget.id}>
                  <CardContent className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {budgetViolationCount > 0 ? (
                        <AlertTriangle className="size-3.5 text-red-500 shrink-0" />
                      ) : (
                        <CheckCircle className="size-3.5 text-emerald-500 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{budget.name}</p>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          {budget.rules.map((rule, idx) => (
                            <span key={idx} className="text-[10px] text-muted-foreground">
                              {rule.componentPattern}
                              {rule.maxRenderCount != null && ` ≤${rule.maxRenderCount} renders`}
                              {rule.maxWastedRenderRate != null && ` ≤${rule.maxWastedRenderRate}% waste`}
                              {rule.maxAvgRenderDuration != null && ` ≤${rule.maxAvgRenderDuration}ms avg`}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeBudget(budget.id)}
                      title="Delete budget"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
