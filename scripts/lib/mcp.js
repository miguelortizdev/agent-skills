'use strict';

const crypto = require('crypto');

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function resolveMcpServers(ids, registry) {
  if (!Array.isArray(ids)) throw new Error('profile.mcp must be an array');
  const servers = new Map((registry.servers || []).map((server) => [server.id, server]));
  const seen = new Set();
  return ids.map((id) => {
    if (!ID_PATTERN.test(id) || !servers.has(id)) throw new Error(`profile MCP references missing server: ${id}`);
    if (seen.has(id)) throw new Error(`profile MCP contains duplicate server: ${id}`);
    seen.add(id);
    return clone(servers.get(id));
  });
}

function environmentValue(reference, syntax) {
  const value = syntax === 'cursor'
    ? `\${env:${reference.name}}`
    : syntax === 'gemini'
      ? `\$${reference.name}`
      : syntax === 'opencode'
        ? `{env:${reference.name}}`
        : `\${${reference.name}}`;
  return `${reference.prefix || ''}${value}`;
}

function renderEnvironment(env, syntax) {
  return Object.fromEntries(Object.entries(env || {}).map(([key, reference]) => [key, environmentValue(reference, syntax)]));
}

function renderHeaders(headers, syntax) {
  return Object.fromEntries(Object.entries(headers || {}).map(([key, reference]) => [key, environmentValue(reference, syntax)]));
}

function renderJsonServer(server, representation) {
  if (server.transport === 'stdio') {
    const result = { command: server.command, args: server.args };
    if (representation.stdioType) result.type = representation.stdioType;
    if (Object.keys(server.env || {}).length) result.env = renderEnvironment(server.env, representation.envSyntax);
    return result;
  }
    const result = { [representation.remoteField || 'url']: server.url };
    if (representation.remoteType) result.type = representation.remoteType;
  if (Object.keys(server.headers || {}).length) result.headers = renderHeaders(server.headers, representation.envSyntax);
  return result;
}

function renderOpenCodeServer(server) {
  if (server.transport === 'stdio') {
    const result = { type: 'local', command: [server.command, ...server.args] };
    if (Object.keys(server.env || {}).length) result.environment = renderEnvironment(server.env, 'opencode');
    return result;
  }
  const result = { type: 'remote', url: server.url };
  if (Object.keys(server.headers || {}).length) result.headers = renderHeaders(server.headers, 'opencode');
  return result;
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function parseJsonConfig(text, file) {
  if (!text) return {};
  try { return JSON.parse(text); } catch (error) { throw new Error(`invalid MCP config ${file}: ${error.message}`); }
}

function mergeJsonConfig(text, file, servers, representation) {
  const config = parseJsonConfig(text, file);
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error(`invalid MCP config ${file}: root must be an object`);
  const rootKey = representation.rootKey || 'mcpServers';
  if (config[rootKey] === undefined) config[rootKey] = {};
  if (!config[rootKey] || typeof config[rootKey] !== 'object' || Array.isArray(config[rootKey])) throw new Error(`invalid MCP config ${file}: ${rootKey} must be an object`);
  const nestedRootKey = representation.nestedRootKey;
  const root = nestedRootKey
    ? (() => {
      if (config[rootKey][nestedRootKey] === undefined) config[rootKey][nestedRootKey] = {};
      if (!config[rootKey][nestedRootKey] || typeof config[rootKey][nestedRootKey] !== 'object' || Array.isArray(config[rootKey][nestedRootKey])) throw new Error(`invalid MCP config ${file}: ${rootKey}.${nestedRootKey} must be an object`);
      return config[rootKey][nestedRootKey];
    })()
    : config[rootKey];
  const entries = [];
  let changed = false;
  for (const server of servers) {
    const rendered = representation.render(server);
    const existing = root[server.id];
    if (existing !== undefined) {
      if (fingerprint(existing) !== fingerprint(rendered)) throw new Error(`MCP '${server.id}' already exists with a different configuration.`);
      entries.push({ id: server.id, fingerprint: fingerprint(rendered), created: false });
    } else {
      root[server.id] = rendered;
      entries.push({ id: server.id, fingerprint: fingerprint(rendered), created: true });
      changed = true;
    }
  }
  return { content: changed || !text ? `${JSON.stringify(config, null, 2)}\n` : text, changed, entries };
}

function tomlString(value) { return JSON.stringify(value); }

function validateCodexConfig(text, file) {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (/^\[[^\]]+\]$/.test(trimmed)) continue;
    if (/^[A-Za-z0-9_.-]+\s*=/.test(trimmed)) continue;
    throw new Error(`invalid MCP config ${file}: unsupported TOML line`);
  }
}

function renderCodexBlock(server) {
  const lines = [`[mcp_servers.${server.id}]`];
  if (server.transport === 'stdio') {
    lines.push(`command = ${tomlString(server.command)}`);
    lines.push(`args = ${tomlString(server.args)}`);
    const env = Object.entries(server.env || {});
    const mappings = env.filter(([key, reference]) => key !== reference.name);
    if (mappings.length) throw new Error(`Codex cannot safely represent STDIO environment mapping '${mappings[0][0]} <- ${mappings[0][1].name}'.`);
    if (env.length) lines.push(`env_vars = ${tomlString(env.map(([, reference]) => reference.name))}`);
  } else {
    lines.push(`url = ${tomlString(server.url)}`);
    const headers = Object.entries(server.headers || {});
    const authorization = headers.find(([name]) => name.toLowerCase() === 'authorization');
    if (authorization && authorization[1].prefix === 'Bearer ') lines.push(`bearer_token_env_var = ${tomlString(authorization[1].name)}`);
    const environmentHeaders = headers.filter(([name]) => !(name.toLowerCase() === 'authorization' && server.headers[name].prefix === 'Bearer '));
    const unsupported = environmentHeaders.find(([, reference]) => reference.prefix);
    if (unsupported) throw new Error(`Codex cannot safely represent header '${unsupported[0]}' with prefix/template semantics.`);
    if (environmentHeaders.length) {
      lines.push('[mcp_servers.' + server.id + '.env_http_headers]');
      for (const [name, reference] of environmentHeaders) lines.push(`${tomlKey(name)} = ${tomlString(reference.name)}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function tomlKey(value) {
  return /^[A-Za-z0-9_-]+$/.test(value) ? value : JSON.stringify(value);
}

function normalizeCodexBlock(text) {
  return text.split('\n').filter((line) => line.trim() !== 'args = []').join('\n').trim();
}

function codexBlocks(text) {
  const headers = [];
  const headerPattern = /^\[([^\]]+)\]\s*$/gm;
  let match;
  while ((match = headerPattern.exec(text))) headers.push({ name: match[1], start: match.index });
  return headers
    .filter((header) => /^mcp_servers\.[a-z0-9-]+$/.test(header.name))
    .map((header) => {
      const id = header.name.slice('mcp_servers.'.length);
      const next = headers.find((candidate) => candidate.start > header.start && !candidate.name.startsWith(`mcp_servers.${id}.`));
      const end = next ? next.start : text.length;
      return { id, start: header.start, end, content: text.slice(header.start, end) };
    });
}

function mergeCodexConfig(text, file, servers) {
  validateCodexConfig(text || '', file);
  let content = text || '';
  const entries = [];
  for (const server of servers) {
    const block = renderCodexBlock(server);
    const existing = codexBlocks(content).find((entry) => entry.id === server.id);
    if (existing) {
      if (normalizeCodexBlock(existing.content) !== normalizeCodexBlock(block)) throw new Error(`MCP '${server.id}' already exists with a different configuration.`);
      entries.push({ id: server.id, fingerprint: fingerprint(block), created: false });
    } else {
      if (content && !content.endsWith('\n')) content += '\n';
      content += `${content ? '\n' : ''}${block}`;
      entries.push({ id: server.id, fingerprint: fingerprint(block), created: true });
    }
  }
  return { content, changed: content !== text, entries };
}

function removeJsonEntries(text, file, entries, representation) {
  const config = parseJsonConfig(text, file);
  const rootConfig = config[representation.rootKey || 'mcpServers'];
  const root = representation.nestedRootKey ? rootConfig?.[representation.nestedRootKey] : rootConfig;
  if (!root || typeof root !== 'object') return { content: text, changed: false, modified: [] };
  const modified = [];
  let changed = false;
  for (const entry of entries) {
    if (!entry.created || root[entry.id] === undefined) continue;
    if (fingerprint(root[entry.id]) !== entry.fingerprint) { modified.push(entry.id); continue; }
    delete root[entry.id];
    changed = true;
  }
  return { content: changed ? `${JSON.stringify(config, null, 2)}\n` : text, changed, modified };
}

function removeCodexEntries(text, entries) {
  validateCodexConfig(text, '.codex/config.toml');
  let content = text;
  const modified = [];
  for (const entry of entries) {
    if (!entry.created) continue;
    const block = codexBlocks(content).find((candidate) => candidate.id === entry.id);
    if (!block) continue;
    if (fingerprint(`${block.content.trim()}\n`) !== entry.fingerprint && fingerprint(block.content) !== entry.fingerprint) { modified.push(entry.id); continue; }
    let start = block.start;
    if (start > 0 && content[start - 1] === '\n' && content[start - 2] === '\n') start -= 1;
    content = content.slice(0, start) + content.slice(block.end);
  }
  return { content, changed: content !== text, modified };
}

module.exports = {
  resolveMcpServers,
  renderJsonServer,
  renderOpenCodeServer,
  fingerprint,
  renderCodexBlock,
  normalizeCodexBlock,
  codexBlocks,
  mergeJsonConfig,
  mergeCodexConfig,
  removeJsonEntries,
  removeCodexEntries,
};
