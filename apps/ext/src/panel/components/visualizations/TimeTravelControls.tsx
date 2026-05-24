/**
 * TimeTravelControls — playback controls for render cascade replay.
 * Provides play/pause, step forward/backward, speed control, and step indicator.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useProfilerStore } from '@/src/panel/stores/profilerStore';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Rewind,
  FastForward,
} from 'lucide-react';

export function TimeTravelControls() {
  const timeTravel = useProfilerStore((s) => s.timeTravel);
  const commits = useProfilerStore((s) => s.commits);
  const {
    setTimeTravelPlaying,
    setTimeTravelStep,
    setTimeTravelSpeed,
    nextTimeTravelStep,
    prevTimeTravelStep,
  } = useProfilerStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { isPlaying, currentStep, totalSteps, playbackSpeed } = timeTravel;

  // Auto-advance during playback
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (isPlaying && totalSteps > 0) {
      const intervalMs = 1000 / playbackSpeed;
      intervalRef.current = setInterval(() => {
        const { timeTravel: tt } = useProfilerStore.getState();
        if (tt.currentStep >= tt.totalSteps - 1) {
          setTimeTravelPlaying(false);
          return;
        }
        nextTimeTravelStep();
      }, intervalMs);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, playbackSpeed, totalSteps, setTimeTravelPlaying, nextTimeTravelStep]);

  const handlePlayPause = useCallback(() => {
    if (!isPlaying && currentStep >= totalSteps - 1) {
      setTimeTravelStep(0);
    }
    setTimeTravelPlaying(!isPlaying);
  }, [isPlaying, currentStep, totalSteps, setTimeTravelPlaying, setTimeTravelStep]);

  const handleSliderChange = useCallback((value: number[]) => {
    setTimeTravelStep(value[0]);
    setTimeTravelPlaying(false);
  }, [setTimeTravelStep, setTimeTravelPlaying]);

  if (totalSteps === 0) return null;

  const commitArray = Array.from(commits);
  const currentCommit = commitArray[currentStep];
  const progress = totalSteps > 0 ? (currentStep / (totalSteps - 1)) * 100 : 0;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
      {/* Step back */}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={prevTimeTravelStep}
        disabled={currentStep <= 0}
        title="Previous commit"
      >
        <SkipBack className="size-3.5" />
      </Button>

      {/* Rewind (jump back 5) */}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setTimeTravelStep(Math.max(0, currentStep - 5))}
        disabled={currentStep <= 0}
        title="Rewind 5 commits"
      >
        <Rewind className="size-3.5" />
      </Button>

      {/* Play/Pause */}
      <Button
        variant={isPlaying ? 'default' : 'outline'}
        size="icon-sm"
        onClick={handlePlayPause}
        disabled={totalSteps === 0}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
      </Button>

      {/* Fast forward (jump forward 5) */}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setTimeTravelStep(Math.min(totalSteps - 1, currentStep + 5))}
        disabled={currentStep >= totalSteps - 1}
        title="Fast forward 5 commits"
      >
        <FastForward className="size-3.5" />
      </Button>

      {/* Step forward */}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={nextTimeTravelStep}
        disabled={currentStep >= totalSteps - 1}
        title="Next commit"
      >
        <SkipForward className="size-3.5" />
      </Button>

      {/* Timeline slider */}
      <div className="flex-1 flex items-center gap-2 mx-1">
        <Slider
          value={[currentStep]}
          min={0}
          max={Math.max(0, totalSteps - 1)}
          step={1}
          onValueChange={handleSliderChange}
          className="flex-1"
        />
      </div>

      {/* Step counter */}
      <span className="text-xs text-muted-foreground tabular-nums shrink-0 min-w-[60px] text-right">
        {currentStep + 1}/{totalSteps}
      </span>

      {/* Speed control */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[10px] text-muted-foreground">Speed:</span>
        <select
          value={playbackSpeed}
          onChange={(e) => setTimeTravelSpeed(Number(e.target.value))}
          className="text-xs bg-background border border-border rounded px-1 py-0.5"
        >
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={5}>5x</option>
          <option value={10}>10x</option>
        </select>
      </div>

      {/* Current commit info */}
      {currentCommit && (
        <span className="text-[10px] text-muted-foreground truncate max-w-[120px]" title={currentCommit.id}>
          {currentCommit.priorityLevel} · {(currentCommit.duration ?? 0).toFixed(1)}ms
        </span>
      )}
    </div>
  );
}
