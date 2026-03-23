#!/usr/bin/env node
/**
 * Performance Budget CLI Tool
 * @module cli/perf-check
 *
 * Command-line interface for checking performance budgets in CI/CD pipelines.
 * Supports checking performance profiles, bundle sizes, and test coverage.
 *
 * Exit codes:
 *   0 - All budgets passed
 *   1 - Budget violations detected (errors)
 *   2 - Configuration or runtime error
 *
 * @example
 * ```bash
 * # Check performance profile
 * perf-check profile.json
 *
 * # Check bundle sizes
 * perf-check --check-bundles --bundle-path ./dist-chrome
 *
 * # Check test coverage
 * perf-check --check-coverage --coverage-path ./coverage
 *
 * # Check all
 * perf-check --check-bundles --check-coverage profile.json
 * ```
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkBundleSizes,
  checkCoverage,
  checkPerformanceBudget,
  formatCheckResultHuman,
  generateBudgetReport,
} from '@/shared/performance-budgets/budgetChecker';
import {
  type BudgetConfig,
  type BudgetCheckOptions,
  type BudgetCheckResult,
  type BundleCheckResult,
  type CoverageCheckResult,
  type ProfileData,
  isBudgetConfig,
  isProfileData,
  DEFAULT_BUDGET_CONFIG,
} from '@/shared/performance-budgets/types';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * CLI exit codes
 */
enum ExitCode {
  SUCCESS = 0,
  VIOLATIONS = 1,
  ERROR = 2,
}

/**
 * Extended CLI options
 */
interface ExtendedBudgetCheckOptions extends BudgetCheckOptions {
  /** Check bundle sizes */
  checkBundles?: boolean;
  /** Bundle directory path */
  bundlePath?: string;
  /** Target browser for bundle check */
  bundleTarget?: 'chrome' | 'firefox' | 'both';
  /** Check test coverage */
  checkCoverage?: boolean;
  /** Coverage report path */
  coveragePath?: string;
  /** Generate PR comment format */
  prComment?: boolean;
}

/**
 * Prints usage information
 */
function printUsage(): void {
  console.log(`
React Perf Profiler - Budget Check CLI

Usage: perf-check [options] [profile-file]

Options:
  -c, --config <path>        Path to budget configuration file (default: perf-budget.json)
  -f, --format <format>      Output format: 'json', 'human', or 'markdown' (default: human)
  -o, --output <path>        Write output to file instead of stdout
  -w, --fail-on-warning      Fail on warning-level violations (default: only fail on errors)
  -q, --quiet                Quiet mode - only output errors
  -v, --verbose              Verbose mode - show detailed information
  
Bundle Options:
  --check-bundles            Check bundle sizes
  --bundle-path <path>       Path to bundle directory (default: ./dist-chrome)
  --bundle-target <target>   Target browser: 'chrome', 'firefox', or 'both' (default: chrome)
  
Coverage Options:
  --check-coverage           Check test coverage
  --coverage-path <path>     Path to coverage report (default: ./coverage)
  
CI Options:
  --pr-comment               Generate PR comment format output
  
Other:
  -h, --help                 Show this help message
  --version                  Show version number

Examples:
  # Check performance profile
  perf-check profile.json
  
  # Check bundle sizes for Chrome
  perf-check --check-bundles --bundle-path ./dist-chrome
  
  # Check bundle sizes for both browsers
  perf-check --check-bundles --bundle-target both
  
  # Check test coverage
  perf-check --check-coverage --coverage-path ./coverage
  
  # Check everything
  perf-check --check-bundles --check-coverage --pr-comment profile.json
  
  # Output as JSON for CI processing
  perf-check --format json --output result.json profile.json
`);
}

/**
 * Prints version information
 */
function printVersion(): void {
  try {
    const packagePath = path.resolve(__dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    console.log(pkg.version || '1.0.0');
  } catch {
    console.log('1.0.0');
  }
}

/**
 * Parses command line arguments
 */
function parseArgs(args: string[]): ExtendedBudgetCheckOptions & { help?: boolean; version?: boolean } {
  const options: ExtendedBudgetCheckOptions & { help?: boolean; version?: boolean } = {
    profilePath: '',
    configPath: 'perf-budget.json',
    format: 'human',
    failOnWarning: false,
    quiet: false,
    verbose: false,
    checkBundles: false,
    bundlePath: './dist-chrome',
    bundleTarget: 'chrome',
    checkCoverage: false,
    coveragePath: './coverage',
    prComment: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '-h':
      case '--help':
        options.help = true;
        break;

      case '--version':
        options.version = true;
        break;

      case '-c':
      case '--config':
        options.configPath = args[++i];
        break;

      case '-f':
      case '--format': {
        const format = args[++i];
        if (format !== 'json' && format !== 'human' && format !== 'markdown') {
          console.error(`Error: Invalid format '${format}'. Use 'json', 'human', or 'markdown'.`);
          process.exit(ExitCode.ERROR);
        }
        options.format = format as 'json' | 'human';
        break;
      }

      case '-o':
      case '--output':
        options.outputPath = args[++i];
        break;

      case '-w':
      case '--fail-on-warning':
        options.failOnWarning = true;
        break;

      case '-q':
      case '--quiet':
        options.quiet = true;
        break;

      case '-v':
      case '--verbose':
        options.verbose = true;
        break;

      case '--check-bundles':
        options.checkBundles = true;
        break;

      case '--bundle-path':
        options.bundlePath = args[++i];
        break;

      case '--bundle-target': {
        const target = args[++i];
        if (target !== 'chrome' && target !== 'firefox' && target !== 'both') {
          console.error(`Error: Invalid bundle target '${target}'. Use 'chrome', 'firefox', or 'both'.`);
          process.exit(ExitCode.ERROR);
        }
        options.bundleTarget = target as 'chrome' | 'firefox' | 'both';
        break;
      }

      case '--check-coverage':
        options.checkCoverage = true;
        break;

      case '--coverage-path':
        options.coveragePath = args[++i];
        break;

      case '--pr-comment':
        options.prComment = true;
        break;

      default:
        if (!arg?.startsWith('-')) {
          options.profilePath = arg ?? '';
        } else {
          console.error(`Error: Unknown option '${arg}'`);
          process.exit(ExitCode.ERROR);
        }
        break;
    }
  }

  return options;
}

/**
 * Loads and validates budget configuration
 */
function loadConfig(configPath: string): BudgetConfig {
  const resolvedPath = path.resolve(configPath);

  // Check if config file exists
  if (!fs.existsSync(resolvedPath)) {
    // If using default path, return default config
    if (configPath === 'perf-budget.json') {
      return DEFAULT_BUDGET_CONFIG;
    }
    throw new Error(`Configuration file not found: ${configPath}`);
  }

  // Read and parse config
  const content = fs.readFileSync(resolvedPath, 'utf-8');
  let config: unknown;

  try {
    config = JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid JSON in configuration file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Validate config structure
  if (!isBudgetConfig(config)) {
    throw new Error('Invalid configuration file structure. Required fields: version, wastedRenderThreshold, memoHitRateThreshold, maxRenderTimeMs, maxRSCPayloadSize, minPerformanceScore, maxSlowRenderPercentage, budgets');
  }

  return config;
}

/**
 * Loads and validates profile data
 */
function loadProfile(profilePath: string): ProfileData {
  const resolvedPath = path.resolve(profilePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Profile file not found: ${profilePath}`);
  }

  const content = fs.readFileSync(resolvedPath, 'utf-8');
  let profile: unknown;

  try {
    profile = JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid JSON in profile file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  if (!isProfileData(profile)) {
    throw new Error('Invalid profile file structure. Required fields: version, recordingDuration, commits');
  }

  return profile;
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Show help if no arguments or help flag
  if (args.length === 0) {
    printUsage();
    process.exit(ExitCode.SUCCESS);
  }

  const options = parseArgs(args);

  if (options.help) {
    printUsage();
    process.exit(ExitCode.SUCCESS);
  }

  if (options.version) {
    printVersion();
    process.exit(ExitCode.SUCCESS);
  }

  // Validate that at least one check is requested
  if (!options.profilePath && !options.checkBundles && !options.checkCoverage) {
    console.error('Error: At least one check must be specified (profile file, --check-bundles, or --check-coverage)');
    printUsage();
    process.exit(ExitCode.ERROR);
  }

  try {
    // Load configuration
    if (!options.quiet) {
      console.log(`📋 Loading configuration from ${options.configPath || 'defaults'}...`);
    }
    const config = loadConfig(options.configPath || 'perf-budget.json');

    // Apply CLI overrides
    if (options.failOnWarning !== undefined) {
      config.failOnWarning = options.failOnWarning;
    }
    if (options.format) {
      config.outputFormat = options.format;
    }

    let profileResult: BudgetCheckResult | undefined;
    let bundleResults: BundleCheckResult[] | undefined;
    let coverageResult: CoverageCheckResult | undefined;

    // Check performance profile
    if (options.profilePath) {
      if (!options.quiet) {
        console.log(`📊 Loading profile from ${options.profilePath}...`);
      }
      const profile = loadProfile(options.profilePath);

      if (options.verbose && !options.quiet) {
        console.log(`   Profile: ${profile.commits.length} commits, ${profile.recordingDuration}ms duration`);
      }

      if (!options.quiet) {
        console.log('🔍 Checking performance budgets...\n');
      }

      profileResult = checkPerformanceBudget(profile, config);
    }

    // Check bundle sizes
    if (options.checkBundles) {
      if (!options.quiet) {
        console.log('📦 Checking bundle sizes...\n');
      }

      bundleResults = [];

      const targets: Array<'chrome' | 'firefox'> = options.bundleTarget === 'both'
        ? ['chrome', 'firefox']
        : [options.bundleTarget || 'chrome'];

      for (const target of targets) {
        const bundlePath = target === 'chrome'
          ? (options.bundlePath || './dist-chrome')
          : (options.bundlePath?.replace('chrome', 'firefox') || './dist-firefox');

        if (!options.quiet) {
          console.log(`  Checking ${target} bundles at ${bundlePath}...`);
        }

        const result = checkBundleSizes(bundlePath, target, config.bundleBudgets);
        bundleResults.push(result);

        if (options.verbose && !options.quiet) {
          console.log(`    Total: ${(result.totalSize / 1024).toFixed(1)}KB / ${(result.totalBudget / 1024).toFixed(1)}KB`);
          for (const chunk of result.chunks) {
            const status = chunk.passed ? '✅' : '🔴';
            console.log(`    ${status} ${chunk.name}: ${(chunk.size / 1024).toFixed(1)}KB`);
          }
        }
      }

      if (!options.quiet) {
        console.log('');
      }
    }

    // Check test coverage
    if (options.checkCoverage) {
      if (!options.quiet) {
        console.log('🧪 Checking test coverage...\n');
      }

      coverageResult = checkCoverage(options.coveragePath || './coverage', config.coverageThresholds);

      if (options.verbose && !options.quiet) {
        console.log(`  Lines: ${coverageResult.lines.toFixed(1)}%`);
        console.log(`  Functions: ${coverageResult.functions.toFixed(1)}%`);
        console.log(`  Branches: ${coverageResult.branches.toFixed(1)}%`);
        console.log(`  Statements: ${coverageResult.statements.toFixed(1)}%`);
        console.log(`  Status: ${coverageResult.passed ? '✅ PASSED' : '❌ FAILED'}`);
        console.log('');
      }
    }

    // Determine overall result
    const allPassed = 
      (!profileResult || profileResult.passed) &&
      (!bundleResults || bundleResults.every(r => r.passed)) &&
      (!coverageResult || coverageResult.passed);

    // Format output
    let output: string;

    if (options.prComment) {
      // Generate PR comment format
      output = generateBudgetReport(profileResult, bundleResults, coverageResult);
    } else if (options.format === 'json') {
      // JSON output
      output = JSON.stringify({
        passed: allPassed,
        profileResult,
        bundleResults,
        coverageResult,
        timestamp: Date.now(),
      }, null, 2);
    } else {
      // Human-readable output
      const lines: string[] = [];

      lines.push('╔════════════════════════════════════════════════════════════╗');
      lines.push('║           Performance Budget Check Results                 ║');
      lines.push('╚════════════════════════════════════════════════════════════╝');
      lines.push('');

      const status = allPassed ? '✅ PASSED' : '❌ FAILED';
      lines.push(`Status: ${status}`);
      lines.push('');

      if (profileResult) {
        lines.push(formatCheckResultHuman(profileResult));
      }

      if (bundleResults && bundleResults.length > 0) {
        lines.push('📦 Bundle Size Results:');
        lines.push('');

        for (const result of bundleResults) {
          lines.push(`  ${result.target.toUpperCase()}:`);
          lines.push(`    Total: ${(result.totalSize / 1024).toFixed(1)}KB / ${(result.totalBudget / 1024).toFixed(1)}KB ${result.passed ? '✅' : '🔴'}`);

          if (result.violations.length > 0) {
            lines.push('    Violations:');
            for (const v of result.violations) {
              lines.push(`      🔴 ${v.message}`);
            }
          }
          lines.push('');
        }
      }

      if (coverageResult) {
        lines.push('🧪 Test Coverage Results:');
        lines.push(`  Lines: ${coverageResult.lines.toFixed(1)}% ${coverageResult.lines >= (config.coverageThresholds?.lines || 70) ? '✅' : '🔴'}`);
        lines.push(`  Functions: ${coverageResult.functions.toFixed(1)}% ${coverageResult.functions >= (config.coverageThresholds?.functions || 70) ? '✅' : '🔴'}`);
        lines.push(`  Branches: ${coverageResult.branches.toFixed(1)}% ${coverageResult.branches >= (config.coverageThresholds?.branches || 60) ? '✅' : '🔴'}`);
        lines.push(`  Statements: ${coverageResult.statements.toFixed(1)}% ${coverageResult.statements >= (config.coverageThresholds?.statements || 70) ? '✅' : '🔴'}`);
        lines.push(`  Status: ${coverageResult.passed ? '✅ PASSED' : '❌ FAILED'}`);
        lines.push('');
      }

      lines.push(`Checked at: ${new Date().toISOString()}`);
      output = lines.join('\n');
    }

    // Write output
    if (options.outputPath) {
      fs.writeFileSync(options.outputPath, output);
      if (!options.quiet) {
        console.log(`\n✅ Results written to ${options.outputPath}`);
      }
    } else {
      console.log(output);
    }

    // Exit with appropriate code
    if (!allPassed) {
      const errorCount = 
        (profileResult?.errorCount || 0) +
        (bundleResults?.reduce((sum, r) => sum + r.violations.filter(v => v.severity === 'error').length, 0) || 0) +
        (coverageResult?.violations.filter(v => v.severity === 'error').length || 0);

      const warningCount = 
        (profileResult?.warningCount || 0) +
        (bundleResults?.reduce((sum, r) => sum + r.violations.filter(v => v.severity === 'warning').length, 0) || 0) +
        (coverageResult?.violations.filter(v => v.severity === 'warning').length || 0);

      if (!options.quiet) {
        console.error(`\n❌ Budget check failed with ${errorCount} errors and ${warningCount} warnings`);
      }
      process.exit(ExitCode.VIOLATIONS);
    }

    if (!options.quiet) {
      console.log('\n✅ All performance budgets passed!');
    }
    process.exit(ExitCode.SUCCESS);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error(`\n❌ Error: ${message}`);
    process.exit(ExitCode.ERROR);
  }
}

// Run main function
main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(ExitCode.ERROR);
});
