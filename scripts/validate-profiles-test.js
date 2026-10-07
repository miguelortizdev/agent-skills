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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-skills-profiles-test-'));
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'registry'), { recursive: true });
  fs.mkdirSync(path.join(root, 'profiles'), { recursive: true });
  fs.mkdirSync(path.join(root, 'mcp'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'scripts', 'validate-profiles.js'), path.join(root, 'scripts', 'validate-profiles.js'));
  fs.copyFileSync(path.join(ROOT, 'registry', 'catalog.json'), path.join(root, 'registry', 'catalog.json'));
  fs.copyFileSync(path.join(ROOT, 'profiles', 'default.json'), path.join(root, 'profiles', 'default.json'));
  fs.copyFileSync(path.join(ROOT, 'profiles', 'decameron.json'), path.join(root, 'profiles', 'decameron.json'));
  fs.copyFileSync(path.join(ROOT, 'mcp', 'registry.json'), path.join(root, 'mcp', 'registry.json'));
  sandboxes.push(root);
  return root;
}

function run(root) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', 'validate-profiles.js')], {
    cwd: root,
    encoding: 'utf8',
  });
}

function readProfile(root) {
  const file = path.join(root, 'profiles', 'decameron.json');
  return { file, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
}

function readDefaultProfile(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'profiles', 'default.json'), 'utf8'));
}

afterEach(() => {
  for (const root of sandboxes.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

test('accepts profiles that reference catalog assets by matching type', () => {
  const result = run(makeSandbox());
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Profiles valid: 2 profiles/);
});

test('decameron selects the complete engineering foundation plus corporate MCP', () => {
  const root = makeSandbox();
  const decameron = readProfile(root);
  const generic = readDefaultProfile(root);
  assert.equal(decameron.data.skills.length, 26);
  assert.deepEqual(decameron.data.skills.filter((id) => !generic.skills.includes(id)), ['vercel-react-best-practices']);
  assert.equal(decameron.data.commands.length, 9);
  assert.deepEqual([...decameron.data.commands].sort(), [...generic.commands].sort());
  assert.equal(decameron.data.agents.length, 4);
  assert.deepEqual([...decameron.data.agents].sort(), [...generic.agents].sort());
  assert.equal(decameron.data.references.length, 7);
  assert.deepEqual([...decameron.data.references].sort(), [...generic.references].sort());
  assert.deepEqual(decameron.data.mcp.sort(), ['context7', 'kubernetes']);
  assert.equal(run(root).status, 0);
});

test('rejects missing asset references', () => {
  const root = makeSandbox();
  const { file, data } = readProfile(root);
  data.skills.push('missing-skill');
  fs.writeFileSync(file, JSON.stringify(data));
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /references missing asset/);
});

test('rejects references with the wrong asset type', () => {
  const root = makeSandbox();
  const { file, data } = readProfile(root);
  data.skills.push('code-reviewer');
  fs.writeFileSync(file, JSON.stringify(data));
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /expected skill/);
});

test('resolves profile MCP entries from the MCP registry', () => {
  const root = makeSandbox();
  const { file, data } = readProfile(root);
  data.mcp = ['kubernetes'];
  fs.writeFileSync(file, JSON.stringify(data));
  const result = run(root);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('rejects profiles with missing MCP entries', () => {
  const root = makeSandbox();
  const { file, data } = readProfile(root);
  data.mcp = ['missing-server'];
  fs.writeFileSync(file, JSON.stringify(data));
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing MCP server/);
});

test('resolves command dependencies and rejects dependency cycles', () => {
  const root = makeSandbox();
  const { file, data } = readProfile(root);
  data.commands = ['build'];
  fs.writeFileSync(file, JSON.stringify(data));
  const result = run(root);
  assert.equal(result.status, 0, result.stdout + result.stderr);

  const catalogFile = path.join(root, 'registry', 'catalog.json');
  const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
  const build = catalog.assets.find((asset) => asset.id === 'build');
  build.requires = ['build'];
  fs.writeFileSync(catalogFile, JSON.stringify(catalog));
  const cycle = run(root);
  assert.equal(cycle.status, 1);
  assert.match(cycle.stderr, /dependency cycle/);
});
