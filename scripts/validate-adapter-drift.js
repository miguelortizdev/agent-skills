#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HOSTS_FILE = path.join(ROOT, 'registry', 'hosts.json');
const CATALOG_FILE = path.join(ROOT, 'registry', 'catalog.json');
const REQUIRED_MAPPING_TYPES = ['skills', 'commands', 'agents', 'references', 'evals', 'hooks', 'mcp'];

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${path.relative(ROOT, file)}: invalid JSON (${error.message})`);
  }
}

function main() {
  const hosts = readJson(HOSTS_FILE).hosts;
  const catalog = readJson(CATALOG_FILE);
  const catalogTypes = new Set(catalog.assets.map((asset) => asset.type));
  const hostIds = new Set();

  for (const host of hosts) {
    if (hostIds.has(host.id)) throw new Error(`duplicate host in registry: ${host.id}`);
    hostIds.add(host.id);
    const adapterFile = path.join(ROOT, host.adapterPath, 'adapter.json');
    if (!fs.existsSync(adapterFile)) throw new Error(`missing adapter for ${host.id}: ${host.adapterPath}`);
    const adapter = readJson(adapterFile);
    if (adapter.host !== host.id) throw new Error(`adapter host mismatch for ${host.id}`);
    if (!adapter.mapping || typeof adapter.mapping !== 'object') throw new Error(`adapter mapping missing for ${host.id}`);

    for (const type of REQUIRED_MAPPING_TYPES) {
      const catalogType = type === 'skills' ? 'skill' : type === 'commands' ? 'command' : type === 'agents' ? 'agent' : type === 'references' ? 'reference' : type === 'evals' ? 'eval' : type === 'hooks' ? 'hook' : type === 'mcp' ? 'mcp' : null;
      if (catalogType && catalogTypes.has(catalogType) && !Object.hasOwn(adapter.mapping, type)) {
        throw new Error(`adapter ${host.id} does not map registered ${type}`);
      }
    }
    const hostCapabilities = new Set(host.capabilities || []);
    for (const capability of adapter.nativeCapabilities || []) {
      if (!hostCapabilities.has(capability)) throw new Error(`registry host ${host.id} omits native capability ${capability}`);
    }
    for (const capability of hostCapabilities) {
      if (!Object.hasOwn(adapter.mapping, capability)) throw new Error(`adapter ${host.id} does not map registry capability ${capability}`);
    }
    const destinations = adapter.installDestinations;
    if (!destinations || !destinations.project || !destinations.global) {
      throw new Error(`adapter ${host.id} must declare project and global install destinations`);
    }
    for (const scope of ['project', 'global']) {
      for (const [type, destination] of Object.entries(destinations[scope])) {
        if (typeof destination !== 'string' || !destination || path.isAbsolute(destination) || destination.split('/').includes('..')) {
          throw new Error(`adapter ${host.id} has invalid ${scope} destination for ${type}`);
        }
      }
    }
    if (adapter.commandRepresentation && !hostCapabilities.has('commands')) {
      throw new Error(`adapter ${host.id} declares command representation without registry commands capability`);
    }
    for (const type of ['skills', 'commands', 'agents']) {
      const destination = destinations.project[type];
      if (destination && !host.nativePaths.includes(destination)) {
        throw new Error(`registry host ${host.id} omits native path ${destination}`);
      }
    }
    if (Object.hasOwn(adapter, 'canonicalCopies')) throw new Error(`adapter ${host.id} declares canonicalCopies; adapters must remain thin`);
  }

  console.log(`Adapter drift check passed: ${hostIds.size} hosts`);
}

try {
  main();
} catch (error) {
  console.error(`Adapter drift validation failed: ${error.message}`);
  process.exit(1);
}
