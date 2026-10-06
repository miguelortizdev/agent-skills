#!/usr/bin/env node

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CATALOG_FILE = path.join(ROOT, 'registry', 'catalog.json');
const PROFILE_DIR = path.join(ROOT, 'profiles');
const HOST_DIR = path.join(ROOT, 'registry', 'hosts.json');
const TYPE_FIELDS = { skill: 'skills', command: 'commands', agent: 'agents', reference: 'references' };

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function parseArgs(argv) {
  const options = { dryRun: false, global: false, project: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--global') options.global = true;
    else if (arg === '--project') options.project = true;
    else if (arg === '--host') options.host = argv[++index];
    else if (arg === '--profile') options.profile = argv[++index];
    else throw new Error(`unknown option: ${arg}`);
  }
  if (!options.host) throw new Error('--host is required');
  if (!options.profile) throw new Error('--profile is required');
  if (options.global === options.project) throw new Error('choose exactly one of --global or --project');
  return options;
}

function safePath(root, relativePath) {
  if (!relativePath || path.isAbsolute(relativePath)) throw new Error(`unsafe destination path: ${relativePath}`);
  const resolved = path.resolve(root, relativePath);
  const back = path.relative(root, resolved);
  if (!back || back === '..' || back.startsWith(`..${path.sep}`) || path.isAbsolute(back)) {
    throw new Error(`destination escapes install root: ${relativePath}`);
  }
  return resolved;
}

function assertNoSymlinkPath(root, target) {
  let current = target;
  while (current !== root && current.startsWith(`${root}${path.sep}`)) {
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
      throw new Error(`refusing to write through symlink: ${current}`);
    }
    current = path.dirname(current);
  }
}

function filesIn(source, relative = '') {
  const current = path.join(source, relative);
  const stat = fs.lstatSync(current);
  if (stat.isSymbolicLink()) throw new Error(`source symlink is not installable: ${path.relative(ROOT, current)}`);
  if (stat.isFile()) return [{ source: current, relative: relative || path.basename(current) }];
  return fs.readdirSync(current).flatMap((entry) => filesIn(source, path.join(relative, entry)));
}

function buildPlan(options) {
  const catalog = readJson(CATALOG_FILE);
  const profile = readJson(path.join(PROFILE_DIR, `${options.profile}.json`));
  if (profile.name !== options.profile) throw new Error(`profile filename does not match name: ${options.profile}`);
  const hosts = readJson(HOST_DIR).hosts;
  const host = hosts.find((entry) => entry.id === options.host);
  if (!host) throw new Error(`unknown host: ${options.host}`);
  const adapter = readJson(path.join(ROOT, host.adapterPath, 'adapter.json'));
  const assets = new Map(catalog.assets.map((asset) => [asset.id, asset]));
  const installRoot = options.global ? os.homedir() : process.cwd();
  const actions = [];
  const skipped = [];

  for (const [type, field] of Object.entries(TYPE_FIELDS)) {
    const destination = adapter.installDestinations && adapter.installDestinations[field];
    for (const id of profile[field] || []) {
      const asset = assets.get(id);
      if (!asset || asset.type !== type) throw new Error(`${profile.name}.${field} references an invalid ${type}: ${id}`);
      if (!destination) {
        skipped.push(`${field}/${id}: host has no native destination; use documented fallback`);
        continue;
      }
      const source = path.join(ROOT, asset.path);
      const targetBase = safePath(installRoot, destination);
      const sourceIsDirectory = fs.lstatSync(source).isDirectory();
      for (const entry of filesIn(source)) {
        const targetRelative = type === 'skill' || sourceIsDirectory ? path.join(id, entry.relative) : entry.relative;
        const target = safePath(targetBase, targetRelative);
        actions.push({ source: entry.source, target });
      }
    }
  }
  return { options, host, profile, installRoot, actions, skipped };
}

function execute(plan) {
  const conflicts = [];
  for (const action of plan.actions) {
    assertNoSymlinkPath(plan.installRoot, path.dirname(action.target));
    if (fs.existsSync(action.target)) {
      if (fs.lstatSync(action.target).isSymbolicLink()) throw new Error(`refusing to write through symlink: ${action.target}`);
      if (fs.readFileSync(action.source).equals(fs.readFileSync(action.target))) continue;
      conflicts.push(action.target);
    }
  }
  if (conflicts.length) throw new Error(`refusing to overwrite existing files:\n${conflicts.join('\n')}`);
  for (const action of plan.actions) {
    if (fs.existsSync(action.target)) continue;
    fs.mkdirSync(path.dirname(action.target), { recursive: true });
    fs.copyFileSync(action.source, action.target, fs.constants.COPYFILE_EXCL);
  }
}

function main() {
  const plan = buildPlan(parseArgs(process.argv.slice(2)));
  console.log(`${plan.options.dryRun ? 'Dry run' : 'Install'}: ${plan.host.displayName} / ${plan.profile.name}`);
  console.log(`Target root: ${plan.installRoot}`);
  for (const action of plan.actions) console.log(`${plan.options.dryRun ? '  would copy' : '  copy'} ${path.relative(ROOT, action.source)} -> ${path.relative(plan.installRoot, action.target)}`);
  for (const skipped of plan.skipped) console.log(`  skip ${skipped}`);
  if (!plan.options.dryRun) execute(plan);
  console.log(plan.options.dryRun ? 'No files changed.' : 'Installation complete.');
}

try {
  main();
} catch (error) {
  console.error(`Installation failed: ${error.message}`);
  process.exit(1);
}
