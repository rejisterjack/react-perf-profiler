/**
 * GitHub Integration
 * GitHub App for automated performance checks on PRs
 * @module shared/github/GitHubIntegration
 */

import type { BudgetCheckResult } from '@/shared/performance-budgets/types';
import { logger } from '@/shared/logger';

/**
 * GitHub integration config
 */
export interface GitHubConfig {
  enabled: boolean;
  appId: string;
  installationId?: string;
  privateKey?: string;
  webhookSecret?: string;
}

/**
 * PR comment data
 */
export interface PRCommentData {
  bundleResults: Array<{
    chunk: string;
    size: number;
    budget: number;
    passed: boolean;
  }>;
  coverageResult?: {
    lines: number;
    functions: number;
    branches: number;
    statements: number;
  };
  profileResult?: BudgetCheckResult;
  performanceScore: number;
}

/**
 * GitHub Integration
 */
export class GitHubIntegration {
  private config: GitHubConfig;
  private token?: string;

  constructor(config: GitHubConfig) {
    this.config = config;
  }

  /**
   * Authenticate with GitHub App
   */
  async authenticate(): Promise<boolean> {
    if (!this.config.enabled || !this.config.appId) {
      return false;
    }

    try {
      // In real implementation, generate JWT and exchange for installation token
      // For now, this is a stub that would be implemented with actual GitHub API
      this.token = 'stub-token';
      return true;
    } catch (error) {
      logger.error('GitHub authentication failed', {
        error: error instanceof Error ? error.message : String(error),
        source: 'GitHubIntegration',
      });
      return false;
    }
  }

  /**
   * Post performance report as PR comment
   */
  async postPRComment(
    owner: string,
    repo: string,
    prNumber: number,
    data: PRCommentData
  ): Promise<boolean> {
    if (!this.token) {
      await this.authenticate();
    }

    const body = this.generatePRComment(data);

    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ body }),
        }
      );

      return response.ok;
    } catch (error) {
      logger.error('Failed to post PR comment', {
        error: error instanceof Error ? error.message : String(error),
        source: 'GitHubIntegration',
      });
      return false;
    }
  }

  /**
   * Update commit status
   */
  async updateCommitStatus(
    owner: string,
    repo: string,
    sha: string,
    state: 'success' | 'failure' | 'pending',
    description: string,
    targetUrl?: string
  ): Promise<boolean> {
    if (!this.token) return false;

    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/statuses/${sha}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            state,
            description,
            context: 'React Perf Profiler',
            target_url: targetUrl,
          }),
        }
      );

      return response.ok;
    } catch (error) {
      logger.error('Failed to update commit status', {
        error: error instanceof Error ? error.message : String(error),
        source: 'GitHubIntegration',
      });
      return false;
    }
  }

  /**
   * Generate PR comment markdown
   */
  private generatePRComment(data: PRCommentData): string {
    const status = data.performanceScore >= 70 ? '✅' : '⚠️';
    
    let comment = `## ${status} Performance Report

### 📊 Performance Score: ${data.performanceScore}/100

`;

    // Bundle sizes
    if (data.bundleResults?.length) {
      comment += `### 📦 Bundle Sizes

| Chunk | Size | Budget | Status |
|-------|------|--------|--------|
`;
      for (const result of data.bundleResults) {
        const icon = result.passed ? '✅' : '❌';
        const size = this.formatBytes(result.size);
        const budget = this.formatBytes(result.budget);
        comment += `| ${result.chunk} | ${size} | ${budget} | ${icon} |\n`;
      }
      comment += '\n';
    }

    // Coverage
    if (data.coverageResult) {
      comment += `### 🧪 Test Coverage

| Metric | Coverage |
|--------|----------|
| Lines | ${data.coverageResult.lines}% |
| Functions | ${data.coverageResult.functions}% |
| Branches | ${data.coverageResult.branches}% |
| Statements | ${data.coverageResult.statements}% |

`;
    }

    // Profile violations
    if (data.profileResult?.violations?.length) {
      comment += `### ⚠️ Performance Violations

| Check | Severity | Actual | Threshold |
|-------|----------|--------|-----------|
`;
      for (const v of data.profileResult.violations) {
        const icon = v.severity === 'error' ? '🔴' : '🟡';
        comment += `| ${v.budgetName} | ${icon} ${v.severity} | ${v.actualValue} | ${v.threshold} |\n`;
      }
      comment += '\n';
    }

    comment += `---
*Generated by React Perf Profiler* 🚀`;

    return comment;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }
}

// Singleton
let integration: GitHubIntegration | null = null;

export function getGitHubIntegration(config?: GitHubConfig): GitHubIntegration {
  if (!integration && config) {
    integration = new GitHubIntegration(config);
  }
  return integration!;
}
