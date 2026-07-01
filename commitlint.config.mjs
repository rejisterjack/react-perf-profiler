/**
 * commitlint configuration — enforces Conventional Commits.
 *
 * Examples that PASS:
 *   feat(web): add /api/auth/refresh endpoint
 *   fix(ext): prevent duplicate COMMIT_BATCH dispatch
 *   chore(deps): bump next from 15.1.0 to 15.1.2
 *   docs: rewrite root README
 *
 * Examples that FAIL:
 *   updated some files              (no type)
 *   WIP: refresh endpoint           (non-conventional type)
 *   feat(web): Added refresh        (subject not imperative)
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Tighten the default rules to match the contributor guide.
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'perf',
        'refactor',
        'docs',
        'test',
        'chore',
        'ci',
        'build',
        'revert',
      ],
    ],
    // Allow `ext`, `web`, `contract`, `cli`, `analyzer`, `deps`, etc.
    'scope-enum': [
      1,
      'always',
      [
        'ext',
        'web',
        'contract',
        'cli',
        'analyzer',
        'vscode',
        'deps',
        'ci',
        'docs',
        'prisma',
        'auth',
        'api',
      ],
    ],
    'subject-case': [0], // allow lowercase as-is
    'header-max-length': [2, 'always', 100],
  },
};
