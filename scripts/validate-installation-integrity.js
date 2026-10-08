#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TYPE_FIELDS = { skill: 'skills', command: 'commands', agent: 'agents', reference: 'references' };

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') options.root = argv[++index];
    else if (arg === '--host') options.host = argv[++index];
    else if (arg === '--profile') options.profile = argv[++index];
    else if (arg === '--scope') options.scope = argv[++index];
    else throw new Error(`unknown option: ${arg}`);
  }
  if (!options.root || !options.host || !options.profile) throw new Error('--root, --host, and --profile are required');
  if (options.scope && !['project', 'global'].includes(options.scope)) throw new Error('--scope must be project or global');
  return options;
}

function filesIn(root, relative = '') {
  const current = path.join(root, relative);
  if (!fs.existsSync(current)) return [];
  return fs.readdirSync(current).flatMap((entry) => {
    const child = path.join(relative, entry);
    return fs.lstatSync(path.join(root, child)).isDirectory() ? filesIn(root, child) : [child];
  });
}

function resolveProfile(profile, assets) {
  const resolved = { ...profile };
  const visiting = new Set();
  const visited = new Set();
  function add(id) {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`dependency cycle: ${id}`);
    const asset = assets.get(id);
    if (!asset) throw new Error(`missing asset dependency: ${id}`);
    visiting.add(id);
    for (const dependency of asset.requires || []) add(dependency);
    visiting.delete(id);
    visited.add(id);
    const field = TYPE_FIELDS[asset.type];
    if (field && !resolved[field].includes(id)) resolved[field].push(id);
  }
  for (const field of Object.values(TYPE_FIELDS)) resolved[field] = [...(profile[field] || [])];
  for (const field of Object.values(TYPE_FIELDS)) for (const id of resolved[field]) add(id);
  return resolved;
}

function markdownLinks(content) {
  return [...content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1].trim());
}

function checkMarkdownTargets(file, content, installRoot, skillDestination, referenceDestination, commandContext = false) {
  const missing = [];
  for (const raw of markdownLinks(content)) {
    if (/^(?:[a-z]+:|#|mailto:)/i.test(raw)) continue;
    const target = raw.split(/[?#]/, 1)[0];
    const resolved = path.resolve(path.dirname(file), target);
    if (!fs.existsSync(resolved)) missing.push(`${path.relative(installRoot, file)} -> ${raw}`);
  }
  for (const raw of content.match(/(?:bash |`)(skills\/[^\s`]+)/g) || []) {
    const relative = raw.replace(/^(?:bash |`)/, '');
    const resolved = path.join(installRoot, skillDestination, relative.slice('skills/'.length));
    if (!fs.existsSync(resolved)) missing.push(`${path.relative(installRoot, file)} -> ${relative}`);
  }
  for (const match of content.matchAll(/`([^`\n]*\breferences\/[^`\n]*)`/g)) {
    const raw = match[1].trim().split('#', 1)[0];
    const resolved = commandContext
      ? path.join(installRoot, referenceDestination, raw.replace(/^references\//, ''))
      : path.resolve(path.dirname(file), raw);
    if (!fs.existsSync(resolved)) missing.push(`${path.relative(installRoot, file)} -> ${raw}`);
  }
  return missing;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const catalog = readJson(path.join(ROOT, 'registry', 'catalog.json'));
  const assets = new Map(catalog.assets.map((asset) => [asset.id, asset]));
  const profile = resolveProfile(readJson(path.join(ROOT, 'profiles', `${options.profile}.json`)), assets);
  const host = readJson(path.join(ROOT, 'registry', 'hosts.json')).hosts.find((entry) => entry.id === options.host);
  if (!host) throw new Error(`unknown host: ${options.host}`);
  const adapter = readJson(path.join(ROOT, host.adapterPath, 'adapter.json'));
  const installRoot = path.resolve(options.root);
  const destinations = adapter.installDestinations[options.scope || 'project'];
  const missing = [];
  const sourceSkillRoot = path.join(ROOT, 'skills');
  const skillDestination = destinations.skills;
  const referenceDestination = destinations.references;

  for (const id of profile.skills) {
    const source = path.join(sourceSkillRoot, id);
    const target = path.join(installRoot, skillDestination, id);
    for (const relative of filesIn(source)) {
      const installed = path.join(target, relative);
      if (!fs.existsSync(installed)) {
        missing.push(`${skillDestination}/${id}/${relative}`);
      } else if (!fs.readFileSync(installed).equals(fs.readFileSync(path.join(source, relative)))) {
        missing.push(`${skillDestination}/${id}/${relative} (content mismatch)`);
      }
    }
    for (const relative of filesIn(target).filter((file) => file.endsWith('.md'))) {
      const file = path.join(target, relative);
      missing.push(...checkMarkdownTargets(file, fs.readFileSync(file, 'utf8'), installRoot, skillDestination, referenceDestination));
    }
  }

  for (const id of profile.references) {
    if (!fs.existsSync(path.join(installRoot, referenceDestination, `${id}.md`))) missing.push(`${referenceDestination}/${id}.md`);
  }
  const commandRepresentation = adapter.commandRepresentation;
  if (commandRepresentation && destinations.commands) {
    for (const id of profile.commands) {
      const filename = commandRepresentation.filenameMap?.[id] || id;
      const commandFile = path.join(installRoot, destinations.commands, `${filename}${commandRepresentation.extension}`);
      if (!fs.existsSync(commandFile)) {
        if (!adapter.nativeCapabilities?.includes('commands')) continue;
        missing.push(path.relative(installRoot, commandFile));
        continue;
      }
      if (commandRepresentation.extension === '.md') {
        missing.push(...checkMarkdownTargets(commandFile, fs.readFileSync(commandFile, 'utf8'), installRoot, skillDestination, referenceDestination, true));
      }
    }
  }
  for (const id of profile.agents) {
    const target = adapter.agentRepresentation?.format === 'toml'
      ? path.join(installRoot, destinations.agents, `${id}.toml`)
      : path.join(installRoot, destinations.agents, `${id}.md`);
    if (!fs.existsSync(target)) missing.push(path.relative(installRoot, target));
    const support = path.join(installRoot, path.dirname(destinations.agents), 'docs', 'agents.md');
    if (!fs.existsSync(support)) missing.push(path.relative(installRoot, support));
  }

  if (missing.length) throw new Error(`broken installed references or assets:\n${missing.join('\n')}`);
  console.log(`Installation integrity valid: ${options.host}/${options.profile}`);
}

try { main(); } catch (error) {
  console.error(`Installation integrity failed: ${error.message}`);
  process.exit(1);
}
