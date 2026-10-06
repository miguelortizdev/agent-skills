#!/usr/bin/env node

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PROVENANCE_FILE = path.join(ROOT, 'upstream', 'agent-skills.json');
const REPOSITORY_FILE = path.join(ROOT, 'upstream', 'agent-skills.json');

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function parseArgs() {
  const args = process.argv.slice(2);
  const sourceIndex = args.indexOf('--source');
  return { source: sourceIndex >= 0 ? args[sourceIndex + 1] : null };
}

function trackedAt(cwd, revision) {
  return git(['ls-tree', '-r', '--name-only', revision], cwd).split('\n').filter(Boolean);
}

function trackedHead(cwd) {
  return git(['ls-files'], cwd).split('\n').filter(Boolean);
}

function blob(cwd, revision, file) {
  return git(['show', `${revision}:${file}`], cwd);
}

function categorize(file) {
  if (file.startsWith('skills/')) return 'skills';
  if (file.startsWith('commands/') || file.startsWith('.claude/commands/') || file.startsWith('.gemini/commands/')) return 'commands';
  if (file.startsWith('agents/')) return 'agents';
  if (file.startsWith('references/')) return 'references';
  if (file.startsWith('evals/')) return 'evals';
  return 'other';
}

function compare(source, baseline) {
  const latest = git(['rev-parse', 'HEAD'], source);
  const baselineFiles = new Set(trackedAt(ROOT, baseline));
  const latestFiles = new Set(trackedHead(source));
  const added = [...latestFiles].filter((file) => !baselineFiles.has(file)).sort();
  const removed = [...baselineFiles].filter((file) => !latestFiles.has(file)).sort();
  const changed = [];

  for (const file of [...baselineFiles].filter((entry) => latestFiles.has(entry))) {
    if (blob(ROOT, baseline, file) !== blob(source, 'HEAD', file)) changed.push(file);
  }

  const grouped = (files) => Object.fromEntries(
    ['skills', 'commands', 'agents', 'references', 'evals', 'other'].map((category) => [category, files.filter((file) => categorize(file) === category)]),
  );

  return { baseline, latest, equal: baseline === latest, added: grouped(added), removed: grouped(removed), changed: grouped(changed) };
}

function main() {
  const provenance = readJson(PROVENANCE_FILE);
  if (!/^https:\/\//.test(provenance.repository)) throw new Error('upstream repository must use HTTPS');
  const { source } = parseArgs();
  let temporary;
  let sourcePath = source;

  if (sourcePath) {
    sourcePath = path.resolve(sourcePath);
  } else {
    const latest = git(['ls-remote', provenance.repository, 'HEAD']).split(/\s+/)[0];
    if (latest === provenance.commit) {
      console.log(JSON.stringify({ baseline: provenance.commit, latest, equal: true, added: {}, removed: {}, changed: {} }, null, 2));
      return;
    }
    temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-skills-upstream-'));
    git(['clone', '--depth', '1', provenance.repository, temporary], ROOT);
    sourcePath = temporary;
  }

  const report = compare(sourcePath, provenance.commit);
  console.log(JSON.stringify(report, null, 2));
}

try {
  main();
} catch (error) {
  console.error(`Upstream comparison failed: ${error.message}`);
  process.exit(1);
}
