'use strict';

const fs = require('node:fs');
const path = require('node:path');

const EXCLUDED = new Set(['.git', '.agent-standard', '.agents', '.claude', '.codex', '.cursor', '.gemini', '.opencode', 'node_modules', 'vendor', 'dist', 'build', 'target', 'coverage', '.next', '.cache', 'tmp']);
const SECRET_FILE = /^(?:\.env(?:\..*)?|.*\.(?:pem|key)|.*(?:credentials?|secrets?)(?:\.[^.]+)?)$/i;
const MAX_DEPTH = 4;
const MAX_FILES = 300;
const MAX_READ_BYTES = 512 * 1024;

function relative(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function isSecretFile(file) {
  return SECRET_FILE.test(path.basename(file));
}

function walk(root) {
  const files = [];
  const directories = [];
  function visit(directory, depth) {
    if (depth > MAX_DEPTH || files.length >= MAX_FILES) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory() && !EXCLUDED.has(entry.name)) {
        directories.push(target);
        visit(target, depth + 1);
      } else if (entry.isFile()) {
        files.push(target);
      }
      if (files.length >= MAX_FILES) return;
    }
  }
  visit(root, 0);
  return { files, directories };
}

function readText(file) {
  if (isSecretFile(file)) return null;
  const stat = fs.statSync(file);
  if (stat.size > MAX_READ_BYTES) return null;
  const content = fs.readFileSync(file, 'utf8');
  return content.includes('\u0000') ? null : content;
}

function inspectJson(context, file, root, content) {
  if (!file.endsWith('.json')) return;
  let document;
  try { document = JSON.parse(content); } catch { return; }
  if (!document || typeof document !== 'object' || Array.isArray(document)) return;
  const dependencyFields = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies', 'require', 'require-dev'];
  for (const field of dependencyFields) {
    const dependencies = document[field];
    if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)) continue;
    for (const [name, version] of Object.entries(dependencies)) {
      context.dependencies.push({ name, version, file: relative(root, file) });
    }
  }
}

function detectProjectContext(projectRoot) {
  const root = path.resolve(projectRoot);
  const walked = walk(root);
  const files = walked.files.map((file) => relative(root, file));
  const directories = walked.directories.map((directory) => relative(root, directory));
  const context = { root, files, directories, dependencies: [], texts: [] };

  for (const file of walked.files) {
    const content = readText(file);
    if (content === null) continue;
    const filePath = relative(root, file);
    context.texts.push({ file: filePath, content });
    inspectJson(context, file, root, content);
  }

  return context;
}

module.exports = { detectProjectContext };
