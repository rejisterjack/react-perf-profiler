# Contributing to React Perf Profiler

## Development Setup

```bash
# Install dependencies
pnpm install

# Start development server with HMR
pnpm dev

# Load extension in Chrome:
# 1. Open chrome://extensions/
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select the dist/ folder
```

## Project Structure

```
src/
├── background/     # Service worker
├── content/        # Content script & bridge
├── devtools/       # DevTools panel registration
├── panel/          # Main profiler UI (React)
│   ├── components/ # UI components
│   ├── hooks/      # Custom hooks
│   ├── stores/     # Zustand stores
│   ├── utils/      # Analysis algorithms
│   └── workers/    # Web Workers
└── shared/         # Shared types & constants
```

## Testing

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# With coverage
pnpm test -- --coverage
```

## Code Style

- TypeScript strict mode enabled
- ESLint + Prettier for formatting
- CSS Modules for styling
- Write tests for new features
