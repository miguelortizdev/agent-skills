#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'mcp', 'registry.json');
const SECRET_FIELD = /(?:api[_-]?key|client[_-]?secret|password|passwd|secret|token|credential)/i;

function readRegistry() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (error) {
    throw new Error(`mcp/registry.json: invalid JSON (${error.message})`);
  }
}

function main() {
  const registry = readRegistry();
  if (!Array.isArray(registry.servers) || registry.servers.length === 0) throw new Error('servers must be a non-empty array');
  const ids = new Set();

  for (const server of registry.servers) {
    if (ids.has(server.id)) throw new Error(`duplicate MCP server id: ${server.id}`);
    ids.add(server.id);
    if (!server.id || !server.command || !Array.isArray(server.args) || !Array.isArray(server.environment)) {
      throw new Error(`MCP server ${server.id || '<unknown>'} has an incomplete definition`);
    }
    if (SECRET_FIELD.test(server.id) || SECRET_FIELD.test(server.command)) throw new Error(`secret-like MCP identifier: ${server.id}`);
    if (server.args.some((arg) => typeof arg !== 'string')) throw new Error(`MCP args must be strings: ${server.id}`);
    const environmentNames = new Set();
    for (const variable of server.environment) {
      if (!/^[A-Z][A-Z0-9_]*$/.test(variable.name)) throw new Error(`invalid environment variable name: ${variable.name}`);
      if (environmentNames.has(variable.name)) throw new Error(`duplicate environment variable: ${variable.name}`);
      environmentNames.add(variable.name);
      if (variable.valueFrom !== 'environment') throw new Error(`MCP environment must use valueFrom=environment: ${variable.name}`);
      if (Object.hasOwn(variable, 'value')) throw new Error(`inline MCP environment values are forbidden: ${variable.name}`);
      if (SECRET_FIELD.test(variable.name)) continue;
    }
  }

  console.log(`MCP registry valid: ${ids.size} servers`);
}

try {
  main();
} catch (error) {
  console.error(`MCP validation failed: ${error.message}`);
  process.exit(1);
}
