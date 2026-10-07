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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-skills-mcp-test-'));
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'mcp'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'scripts', 'validate-mcp.js'), path.join(root, 'scripts', 'validate-mcp.js'));
  fs.copyFileSync(path.join(ROOT, 'mcp', 'registry.json'), path.join(root, 'mcp', 'registry.json'));
  sandboxes.push(root);
  return root;
}

function run(root) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', 'validate-mcp.js')], {
    cwd: root,
    encoding: 'utf8',
  });
}

function registry(root) {
  const file = path.join(root, 'mcp', 'registry.json');
  return { file, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
}

afterEach(() => {
  for (const root of sandboxes.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

test('accepts provider-neutral environment references', () => {
  const result = run(makeSandbox());
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /MCP registry valid: 2 servers/);
});

test('rejects inline environment values', () => {
  const root = makeSandbox();
  const { file, data } = registry(root);
  data.servers[0].env.KUBECONFIG.value = 'secret-value';
  fs.writeFileSync(file, JSON.stringify(data));
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /inline MCP environment values are forbidden/);
});

test('rejects duplicate server IDs', () => {
  const root = makeSandbox();
  const { file, data } = registry(root);
  data.servers.push({ ...data.servers[0] });
  fs.writeFileSync(file, JSON.stringify(data));
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /duplicate MCP server id/);
});

test('rejects unknown transports and invalid URLs', () => {
  const root = makeSandbox();
  const { file, data } = registry(root);
  data.servers[0].transport = 'websocket';
  fs.writeFileSync(file, JSON.stringify(data));
  let result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unknown MCP transport/);

  data.servers[0].transport = 'http';
  data.servers[0].url = 'not-a-url';
  fs.writeFileSync(file, JSON.stringify(data));
  result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /requires an http/);
});

test('rejects plaintext secrets and invalid environment references', () => {
  const root = makeSandbox();
  const { file, data } = registry(root);
  data.servers[0].env.KUBECONFIG = { source: 'literal', value: 'secret' };
  fs.writeFileSync(file, JSON.stringify(data));
  let result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /invalid MCP environment reference/);

  data.servers[0].env.KUBECONFIG = { source: 'environment', name: 'API_TOKEN' };
  fs.writeFileSync(file, JSON.stringify(data));
  result = run(root);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('accepts HTTP servers with environment-backed header prefixes', () => {
  const root = makeSandbox();
  const { file, data } = registry(root);
  data.servers.push({
    name: 'Remote service',
    id: 'remote-service',
    transport: 'http',
    url: 'https://example.com/mcp',
    env: {},
    headers: {
      Authorization: { source: 'environment', name: 'MCP_TOKEN', prefix: 'Bearer ' },
    },
  });
  fs.writeFileSync(file, JSON.stringify(data));
  const result = run(root);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('rejects HTTP headers with literal values', () => {
  const root = makeSandbox();
  const { file, data } = registry(root);
  data.servers.push({
    name: 'Remote service', id: 'remote-service', transport: 'http', url: 'https://example.com/mcp', env: {},
    headers: { Authorization: 'Bearer real-secret-value' },
  });
  fs.writeFileSync(file, JSON.stringify(data));
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /invalid MCP header reference/);
});
