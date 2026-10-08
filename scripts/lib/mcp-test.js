#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const mcp = require('./mcp');

function parseToml(text) {
  const result = spawnSync('python3', ['-c', 'import json,sys,tomllib; print(json.dumps(tomllib.loads(sys.stdin.read())))'], { input: text, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function server(overrides = {}) {
  return {
    name: 'Remote service',
    id: 'remote-service',
    transport: 'http',
    url: 'https://example.com/mcp',
    env: {},
    ...overrides,
  };
}

test('renders Claude HTTP with explicit transport and environment-backed headers', () => {
  const rendered = mcp.renderJsonServer(server({
    headers: {
      Authorization: { source: 'environment', name: 'MCP_TOKEN', prefix: 'Bearer ' },
    },
  }), { envSyntax: 'claude', remoteType: 'http' });
  assert.deepEqual(rendered, {
    url: 'https://example.com/mcp',
    type: 'http',
    headers: { Authorization: 'Bearer ${MCP_TOKEN}' },
  });
  assert.doesNotMatch(JSON.stringify(rendered), /secret|abc123/i);
});

test('resolves STDIO and HTTP profile IDs without leaking registry mutations', () => {
  const registry = { servers: [
    { name: 'Local', id: 'local', transport: 'stdio', command: 'server', args: [], env: {} },
    { name: 'Remote', id: 'remote', transport: 'http', url: 'https://example.com/mcp', env: {}, headers: {
      Authorization: { source: 'environment', name: 'MCP_TOKEN', prefix: 'Bearer ' },
    } },
  ] };
  const resolved = mcp.resolveMcpServers(['local', 'remote'], registry);
  assert.deepEqual(resolved.map((entry) => entry.transport), ['stdio', 'http']);
  resolved[1].headers.Authorization.name = 'CHANGED';
  assert.equal(registry.servers[1].headers.Authorization.name, 'MCP_TOKEN');
  assert.throws(() => mcp.resolveMcpServers(['missing'], registry), /missing server/);
});

test('renders Codex bearer and environment-backed HTTP headers without secrets', () => {
  const rendered = mcp.renderCodexBlock(server({
    headers: {
      Authorization: { source: 'environment', name: 'MCP_TOKEN', prefix: 'Bearer ' },
      'X-Tenant': { source: 'environment', name: 'MCP_TENANT' },
    },
  }));
  assert.match(rendered, /url = "https:\/\/example\.com\/mcp"/);
  assert.match(rendered, /bearer_token_env_var = "MCP_TOKEN"/);
  assert.match(rendered, /\[mcp_servers\.remote-service\.env_http_headers\]/);
  assert.match(rendered, /X-Tenant = "MCP_TENANT"/);
  assert.doesNotMatch(rendered, /Bearer|secret|abc123/);
  assert.deepEqual(parseToml(rendered).mcp_servers['remote-service'].env_http_headers, { 'X-Tenant': 'MCP_TENANT' });
});

test('parses generated Codex STDIO and multiple HTTP MCP servers as TOML', () => {
  const content = mcp.mergeCodexConfig('', '.codex/config.toml', [
    { name: 'Context7', id: 'context7', transport: 'stdio', command: 'npx', args: ['-y', 'context7'], env: { MCP_API_TOKEN: { source: 'environment', name: 'MCP_API_TOKEN' } } },
    server({ id: 'tenant', headers: { 'X-Tenant': { source: 'environment', name: 'MCP_TENANT' } } }),
  ]).content;
  const parsed = parseToml(content);
  assert.deepEqual(parsed.mcp_servers.context7.env_vars, ['MCP_API_TOKEN']);
  assert.equal(parsed.mcp_servers.tenant.url, 'https://example.com/mcp');
  assert.deepEqual(parsed.mcp_servers.tenant.env_http_headers, { 'X-Tenant': 'MCP_TENANT' });
});

test('rejects Codex header prefixes and STDIO renames it cannot preserve', () => {
  assert.throws(() => mcp.renderCodexBlock(server({ headers: {
    'X-Custom': { source: 'environment', name: 'TOKEN', prefix: 'Token ' },
  } })), /cannot safely represent header/);
  assert.throws(() => mcp.renderCodexBlock({
    name: 'Local', id: 'local', transport: 'stdio', command: 'server', args: [], env: {
      TARGET_KEY: { source: 'environment', name: 'SOURCE_KEY' },
    },
  }), /cannot safely represent STDIO environment mapping/);
});

test('keeps Codex unrelated tables outside MCP blocks', () => {
  const before = '[mcp_servers.context7]\ncommand = "npx"\n\n[features]\nsome_setting = true\n';
  const merged = mcp.mergeCodexConfig(before, '.codex/config.toml', [{
    name: 'Context7', id: 'context7', transport: 'stdio', command: 'npx', args: [], env: {},
  }]);
  assert.equal(merged.changed, false);
  assert.match(merged.content, /\[features\]\nsome_setting = true/);
  assert.deepEqual(mcp.codexBlocks(before).map((block) => block.content.trim()), [
    '[mcp_servers.context7]\ncommand = "npx"',
  ]);
});

test('removes an MCP block while preserving following TOML tables', () => {
  const before = '[mcp_servers.context7]\ncommand = "npx"\n\n[features]\nsome_setting = true\n';
  const result = mcp.removeCodexEntries(before, [{
    id: 'context7', created: true, fingerprint: mcp.fingerprint('[mcp_servers.context7]\ncommand = "npx"\n'),
  }]);
  assert.equal(result.modified.length, 0);
  assert.match(result.content, /\[features\]\nsome_setting = true/);
  assert.doesNotMatch(result.content, /\[mcp_servers\.context7\]/);
});
