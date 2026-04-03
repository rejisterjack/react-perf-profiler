#!/usr/bin/env node
/**
 * Launches the perf-check CLI via tsx so path aliases (@/*) resolve.
 * Use: node scripts/perf-check-run.mjs [args...]
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const tsxCli = path.join(root, 'node_modules/tsx/dist/cli.mjs');
const target = path.join(root, 'src/cli/perf-check.ts');
const result = spawnSync(process.execPath, [tsxCli, target, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: root,
});
process.exit(result.status ?? 1);
