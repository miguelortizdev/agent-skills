#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { afterEach, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const VALIDATOR = path.join(__dirname, 'validate-registry.js');
const sandboxes = [];

function makeSandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-skills-registry-test-'));
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'registry', 'schema'), { recursive: true });
  fs.mkdirSync(path.join(root, 'skills', 'example'), { recursive: true });
  fs.copyFileSync(VALIDATOR, path.join(root, 'scripts', 'validate-registry.js'));
  const sourceCatalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'registry', 'catalog.json'), 'utf8'));
  fs.writeFileSync(path.join(root, 'registry', 'catalog.json'), JSON.stringify(sourceCatalog));
  fs.copyFileSync(path.join(ROOT, 'registry', 'hosts.json'), path.join(root, 'registry', 'hosts.json'));
  for (const asset of sourceCatalog.assets) {
    const target = path.join(root, asset.path);
    if (path.extname(target)) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, 'placeholder');
    } else {
      fs.mkdirSync(target, { recursive: true });
    }
  }
  sandboxes.push(root);
  return root;
}

function run(root) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', 'validate-registry.js')], {
    cwd: root,
    encoding: 'utf8',
  });
}

function catalog(root) {
  const file = path.join(root, 'registry', 'catalog.json');
  return { file, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
}

afterEach(() => {
  for (const root of sandboxes.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

test('accepts a valid catalog and host registry', () => {
  const root = makeSandbox();
  const result = run(root);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Registry valid: 53 unique assets and 6 hosts/);
});

test('rejects duplicate asset IDs', () => {
  const root = makeSandbox();
  const { file, data } = catalog(root);
  data.assets.push({ ...data.assets[0] });
  fs.writeFileSync(file, JSON.stringify(data));
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /duplicate asset id/);
});

test('rejects missing asset paths', () => {
  const root = makeSandbox();
  const { file, data } = catalog(root);
  data.assets[0].path = 'skills/missing/SKILL.md';
  fs.writeFileSync(file, JSON.stringify(data));
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing asset path/);
});

test('rejects paths that escape the repository', () => {
  const root = makeSandbox();
  const { file, data } = catalog(root);
  data.assets[0].path = '../outside.txt';
  fs.writeFileSync(file, JSON.stringify(data));
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /asset path escapes repository/);
});

test('rejects unknown asset types', () => {
  const root = makeSandbox();
  const { file, data } = catalog(root);
  data.assets[0].type = 'plugin';
  fs.writeFileSync(file, JSON.stringify(data));
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unknown asset type/);
});

test('accepts declarative contextual skill matchers', () => {
  const root = makeSandbox();
  const { file, data } = catalog(root);
  data.assets[0].contextual = true;
  data.assets[0].appliesWhen = { any: [{ type: 'dependency', file: 'package.json', names: ['example'] }] };
  fs.writeFileSync(file, JSON.stringify(data));
  const result = run(root);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('rejects unknown contextual matcher types and unsafe paths', () => {
  const root = makeSandbox();
  const { file, data } = catalog(root);
  data.assets[0].contextual = true;
  data.assets[0].appliesWhen = { any: [{ type: 'regex', paths: ['../outside'] }] };
  fs.writeFileSync(file, JSON.stringify(data));
  let result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unknown contextual matcher type/);

  data.assets[0].appliesWhen = { any: [{ type: 'file', paths: ['../outside'] }] };
  fs.writeFileSync(file, JSON.stringify(data));
  result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /invalid contextual file matcher/);

  data.assets[0].appliesWhen = { any: [{ type: 'file', match: 'unknown', paths: ['package.json'] }] };
  fs.writeFileSync(file, JSON.stringify(data));
  result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /invalid contextual matcher mode/);
});
