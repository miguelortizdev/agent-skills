#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { afterEach, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'install-agent-standard.js');
const sandboxes = [];

function makeSandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-skills-install-test-'));
  sandboxes.push(root);
  return root;
}

function run(root, ...args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { cwd: root, encoding: 'utf8' });
}

afterEach(() => {
  for (const root of sandboxes.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

test('dry-run reports actions without writing files', () => {
  const root = makeSandbox();
  const result = run(root, '--host', 'cursor', '--profile', 'decameron', '--project', '--dry-run');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /would copy/);
  assert.match(result.stdout, /No files changed/);
  assert.equal(fs.existsSync(path.join(root, '.cursor')), false);
});

test('safe install is idempotent for identical files', () => {
  const root = makeSandbox();
  const first = run(root, '--host', 'cursor', '--profile', 'decameron', '--project');
  assert.equal(first.status, 0, first.stdout + first.stderr);
  assert.equal(fs.existsSync(path.join(root, '.cursor', 'skills', 'api-and-interface-design', 'SKILL.md')), true);
  const second = run(root, '--host', 'cursor', '--profile', 'decameron', '--project');
  assert.equal(second.status, 0, second.stdout + second.stderr);
});

test('safe install refuses conflicting files', () => {
  const root = makeSandbox();
  const first = run(root, '--host', 'cursor', '--profile', 'decameron', '--project');
  assert.equal(first.status, 0, first.stdout + first.stderr);
  const target = path.join(root, '.cursor', 'skills', 'api-and-interface-design', 'SKILL.md');
  fs.appendFileSync(target, '\nlocal modification\n');
  const conflict = run(root, '--host', 'cursor', '--profile', 'decameron', '--project');
  assert.equal(conflict.status, 1);
  assert.match(conflict.stderr, /refusing to overwrite existing files/);
});

test('safe install refuses symlinked destination directories', () => {
  const root = makeSandbox();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-skills-install-outside-'));
  try {
    fs.mkdirSync(path.join(root, '.cursor'), { recursive: true });
    fs.symlinkSync(outside, path.join(root, '.cursor', 'skills'), 'dir');
    const result = run(root, '--host', 'cursor', '--profile', 'decameron', '--project');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /refusing to write through symlink/);
  } finally {
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test('records ownership and uninstalls only the selected profile', () => {
  const root = makeSandbox();
  const install = run(root, '--host', 'cursor', '--profile', 'decameron', '--project');
  assert.equal(install.status, 0, install.stdout + install.stderr);
  const manifestPath = path.join(root, '.agent-standard', 'installation.json');
  assert.equal(fs.existsSync(manifestPath), true);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.profile, 'decameron');
  assert.ok(manifest.files.length > 0);

  const uninstall = run(root, '--host', 'cursor', '--profile', 'decameron', '--project', '--uninstall');
  assert.equal(uninstall.status, 0, uninstall.stdout + uninstall.stderr);
  assert.equal(fs.existsSync(path.join(root, '.cursor')), false);
  assert.equal(fs.existsSync(manifestPath), false);
});

test('refuses to mix profiles until the installed profile is removed', () => {
  const root = makeSandbox();
  const install = run(root, '--host', 'cursor', '--profile', 'decameron', '--project');
  assert.equal(install.status, 0, install.stdout + install.stderr);
  const second = run(root, '--host', 'cursor', '--profile', 'default', '--project');
  assert.equal(second.status, 1);
  assert.match(second.stderr, /already installed/);
});

test('does not uninstall a file modified after installation', () => {
  const root = makeSandbox();
  const install = run(root, '--host', 'cursor', '--profile', 'decameron', '--project');
  assert.equal(install.status, 0, install.stdout + install.stderr);
  const target = path.join(root, '.cursor', 'skills', 'api-and-interface-design', 'SKILL.md');
  fs.appendFileSync(target, '\nlocal modification\n');
  const uninstall = run(root, '--host', 'cursor', '--profile', 'decameron', '--project', '--uninstall');
  assert.equal(uninstall.status, 1);
  assert.match(uninstall.stderr, /modified files/);
  assert.equal(fs.existsSync(target), true);
});
