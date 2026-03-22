/**
 * Tests for ComponentDataLRUCache
 */
import { describe, it, expect, beforeEach } from 'vitest';

// We need to import the class from the store file
// Since ComponentDataLRUCache is not exported, we'll test it indirectly through the store
import { useProfilerStore, type ComponentData } from '@/panel/stores/profilerStore';

describe('ComponentDataLRUCache', () => {
  beforeEach(() => {
    useProfilerStore.getState().clearData();
  });

  describe('basic operations', () => {
    it('should store and retrieve component data', () => {
      const store = useProfilerStore.getState();
      const componentData = store.componentData;

      const data: ComponentData = {
        name: 'TestComponent',
        renderCount: 5,
        wastedRenders: 1,
        wastedRenderRate: 20,
        averageDuration: 0.5,
        totalDuration: 2.5,
        isMemoized: true,
        memoHitRate: 80,
        commitIds: ['commit-1', 'commit-2'],
        severity: 'warning',
      };

      componentData.set('TestComponent', data);
      expect(componentData.get('TestComponent')).toEqual(data);
    });

    it('should return undefined for non-existent keys', () => {
      const store = useProfilerStore.getState();
      expect(store.componentData.get('NonExistent')).toBeUndefined();
    });

    it('should check if key exists', () => {
      const store = useProfilerStore.getState();
      const componentData = store.componentData;

      const data: ComponentData = {
        name: 'TestComponent',
        renderCount: 1,
        wastedRenders: 0,
        wastedRenderRate: 0,
        averageDuration: 0.1,
        totalDuration: 0.1,
        isMemoized: false,
        memoHitRate: 0,
        commitIds: ['commit-1'],
        severity: 'none',
      };

      componentData.set('TestComponent', data);
      expect(componentData.has('TestComponent')).toBe(true);
      expect(componentData.has('NonExistent')).toBe(false);
    });

    it('should delete entries', () => {
      const store = useProfilerStore.getState();
      const componentData = store.componentData;

      const data: ComponentData = {
        name: 'TestComponent',
        renderCount: 1,
        wastedRenders: 0,
        wastedRenderRate: 0,
        averageDuration: 0.1,
        totalDuration: 0.1,
        isMemoized: false,
        memoHitRate: 0,
        commitIds: ['commit-1'],
        severity: 'none',
      };

      componentData.set('TestComponent', data);
      expect(componentData.has('TestComponent')).toBe(true);

      componentData.delete('TestComponent');
      expect(componentData.has('TestComponent')).toBe(false);
    });

    it('should clear all entries', () => {
      const store = useProfilerStore.getState();
      const componentData = store.componentData;

      const data: ComponentData = {
        name: 'TestComponent',
        renderCount: 1,
        wastedRenders: 0,
        wastedRenderRate: 0,
        averageDuration: 0.1,
        totalDuration: 0.1,
        isMemoized: false,
        memoHitRate: 0,
        commitIds: ['commit-1'],
        severity: 'none',
      };

      componentData.set('TestComponent1', data);
      componentData.set('TestComponent2', { ...data, name: 'TestComponent2' });
      expect(componentData.size).toBe(2);

      componentData.clear();
      expect(componentData.size).toBe(0);
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used entries when size limit is exceeded', () => {
      const store = useProfilerStore.getState();
      
      // Set a small max size for testing
      store.componentData.setMaxSize(3);

      const componentData = store.componentData;

      // Add 3 entries (at limit)
      componentData.set('Comp1', createComponentData('Comp1'));
      componentData.set('Comp2', createComponentData('Comp2'));
      componentData.set('Comp3', createComponentData('Comp3'));

      expect(componentData.size).toBe(3);
      expect(componentData.has('Comp1')).toBe(true);

      // Access Comp1 to make it recently used
      componentData.get('Comp1');

      // Add 4th entry - should evict Comp2 (least recently used)
      componentData.set('Comp4', createComponentData('Comp4'));

      expect(componentData.size).toBe(3);
      expect(componentData.has('Comp1')).toBe(true); // Recently accessed
      expect(componentData.has('Comp2')).toBe(false); // Evicted
      expect(componentData.has('Comp3')).toBe(true);
      expect(componentData.has('Comp4')).toBe(true);
    });

    it('should update access order on get', () => {
      const store = useProfilerStore.getState();
      store.componentData.setMaxSize(2);

      const componentData = store.componentData;

      componentData.set('Comp1', createComponentData('Comp1'));
      componentData.set('Comp2', createComponentData('Comp2'));

      // Access Comp1 to make it most recently used
      componentData.get('Comp1');

      // Add new entry - should evict Comp2
      componentData.set('Comp3', createComponentData('Comp3'));

      expect(componentData.has('Comp1')).toBe(true);
      expect(componentData.has('Comp2')).toBe(false);
      expect(componentData.has('Comp3')).toBe(true);
    });

    it('should update access order on set of existing key', () => {
      const store = useProfilerStore.getState();
      store.componentData.setMaxSize(2);

      const componentData = store.componentData;

      componentData.set('Comp1', createComponentData('Comp1'));
      componentData.set('Comp2', createComponentData('Comp2'));

      // Update Comp1 to make it most recently used
      componentData.set('Comp1', createComponentData('Comp1', 10));

      // Add new entry - should evict Comp2
      componentData.set('Comp3', createComponentData('Comp3'));

      expect(componentData.has('Comp1')).toBe(true);
      expect(componentData.has('Comp2')).toBe(false);
      expect(componentData.has('Comp3')).toBe(true);
    });

    it('should respect the configured max size', () => {
      const store = useProfilerStore.getState();
      const componentData = store.componentData;

      // Default should be from config
      expect(componentData.getMaxSize()).toBe(1000);

      // Change max size
      componentData.setMaxSize(5);
      expect(componentData.getMaxSize()).toBe(5);

      // Add more entries than new limit
      for (let i = 0; i < 10; i++) {
        componentData.set(`Comp${i}`, createComponentData(`Comp${i}`));
      }

      // Should only keep 5 most recent
      expect(componentData.size).toBe(5);
    });

    it('should provide eviction candidates', () => {
      const store = useProfilerStore.getState();
      store.componentData.setMaxSize(5);

      const componentData = store.componentData;

      componentData.set('Comp1', createComponentData('Comp1'));
      componentData.set('Comp2', createComponentData('Comp2'));
      componentData.set('Comp3', createComponentData('Comp3'));

      const candidates = componentData.getEvictionCandidates(2);
      expect(candidates).toEqual(['Comp1', 'Comp2']);
    });
  });

  describe('iteration', () => {
    it('should support values() iteration', () => {
      const store = useProfilerStore.getState();
      const componentData = store.componentData;

      componentData.set('Comp1', createComponentData('Comp1', 1));
      componentData.set('Comp2', createComponentData('Comp2', 2));

      const values = Array.from(componentData.values());
      expect(values).toHaveLength(2);
      expect(values.map(v => v.renderCount).sort()).toEqual([1, 2]);
    });

    it('should support forEach iteration', () => {
      const store = useProfilerStore.getState();
      const componentData = store.componentData;

      componentData.set('Comp1', createComponentData('Comp1', 1));
      componentData.set('Comp2', createComponentData('Comp2', 2));

      const collected: Array<{ key: string; count: number }> = [];
      componentData.forEach((value, key) => {
        collected.push({ key, count: value.renderCount });
      });

      expect(collected).toHaveLength(2);
      expect(collected.map(c => c.count).sort()).toEqual([1, 2]);
    });

    it('should support entries() iteration', () => {
      const store = useProfilerStore.getState();
      const componentData = store.componentData;

      componentData.set('Comp1', createComponentData('Comp1'));

      const entries = Array.from(componentData.entries());
      expect(entries).toHaveLength(1);
      expect(entries[0]![0]).toBe('Comp1');
      expect(entries[0]![1].name).toBe('Comp1');
    });
  });
});

// Helper function to create component data
function createComponentData(name: string, renderCount: number = 1): ComponentData {
  return {
    name,
    renderCount,
    wastedRenders: 0,
    wastedRenderRate: 0,
    averageDuration: 0.1,
    totalDuration: 0.1 * renderCount,
    isMemoized: false,
    memoHitRate: 0,
    commitIds: [],
    severity: 'none',
  };
}

// =============================================================================
// Edge Cases
// =============================================================================

describe('ComponentDataLRUCache edge cases', () => {
  beforeEach(() => {
    useProfilerStore.getState().clearData();
  });

  it('maxSize = 1 evicts the only existing entry when a second is added', () => {
    const { componentData } = useProfilerStore.getState();
    componentData.setMaxSize(1);

    componentData.set('First', createComponentData('First'));
    expect(componentData.size).toBe(1);

    componentData.set('Second', createComponentData('Second'));
    expect(componentData.size).toBe(1);
    expect(componentData.has('First')).toBe(false);
    expect(componentData.has('Second')).toBe(true);
  });

  it('setMaxSize to a smaller value immediately evicts oldest entries', () => {
    const { componentData } = useProfilerStore.getState();
    componentData.setMaxSize(5);

    for (let i = 1; i <= 5; i++) {
      componentData.set(`Comp${i}`, createComponentData(`Comp${i}`));
    }
    expect(componentData.size).toBe(5);

    // Shrink — should immediately evict Comp1 and Comp2 (oldest)
    componentData.setMaxSize(3);
    expect(componentData.size).toBe(3);
    expect(componentData.has('Comp1')).toBe(false);
    expect(componentData.has('Comp2')).toBe(false);
    expect(componentData.has('Comp5')).toBe(true);
  });

  it('updating an existing key via set() moves it to most-recently-used position', () => {
    const { componentData } = useProfilerStore.getState();
    componentData.setMaxSize(3);

    componentData.set('A', createComponentData('A'));
    componentData.set('B', createComponentData('B'));
    componentData.set('C', createComponentData('C'));

    // Re-set A → it should become MRU
    componentData.set('A', createComponentData('A', 99));

    // Adding D should evict B (now the oldest), not A
    componentData.set('D', createComponentData('D'));
    expect(componentData.has('B')).toBe(false);
    expect(componentData.has('A')).toBe(true);
    expect(componentData.get('A')?.renderCount).toBe(99);
  });

  it('getEvictionCandidates returns oldest keys in insertion order', () => {
    const { componentData } = useProfilerStore.getState();
    componentData.setMaxSize(10);

    componentData.set('Alpha', createComponentData('Alpha'));
    componentData.set('Beta', createComponentData('Beta'));
    componentData.set('Gamma', createComponentData('Gamma'));

    // Alpha is oldest, then Beta
    const candidates = componentData.getEvictionCandidates(2);
    expect(candidates[0]).toBe('Alpha');
    expect(candidates[1]).toBe('Beta');
  });

  it('getEvictionCandidates(0) returns empty array', () => {
    const { componentData } = useProfilerStore.getState();
    componentData.set('X', createComponentData('X'));
    expect(componentData.getEvictionCandidates(0)).toHaveLength(0);
  });

  it('getEvictionCandidates clamps to available entries', () => {
    const { componentData } = useProfilerStore.getState();
    componentData.set('Only', createComponentData('Only'));
    // Request more than available
    const candidates = componentData.getEvictionCandidates(100);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toBe('Only');
  });

  it('delete removes from access order so it never appears as eviction candidate', () => {
    const { componentData } = useProfilerStore.getState();
    componentData.setMaxSize(5);

    componentData.set('Keep', createComponentData('Keep'));
    componentData.set('Remove', createComponentData('Remove'));

    componentData.delete('Remove');
    expect(componentData.has('Remove')).toBe(false);

    const candidates = componentData.getEvictionCandidates(5);
    expect(candidates).not.toContain('Remove');
  });

  it('size tracks correctly after a sequence of set/delete/clear operations', () => {
    const { componentData } = useProfilerStore.getState();

    componentData.set('A', createComponentData('A'));
    componentData.set('B', createComponentData('B'));
    expect(componentData.size).toBe(2);

    componentData.delete('A');
    expect(componentData.size).toBe(1);

    componentData.set('C', createComponentData('C'));
    expect(componentData.size).toBe(2);

    componentData.clear();
    expect(componentData.size).toBe(0);
  });
});
