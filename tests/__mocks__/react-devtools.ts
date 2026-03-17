/**
 * Mock for React DevTools global hook
 * Used in tests to simulate React DevTools environment
 */

import type { ReactDevToolsHook, FiberData } from '@/content/types';

/**
 * Creates a mock React DevTools hook
 */
export function createMockReactDevToolsHook(overrides: Partial<ReactDevToolsHook> = {}): ReactDevToolsHook {
  return {
    renderers: new Map(),
    supportsFiber: true,
    inject: vi.fn(() => 1),
    onScheduleRoot: vi.fn(),
    onCommitFiberRoot: vi.fn(),
    onCommitFiberUnmount: vi.fn(),
    ...overrides,
  };
}

/**
 * Creates a mock fiber node
 */
export function createMockFiber(overrides: Partial<FiberData> = {}): FiberData {
  return {
    id: 'mock-fiber-id',
    displayName: 'MockComponent',
    key: null,
    child: null,
    sibling: null,
    return: null,
    type: 'div',
    elementType: 'div',
    memoizedProps: {},
    memoizedState: null,
    actualDuration: 1,
    actualStartTime: 0,
    selfBaseDuration: 1,
    treeBaseDuration: 1,
    tag: 5,
    index: 0,
    mode: 0,
    ...overrides,
  };
}

/**
 * Creates a mock fiber tree structure
 */
export function createMockFiberTree(): FiberData {
  const child2 = createMockFiber({
    id: 'child-2',
    displayName: 'Child2',
    sibling: null,
  });

  const child1 = createMockFiber({
    id: 'child-1',
    displayName: 'Child1',
    sibling: child2,
  });

  const root = createMockFiber({
    id: 'root',
    displayName: 'Root',
    child: child1,
  });

  // Set up return pointers
  child1.return = root;
  child2.return = root;

  return root;
}

/**
 * Installs the mock React DevTools hook on window
 */
export function installMockReactDevTools(overrides?: Partial<ReactDevToolsHook>): void {
  const mockHook = createMockReactDevToolsHook(overrides);
  (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = mockHook;
}

/**
 * Removes the mock React DevTools hook from window
 */
export function uninstallMockReactDevTools(): void {
  delete (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
}

/**
 * Simulates a React commit event
 */
export function simulateReactCommit(
  hook: ReactDevToolsHook,
  rendererId: number = 1,
  root: any = {},
  priorityLevel: number = 3
): void {
  hook.onCommitFiberRoot(rendererId, root, priorityLevel);
}

/**
 * Simulates a React fiber unmount event
 */
export function simulateFiberUnmount(
  hook: ReactDevToolsHook,
  rendererId: number = 1,
  fiber: any = {}
): void {
  hook.onCommitFiberUnmount(rendererId, fiber);
}

/**
 * Mock renderer for testing
 */
export class MockReactRenderer {
  private rendererId: number;
  private hook: ReactDevToolsHook;

  constructor(hook: ReactDevToolsHook, rendererId: number = 1) {
    this.hook = hook;
    this.rendererId = rendererId;
    this.hook.renderers.set(rendererId, this);
  }

  /**
   * Simulates a commit
   */
  commit(root: any, priorityLevel: number = 3): void {
    this.hook.onCommitFiberRoot(this.rendererId, root, priorityLevel);
  }

  /**
   * Simulates an unmount
   */
  unmount(fiber: any): void {
    this.hook.onCommitFiberUnmount(this.rendererId, fiber);
  }

  /**
   * Cleans up
   */
  cleanup(): void {
    this.hook.renderers.delete(this.rendererId);
  }
}

/**
 * Setup helper for tests
 */
export function setupReactDevToolsMock(overrides?: Partial<ReactDevToolsHook>): MockReactRenderer {
  installMockReactDevTools(overrides);
  const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
  return new MockReactRenderer(hook);
}

/**
 * Teardown helper for tests
 */
export function teardownReactDevToolsMock(renderer?: MockReactRenderer): void {
  if (renderer) {
    renderer.cleanup();
  }
  uninstallMockReactDevTools();
}

// Default export with all utilities
export default {
  createMockReactDevToolsHook,
  createMockFiber,
  createMockFiberTree,
  installMockReactDevTools,
  uninstallMockReactDevTools,
  simulateReactCommit,
  simulateFiberUnmount,
  MockReactRenderer,
  setupReactDevToolsMock,
  teardownReactDevToolsMock,
};
