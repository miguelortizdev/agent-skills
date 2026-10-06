#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PROFILE_DIR = path.join(ROOT, 'profiles');
const CATALOG_PATH = path.join(ROOT, 'registry', 'catalog.json');
const TYPES_BY_FIELD = {
  skills: 'skill',
  commands: 'command',
  agents: 'agent',
  references: 'reference',
  evals: 'eval',
  mcp: 'mcp',
};

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${path.relative(ROOT, file)}: invalid JSON (${error.message})`);
  }
}

function main() {
  const catalog = readJson(CATALOG_PATH);
  const assets = new Map(catalog.assets.map((asset) => [asset.id, asset]));
  const files = fs.readdirSync(PROFILE_DIR).filter((file) => file.endsWith('.json') && file !== 'schema.json').sort();
  if (files.length === 0) throw new Error('no profile files found');
  const names = new Set();

  for (const file of files) {
    const profile = readJson(path.join(PROFILE_DIR, file));
    if (names.has(profile.name)) throw new Error(`duplicate profile name: ${profile.name}`);
    names.add(profile.name);
    if (file !== `${profile.name}.json`) throw new Error(`profile filename does not match name: ${file}`);

    for (const [field, expectedType] of Object.entries(TYPES_BY_FIELD)) {
      if (!Array.isArray(profile[field])) throw new Error(`${profile.name}.${field} must be an array`);
      for (const id of profile[field]) {
        const asset = assets.get(id);
        if (!asset) throw new Error(`${profile.name}.${field} references missing asset: ${id}`);
        if (asset.type !== expectedType) throw new Error(`${profile.name}.${field} references ${id} of type ${asset.type}, expected ${expectedType}`);
      }
    }
  }

  console.log(`Profiles valid: ${files.length} profiles`);
}

try {
  main();
} catch (error) {
  console.error(`Profile validation failed: ${error.message}`);
  process.exit(1);
}
