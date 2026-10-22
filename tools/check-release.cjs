'use strict';
// One failing command fails the release check on both PowerShell and CI.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const tests = [
  'test-logic.js', 'test-localization.js', 'test-save-store.js', 'test-story.js',
  'test-progress.cjs', 'test-storage-backend.js', 'test-desktop-store.js',
  'test-desktop-integration.js', 'test-transfer.js', 'ab-test.js'
];
for (const test of tests) {
  const args = [path.join(__dirname, test)];
  if (test === 'ab-test.js') args.push('--selftest');
  console.log('\nChecking ' + test);
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('\nAll release source checks passed. Packaged runtime verification is separate.');
