#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { validate } = require('./lib/json-schema');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'mcp', 'registry.json');
const SCHEMA_FILE = path.join(ROOT, 'mcp', 'schema.json');
const SECRET_FIELD = /(?:api[_-]?key|client[_-]?secret|password|passwd|secret|token|credential|authorization)/i;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const TRANSPORTS = new Set(['stdio', 'http']);

function readRegistry() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (error) {
    throw new Error(`mcp/registry.json: invalid JSON (${error.message})`);
  }
}

function readSchema() {
  try {
    return JSON.parse(fs.readFileSync(SCHEMA_FILE, 'utf8'));
  } catch (error) {
    throw new Error(`mcp/schema.json: invalid JSON (${error.message})`);
  }
}

function main() {
  const registry = readRegistry();
  try { validate(registry, readSchema()); } catch (error) { throw new Error(`registry does not match mcp/schema.json: ${error.message}`); }
  if (registry.schemaVersion !== 1) throw new Error('schemaVersion must be 1');
  if (!Array.isArray(registry.servers) || registry.servers.length === 0) throw new Error('servers must be a non-empty array');
  const ids = new Set();

  for (const server of registry.servers) {
    if (!server.id || !ID_PATTERN.test(server.id)) throw new Error(`invalid MCP server id: ${server.id || '<unknown>'}`);
    if (ids.has(server.id)) throw new Error(`duplicate MCP server id: ${server.id}`);
    ids.add(server.id);
    if (!TRANSPORTS.has(server.transport)) throw new Error(`unknown MCP transport for ${server.id}: ${server.transport}`);
    if (server.name !== undefined && typeof server.name !== 'string') throw new Error(`MCP name must be a string: ${server.id}`);
    if (SECRET_FIELD.test(server.id) || SECRET_FIELD.test(server.command || '') || SECRET_FIELD.test(server.url || '')) throw new Error(`secret-like MCP identifier: ${server.id}`);
    if (server.transport === 'stdio' && (!server.command || !Array.isArray(server.args))) throw new Error(`stdio MCP requires command and args: ${server.id}`);
    if (server.transport === 'http' && (!server.url || typeof server.url !== 'string' || !/^https?:\/\//.test(server.url))) throw new Error(`http MCP requires an http(s) url: ${server.id}`);
    if (server.transport === 'http' && (server.command !== undefined || server.args !== undefined)) throw new Error(`http MCP cannot define command or args: ${server.id}`);
    if (server.transport === 'stdio' && server.headers !== undefined) throw new Error(`stdio MCP cannot define HTTP headers: ${server.id}`);
    if (server.args && server.args.some((arg) => typeof arg !== 'string')) throw new Error(`MCP args must be strings: ${server.id}`);
    if (!server.env || Array.isArray(server.env) || typeof server.env !== 'object') throw new Error(`MCP env must be an object: ${server.id}`);
    for (const [key, variable] of Object.entries(server.env)) {
      if (!/^[A-Z][A-Z0-9_]*$/.test(key)) throw new Error(`invalid MCP environment variable name: ${key}`);
      if (!variable || variable.source !== 'environment' || !/^[A-Z][A-Z0-9_]*$/.test(variable.name)) throw new Error(`invalid MCP environment reference: ${server.id}.${key}`);
      if (Object.hasOwn(variable, 'value')) throw new Error(`inline MCP environment values are forbidden: ${server.id}.${key}`);
    }
    if (server.headers !== undefined) {
      if (!server.headers || typeof server.headers !== 'object' || Array.isArray(server.headers)) throw new Error(`MCP headers must be an object: ${server.id}`);
      for (const [key, value] of Object.entries(server.headers)) {
        if (!value || value.source !== 'environment' || !/^[A-Z][A-Z0-9_]*$/.test(value.name)) throw new Error(`invalid MCP header reference: ${server.id}.${key}`);
        if (value.prefix !== undefined && typeof value.prefix !== 'string') throw new Error(`invalid MCP header prefix: ${server.id}.${key}`);
      }
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
