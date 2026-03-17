/// <reference types="vite/client" />

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
  const value: any;
  export default value;
}
