/**
 * Build script that packages the WXT extension output into downloadable ZIP
 * files for the landing page.
 *
 * Produces:
 *   apps/web/public/downloads/react-perf-profiler-chrome.zip
 *   apps/web/public/downloads/react-perf-profiler-firefox.zip
 *
 * Usage:
 *   bun run apps/web/scripts/build-extension-zips.mjs
 *
 * Requires bun (this repo's package manager) and the extension to be built.
 */

import { execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = join(import.meta.dirname, '..', '..');
const EXT_DIR = join(REPO_ROOT, 'apps', 'ext');
const WEB_PUBLIC_DOWNLOADS = join(REPO_ROOT, 'apps', 'web', 'public', 'downloads');

/**
 * Create a ZIP archive using the system `zip` CLI (preinstalled on macOS and
 * most CI runners). Falls back to an error with actionable guidance if absent.
 * @param {string} srcDir  Absolute path to the directory to zip.
 * @param {string} outFile Absolute path to the resulting .zip file.
 */
function zipDirectory(srcDir, outFile) {
  const dirName = srcDir.split(/[\\/]/).pop();
  const parent = join(srcDir, '..');

  // Ensure the parent of outFile exists.
  mkdirSync(join(outFile, '..'), { recursive: true });

  // Remove any stale archive.
  if (existsSync(outFile)) rmSync(outFile);

  const which = process.platform === 'win32' ? 'where' : 'which';
  const probe = spawnSync(which, ['zip'], { encoding: 'utf8' });
  if (probe.status !== 0) {
    throw new Error(
      `The 'zip' CLI was not found on PATH. Install it (macOS: preinstalled; Linux: apt-get install zip; CI: most runners include it), then re-run this script.`,
    );
  }

  // `zip -r -X <out> <dir>` — -X skips extra attributes for a smaller, reproducible archive.
  const result = spawnSync(
    'zip',
    ['-r', '-X', '-q', outFile, dirName],
    { cwd: parent, stdio: 'inherit', encoding: 'utf8' },
  );

  if (result.status !== 0) {
    throw new Error(`zip exited with status ${result.status}`);
  }
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * Build the extension for a given target via WXT.
 * @param {'chrome' | 'firefox'} target
 * @returns {string} absolute path to the produced output directory.
 */
function buildExtension(target) {
  console.log(`\nBuilding ${target} extension...`);
  // WXT uses the same `build` script and picks the target via --browser.
  // apps/ext/package.json exposes `build` and `zip`/`zip:firefox`; we build
  // in-place and zip ourselves so we control the output location.
  execSync(`bun run build --browser ${target}`, {
    cwd: EXT_DIR,
    stdio: 'inherit',
  });

  // WXT emits .output/<target>-mv3 (chrome) or <target>-mv2 (firefox).
  const mv = target === 'chrome' ? 'mv3' : 'mv2';
  const outDir = join(EXT_DIR, '.output', `${target}-${mv}`);
  if (!existsSync(outDir)) {
    throw new Error(
      `Expected WXT output at ${relative(REPO_ROOT, outDir)} but it does not exist.`,
    );
  }
  return outDir;
}

function verifyBuild(dir, target) {
  const manifestPath = join(dir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    throw new Error(`No manifest.json in ${target} build at ${dir}`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (target === 'chrome' && manifest.manifest_version !== 3) {
    throw new Error(`Chrome build must be MV3, got MV${manifest.manifest_version}`);
  }
  if (target === 'firefox' && manifest.manifest_version !== 2) {
    throw new Error(`Firefox build must be MV2, got MV${manifest.manifest_version}`);
  }
  console.log(`   ${target} build verified: MV${manifest.manifest_version}, v${manifest.version}`);
}

function main() {
  console.log('Building extension packages for the landing page...');

  ensureDir(WEB_PUBLIC_DOWNLOADS);

  const targets = [
    { name: 'chrome', zipName: 'react-perf-profiler-chrome.zip' },
    { name: 'firefox', zipName: 'react-perf-profiler-firefox.zip' },
  ];

  for (const { name, zipName } of targets) {
    try {
      const outDir = buildExtension(name);
      verifyBuild(outDir, name);
      const outFile = join(WEB_PUBLIC_DOWNLOADS, zipName);
      zipDirectory(outDir, outFile);
      const sizeKb = Math.round(statSync(outFile).size / 1024);
      console.log(
        `   Created ${relative(REPO_ROOT, outFile)} (${sizeKb} KB)`,
      );
    } catch (err) {
      console.error(`   ${name} build failed: ${err.message}`);
      process.exitCode = 1;
    }
  }

  console.log(
    `\nDone. Downloads available at: ${relative(REPO_ROOT, WEB_PUBLIC_DOWNLOADS)}`,
  );
}

main();
