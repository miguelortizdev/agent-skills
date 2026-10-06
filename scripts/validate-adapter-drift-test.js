#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { afterEach, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const sandboxes = [];

function makeSandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-skills-adapter-test-'));
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'registry'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'scripts', 'validate-adapter-drift.js'), path.join(root, 'scripts', 'validate-adapter-drift.js'));
  fs.copyFileSync(path.join(ROOT, 'registry', 'catalog.json'), path.join(root, 'registry', 'catalog.json'));
  const hosts = JSON.parse(fs.readFileSync(path.join(ROOT, 'registry', 'hosts.json'), 'utf8'));
  fs.writeFileSync(path.join(root, 'registry', 'hosts.json'), JSON.stringify(hosts));
  for (const host of hosts.hosts) {
    const source = path.join(ROOT, host.adapterPath, 'adapter.json');
    const target = path.join(root, host.adapterPath, 'adapter.json');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
  sandboxes.push(root);
  return root;
}

function run(root) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', 'validate-adapter-drift.js')], {
    cwd: root,
    encoding: 'utf8',
  });
}

afterEach(() => {
  for (const root of sandboxes.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

test('accepts adapters that map all registered capability types', () => {
  const result = run(makeSandbox());
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Adapter drift check passed: 6 hosts/);
});

test('rejects a missing adapter', () => {
  const root = makeSandbox();
  fs.rmSync(path.join(root, 'adapters', 'cursor'), { recursive: true, force: true });
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing adapter for cursor/);
});

test('rejects adapters that declare duplicated canonical content', () => {
  const root = makeSandbox();
  const file = path.join(root, 'adapters', 'codex', 'adapter.json');
  const adapter = JSON.parse(fs.readFileSync(file, 'utf8'));
  adapter.canonicalCopies = ['skills/spec-driven-development/SKILL.md'];
  fs.writeFileSync(file, JSON.stringify(adapter));
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /canonicalCopies/);
});
