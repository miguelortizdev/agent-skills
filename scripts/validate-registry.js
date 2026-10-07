#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CATALOG_PATH = path.join(ROOT, 'registry', 'catalog.json');
const HOSTS_PATH = path.join(ROOT, 'registry', 'hosts.json');
const ASSET_TYPES = new Set(['skill', 'command', 'agent', 'reference', 'eval', 'hook', 'script']);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${path.relative(ROOT, file)}: invalid JSON (${error.message})`);
  }
}

function resolveRepositoryPath(relativePath) {
  if (path.isAbsolute(relativePath)) throw new Error(`absolute asset path is not allowed: ${relativePath}`);
  const resolved = path.resolve(ROOT, relativePath);
  const relative = path.relative(ROOT, resolved);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`asset path escapes repository: ${relativePath}`);
  }
  return resolved;
}

function validateContextRules(asset) {
  if (asset.contextual === undefined && asset.appliesWhen === undefined) return;
  if (asset.type !== 'skill' || asset.contextual !== true) throw new Error(`contextual metadata requires contextual skill: ${asset.id}`);
  if (asset.tags !== undefined && (!Array.isArray(asset.tags) || asset.tags.some((tag) => typeof tag !== 'string' || !tag))) throw new Error(`invalid contextual tags for ${asset.id}`);
  const rules = asset.appliesWhen && asset.appliesWhen.any;
  if (!Array.isArray(rules) || rules.length === 0) throw new Error(`contextual skill requires non-empty appliesWhen.any: ${asset.id}`);
  for (const rule of rules) {
    if (!['dependency', 'file', 'text'].includes(rule.type)) throw new Error(`unknown contextual matcher type for ${asset.id}: ${rule.type}`);
    if (rule.match !== undefined && !['basename', 'relative', 'suffix'].includes(rule.match)) throw new Error(`invalid contextual matcher mode for ${asset.id}: ${rule.match}`);
    if (rule.type === 'dependency') {
      if (!Array.isArray(rule.names) || rule.names.length === 0 || rule.names.some((name) => typeof name !== 'string' || !name)) throw new Error(`invalid dependency matcher for ${asset.id}`);
      if (rule.file !== undefined) { if (path.isAbsolute(rule.file) || rule.file.includes('..')) throw new Error(`invalid contextual matcher path for ${asset.id}`); }
    }
    if (rule.type === 'file') {
      if (!Array.isArray(rule.paths) || rule.paths.length === 0) throw new Error(`invalid file matcher for ${asset.id}`);
      for (const file of rule.paths) if (typeof file !== 'string' || path.isAbsolute(file) || file.includes('..') || file.includes('*')) throw new Error(`invalid contextual file matcher for ${asset.id}`);
    }
    if (rule.type === 'text') {
      if (!Array.isArray(rule.files) || !Array.isArray(rule.patterns) || rule.files.length === 0 || rule.patterns.length === 0) throw new Error(`invalid text matcher for ${asset.id}`);
      for (const file of rule.files) if (typeof file !== 'string' || path.isAbsolute(file) || file.includes('..')) throw new Error(`invalid contextual text path for ${asset.id}`);
      for (const pattern of rule.patterns) if (typeof pattern !== 'string' || !pattern) throw new Error(`invalid contextual text pattern for ${asset.id}`);
    }
  }
}

function validateCatalog(catalog) {
  if (catalog.sourceOfTruth !== 'repository-root') throw new Error('catalog sourceOfTruth must be repository-root');
  if (!Array.isArray(catalog.assets) || catalog.assets.length === 0) throw new Error('catalog assets must be a non-empty array');

  const ids = new Set();
  for (const asset of catalog.assets) {
    for (const field of ['id', 'type', 'path', 'source', 'enabled']) {
      if (!(field in asset)) throw new Error(`asset is missing required field: ${field}`);
    }
    if (ids.has(asset.id)) throw new Error(`duplicate asset id: ${asset.id}`);
    ids.add(asset.id);
    if (!ASSET_TYPES.has(asset.type)) throw new Error(`unknown asset type for ${asset.id}: ${asset.type}`);
    const file = resolveRepositoryPath(asset.path);
    if (!fs.existsSync(file)) throw new Error(`missing asset path for ${asset.id}: ${asset.path}`);
    if (asset.source !== 'upstream' && asset.source !== 'custom') throw new Error(`invalid source for ${asset.id}: ${asset.source}`);
    if (typeof asset.enabled !== 'boolean') throw new Error(`enabled must be boolean for ${asset.id}`);
    validateContextRules(asset);
  }
  return ids;
}

function validateHosts() {
  const hosts = readJson(HOSTS_PATH);
  if (!Array.isArray(hosts.hosts) || hosts.hosts.length === 0) throw new Error('hosts must be a non-empty array');
  const ids = new Set();
  for (const host of hosts.hosts) {
    if (ids.has(host.id)) throw new Error(`duplicate host id: ${host.id}`);
    ids.add(host.id);
    if (!Array.isArray(host.nativePaths) || !Array.isArray(host.capabilities)) {
      throw new Error(`host ${host.id} must define nativePaths and capabilities arrays`);
    }
    if (!/^adapters\/[a-z0-9-]+$/.test(host.adapterPath)) throw new Error(`invalid adapter path for ${host.id}`);
  }
}

function main() {
  const ids = validateCatalog(readJson(CATALOG_PATH));
  validateHosts();
  console.log(`Registry valid: ${ids.size} unique assets and ${readJson(HOSTS_PATH).hosts.length} hosts`);
}

try {
  main();
} catch (error) {
  console.error(`Registry validation failed: ${error.message}`);
  process.exit(1);
}
