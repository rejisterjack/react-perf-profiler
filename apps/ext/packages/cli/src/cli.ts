#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { runAnalysis } from '@react-perf-profiler/analyzer';
import type { CommitData, AnalysisResult } from '@react-perf-profiler/analyzer';

const program = new Command();

program
  .name('rpp')
  .description('React Perf Profiler CLI — analyze profiling data in CI/CD')
  .version('1.0.0');

program
  .command('analyze')
  .description('Analyze a saved profile JSON file')
  .requiredOption('--profile <path>', 'Path to profile JSON file')
  .option('--format <format>', 'Output format: json | summary', 'summary')
  .action((options) => {
    const profilePath = resolve(options.profile);
    if (!existsSync(profilePath)) {
      console.error(`Error: Profile file not found: ${profilePath}`);
      process.exit(1);
    }

    try {
      const raw = JSON.parse(readFileSync(profilePath, 'utf-8'));
      const commits: CommitData[] = Array.isArray(raw) ? raw : raw.commits ?? [];

      if (commits.length === 0) {
        console.error('Error: No commits found in profile data');
        process.exit(1);
      }

      const result = runAnalysis(commits);

      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('\n=== React Perf Profiler Analysis ===\n');
        console.log(`Performance Score: ${result.performanceScore}/100`);
        console.log(`Total Commits: ${result.totalCommits}`);
        console.log(`Wasted Renders: ${result.wastedRenderReports.length}`);
        console.log(`Memo Issues: ${result.memoReports.length}`);
        console.log(`Opportunities: ${result.topOpportunities.length}`);

        if (result.topOpportunities.length > 0) {
          console.log('\n--- Top Opportunities ---');
          for (const opp of result.topOpportunities.slice(0, 10)) {
            const icon = opp.impact === 'high' ? '[HIGH]' : opp.impact === 'medium' ? '[MED]' : '[LOW]';
            console.log(`  ${icon} ${opp.componentName}: ${opp.description}`);
          }
        }

        if (result.wastedRenderReports.length > 0) {
          console.log('\n--- Wasted Renders ---');
          for (const report of result.wastedRenderReports.slice(0, 10)) {
            console.log(`  [${report.severity.toUpperCase()}] ${report.componentName}: ${report.wastedRenderRate}% waste (${report.wastedRenders}/${report.totalRenders} renders)`);
          }
        }

        if (result.trendReports && result.trendReports.length > 0) {
          console.log('\n--- Performance Trends ---');
          for (const trend of result.trendReports) {
            const arrow = trend.direction === 'degrading' ? '[UP]' : trend.direction === 'improving' ? '[DOWN]' : '[->]';
            console.log(`  ${arrow} ${trend.componentName}: slope=${trend.slope}, R2=${trend.rSquared}`);
          }
        }

        console.log('');
      }
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : 'Failed to analyze profile'}`);
      process.exit(1);
    }
  });

interface BudgetFile {
  rules: Array<{
    componentPattern: string;
    maxRenderCount?: number;
    maxWastedRenderRate?: number;
    maxAvgRenderDuration?: number;
  }>;
}

program
  .command('check')
  .description('Check profile against performance budget')
  .requiredOption('--profile <path>', 'Path to profile JSON file')
  .requiredOption('--budget <path>', 'Path to budget JSON file')
  .action((options) => {
    const profilePath = resolve(options.profile);
    const budgetPath = resolve(options.budget);

    if (!existsSync(profilePath)) {
      console.error(`Error: Profile file not found: ${profilePath}`);
      process.exit(1);
    }
    if (!existsSync(budgetPath)) {
      console.error(`Error: Budget file not found: ${budgetPath}`);
      process.exit(1);
    }

    try {
      const raw = JSON.parse(readFileSync(profilePath, 'utf-8'));
      const commits: CommitData[] = Array.isArray(raw) ? raw : raw.commits ?? [];
      const budget: BudgetFile = JSON.parse(readFileSync(budgetPath, 'utf-8'));

      const result = runAnalysis(commits);
      let violations = 0;

      console.log('\n=== Budget Check ===\n');

      for (const rule of budget.rules) {
        const pattern = new RegExp(`^${rule.componentPattern.replace(/\*/g, '.*')}$`);

        for (const report of result.wastedRenderReports) {
          if (!pattern.test(report.componentName)) continue;

          if (rule.maxRenderCount !== undefined && report.totalRenders > rule.maxRenderCount) {
            violations++;
            console.log(`FAIL ${report.componentName}: ${report.totalRenders} renders (max: ${rule.maxRenderCount})`);
          }
          if (rule.maxWastedRenderRate !== undefined && report.wastedRenderRate > rule.maxWastedRenderRate) {
            violations++;
            console.log(`FAIL ${report.componentName}: ${report.wastedRenderRate}% waste (max: ${rule.maxWastedRenderRate}%)`);
          }
        }
      }

      if (violations === 0) {
        console.log('PASS All budget checks passed!');
        console.log(`   Score: ${result.performanceScore}/100`);
        process.exit(0);
      } else {
        console.log(`\nFAIL ${violations} budget violation(s) found`);
        process.exit(1);
      }
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : 'Budget check failed'}`);
      process.exit(1);
    }
  });

program.parse();
