#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');

test('all paths from the captured upstream SHA remain present', () => {
  const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'validate-upstream-parity.js')], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /baseline paths are present/);
});
