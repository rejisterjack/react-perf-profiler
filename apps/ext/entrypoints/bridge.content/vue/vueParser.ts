/**
 * Vue VNode Parser — converts Vue 3 VNode tree to structured fiber-like data.
 */

let vnodeIdCounter = 0;
const vnodeIdMap = new WeakMap<object, string>();

function getVNodeId(vnode: unknown): string {
  if (!vnode || typeof vnode !== 'object') return 'null';
  if (vnodeIdMap.has(vnode)) return vnodeIdMap.get(vnode)!;
  const id = `vnode-${++vnodeIdCounter}`;
  vnodeIdMap.set(vnode, id);
  return id;
}

export interface VueFiberData {
  id: string;
  displayName: string;
  key: string | null;
  child: VueFiberData | null;
  sibling: VueFiberData | null;
  return: VueFiberData | null;
  type: unknown;
  elementType: unknown;
  memoizedProps: Record<string, unknown>;
  memoizedState: unknown;
  actualDuration: number;
  actualStartTime: number;
  selfBaseDuration: number;
  treeBaseDuration: number;
  tag: number;
  index: number;
  sourceLocation?: { fileName: string | null; lineNumber: number | null; columnNumber: number | null };
}

export function parseVNodeTree(vnode: unknown): VueFiberData[] {
  if (!vnode || typeof vnode !== 'object') return [];
  const fibers: VueFiberData[] = [];
  walkSubTree(vnode, (vn, depth) => {
    fibers.push(parseVNode(vn, depth));
  }, 0);
  return fibers;
}

function walkSubTree(vnode: unknown, callback: (vnode: unknown, depth: number) => void, depth: number): void {
  if (!vnode || typeof vnode !== 'object') return;
  const vn = vnode as Record<string, unknown>;

  callback(vnode, depth);

  const component = vn.component as Record<string, unknown> | undefined;
  if (component?.subTree) {
    walkSubTree(component.subTree, callback, depth + 1);
  }

  const children = vn.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      if (child && typeof child === 'object') {
        walkSubTree(child, callback, depth + 1);
      }
    }
  } else if (children && typeof children === 'object') {
    walkSubTree(children, callback, depth + 1);
  }

  const dynamicChildren = vn.dynamicChildren as unknown[];
  if (Array.isArray(dynamicChildren)) {
    for (const child of dynamicChildren) {
      if (child && typeof child === 'object') {
        walkSubTree(child, callback, depth + 1);
      }
    }
  }
}

function parseVNode(vnode: unknown, depth: number): VueFiberData {
  const vn = vnode as Record<string, unknown>;
  const id = getVNodeId(vnode);
  const type = vn.type;

  let displayName = 'Unknown';
  if (typeof type === 'string') {
    displayName = type;
  } else if (typeof type === 'object' && type !== null) {
    const name = (type as Record<string, unknown>).name;
    displayName = typeof name === 'string' ? name : 'AnonymousComponent';
  } else if (typeof type === 'function') {
    displayName = (type as { displayName?: string; name?: string }).displayName || (type as { name?: string }).name || 'AnonymousFn';
  }

  return {
    id,
    displayName,
    key: (vn.key as string) ?? null,
    child: null,
    sibling: null,
    return: null,
    type: typeof type === 'string' ? type : undefined,
    elementType: typeof type === 'string' ? type : undefined,
    memoizedProps: extractVueProps(vn),
    memoizedState: undefined,
    actualDuration: 0,
    actualStartTime: 0,
    selfBaseDuration: 0,
    treeBaseDuration: 0,
    tag: getVueComponentTag(vn),
    index: depth,
    sourceLocation: extractVueSourceLocation(vn),
  };
}

function extractVueProps(vn: Record<string, unknown>): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  const component = vn.component as Record<string, unknown> | undefined;
  if (component?.props && typeof component.props === 'object') {
    Object.assign(props, component.props);
  }
  if (vn.props && typeof vn.props === 'object') {
    Object.assign(props, vn.props as Record<string, unknown>);
  }
  delete props.ref;
  delete props.key;
  for (const key of Object.keys(props)) {
    if (key.startsWith('on')) delete props[key];
    if (typeof props[key] === 'function') props[key] = '[Function]';
  }
  return props;
}

function getVueComponentTag(vn: Record<string, unknown>): number {
  const type = vn.type;
  if (typeof type === 'string') return 5; // HostComponent
  if (typeof type === 'function') return 0; // FunctionComponent
  if (typeof type === 'object' && type !== null) return 0;
  return 0;
}

function extractVueSourceLocation(vn: Record<string, unknown>): { fileName: string | null; lineNumber: null; columnNumber: null } | undefined {
  const type = vn.type as Record<string, unknown> | undefined;
  if (type && typeof type === 'object') {
    const file = type.__file as string | undefined;
    if (file) return { fileName: file, lineNumber: null, columnNumber: null };
  }
  return undefined;
}
