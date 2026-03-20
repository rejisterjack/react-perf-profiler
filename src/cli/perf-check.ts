#!/usr/bin/env node
/**
 * Performance Budget CLI Tool
 * @module cli/perf-check
 *
 * Command-line interface for checking performance budgets in CI/CD pipelines.
 * Exit codes:
 *   0 - All budgets passed
 *   1 - Budget violations detected (errors)
 *   2 - Configuration or runtime error
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  checkPerformanceBudget,
  formatCheckResultHuman,
  formatCheckResultJson,
} from '@/shared/performance-budgets/budgetChecker';
import {
  type BudgetConfig,
  type BudgetCheckOptions,
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
 * Prints usage information
 */
function printUsage(): void {
  console.log(`
React Perf Profiler - Budget Check CLI

Usage: perf-check [options] <profile-file>

Options:
  -c, --config <path>     Path to budget configuration file (default: perf-budget.json)
  -f, --format <format>   Output format: 'json' or 'human' (default: human)
  -o, --output <path>     Write output to file instead of stdout
  -w, --fail-on-warning   Fail on warning-level violations (default: only fail on errors)
  -q, --quiet             Quiet mode - only output errors
  -v, --verbose           Verbose mode - show detailed information
  -h, --help              Show this help message
  --version               Show version number

Examples:
  perf-check profile.json
  perf-check --config budgets.json profile.json
  perf-check --format json --output result.json profile.json
  perf-check --fail-on-warning --quiet profile.json
`);
}

/**
 * Prints version information
 */
function printVersion(): void {
  // Read version from package.json
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
function parseArgs(args: string[]): BudgetCheckOptions & { help?: boolean; version?: boolean } {
  const options: BudgetCheckOptions & { help?: boolean; version?: boolean } = {
    profilePath: '',
    configPath: 'perf-budget.json',
    format: 'human',
    failOnWarning: false,
    quiet: false,
    verbose: false,
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
      case '--format':
        const format = args[++i];
        if (format !== 'json' && format !== 'human') {
          console.error(`Error: Invalid format '${format}'. Use 'json' or 'human'.`);
          process.exit(ExitCode.ERROR);
        }
        options.format = format;
        break;

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
function loadProfile(profilePath: string): ReturnType<typeof isProfileData> {
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

  // Validate required arguments
  if (!options.profilePath) {
    console.error('Error: Profile file path is required');
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

    // Load profile
    if (!options.quiet) {
      console.log(`📊 Loading profile from ${options.profilePath}...`);
    }
    const profile = loadProfile(options.profilePath);

    if (options.verbose && !options.quiet) {
      console.log(`   Profile: ${profile.commits.length} commits, ${profile.recordingDuration}ms duration`);
    }

    // Run budget check
    if (!options.quiet) {
      console.log('🔍 Checking performance budgets...\n');
    }

    const result = checkPerformanceBudget(profile, config);

    // Format output
    const output = config.outputFormat === 'json'
      ? formatCheckResultJson(result)
      : formatCheckResultHuman(result);

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
    if (!result.passed) {
      if (!options.quiet) {
        console.error(`\n❌ Budget check failed with ${result.errorCount} errors and ${result.warningCount} warnings`);
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
