#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PROVENANCE_FILE = path.join(ROOT, 'upstream', 'agent-skills.json');

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function main() {
  const provenance = JSON.parse(fs.readFileSync(PROVENANCE_FILE, 'utf8'));
  const files = git(['ls-tree', '-r', '--name-only', provenance.commit]).split('\n').filter(Boolean);
  const missing = files.filter((file) => !fs.existsSync(path.join(ROOT, file)));
  if (missing.length) throw new Error(`missing upstream assets:\n${missing.join('\n')}`);
  console.log(`Upstream path parity valid: ${files.length} baseline paths are present`);
}

try {
  main();
} catch (error) {
  console.error(`Upstream parity validation failed: ${error.message}`);
  process.exit(1);
}
