#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { afterEach, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'check-agent-skills-upstream.js');
const sandboxes = [];

function makeSource() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-skills-upstream-source-'));
  const source = path.join(root, 'source');
  execFileSync('git', ['clone', '-q', ROOT, source]);
  fs.appendFileSync(path.join(source, 'skills', 'api-and-interface-design', 'SKILL.md'), '\nupstream change\n');
  fs.writeFileSync(path.join(source, 'upstream-new.md'), 'new');
  execFileSync('git', ['add', '.'], { cwd: source });
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'test'], { cwd: source });
  sandboxes.push(root);
  return source;
}

function run(source) {
  return spawnSync(process.execPath, [SCRIPT, '--source', source], { cwd: ROOT, encoding: 'utf8' });
}

afterEach(() => {
  for (const root of sandboxes.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

test('reports a local upstream source without modifying the repository', () => {
  const result = run(makeSource());
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const report = JSON.parse(result.stdout);
  assert.notEqual(report.baseline, report.latest);
  assert.ok(report.changed.skills.includes('skills/api-and-interface-design/SKILL.md'));
  assert.ok(report.added.other.includes('upstream-new.md'));
});
