module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature (minor)
        'fix',      // Bug fix (patch)
        'perf',     // Performance improvement (patch)
        'docs',     // Documentation
        'style',    // Code style
        'refactor', // Code refactoring
        'test',     // Tests
        'build',    // Build system
        'ci',       // CI configuration
        'chore',    // Maintenance
        'revert',   // Revert commit
      ],
    ],
  },
};
