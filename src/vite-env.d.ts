/// <reference types="vite/client" />

// biome-ignore lint/correctness/noUnusedVariables: Vite merges into ImportMeta.env
interface ImportMetaEnv {
  readonly VITE_COLLAB_RELAY_URL?: string;
  readonly VITE_DISABLE_GOOGLE_DRIVE_SYNC?: string;
}

// Declare module for CSS imports
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// Declare web worker imports
declare module '*?worker' {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}

// Declare JSON imports
declare module '*.json' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value: Record<string, unknown>;
  export default value;
}
