'use strict';

const fs = require('node:fs');
const path = require('node:path');

const EXCLUDED = new Set(['.git', 'node_modules', 'vendor', 'dist', 'build', 'target', 'coverage', '.next', '.cache', 'tmp']);
const MAX_DEPTH = 4;
const MAX_FILES = 300;
const MAX_READ_BYTES = 512 * 1024;

function relative(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function walk(root) {
  const files = [];
  function visit(directory, depth) {
    if (depth > MAX_DEPTH || files.length >= MAX_FILES) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isDirectory() && !EXCLUDED.has(entry.name)) visit(path.join(directory, entry.name), depth + 1);
      else if (entry.isFile()) files.push(path.join(directory, entry.name));
      if (files.length >= MAX_FILES) return;
    }
  }
  visit(root, 0);
  return files;
}

function readText(file) {
  const stat = fs.statSync(file);
  if (stat.size > MAX_READ_BYTES) return null;
  return fs.readFileSync(file, 'utf8');
}

function addSignal(context, signal) {
  context.signals.push(signal);
}

function addDependency(context, name, version, file) {
  if (!context.dependencies[name]) context.dependencies[name] = { version, file };
  addSignal(context, { type: 'dependency', name, version, file });
}

function inspectPackage(context, file, root) {
  let packageJson;
  try { packageJson = JSON.parse(readText(file)); } catch { return; }
  if (!packageJson || typeof packageJson !== 'object' || Array.isArray(packageJson)) return;
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [name, version] of Object.entries(packageJson[field] || {})) addDependency(context, name, version, relative(root, file));
  }
}

function inspectComposer(context, file, root) {
  let composer;
  try { composer = JSON.parse(readText(file)); } catch { return; }
  if (!composer || typeof composer !== 'object' || Array.isArray(composer)) return;
  for (const field of ['require', 'require-dev']) {
    for (const [name, version] of Object.entries(composer[field] || {})) addDependency(context, name, version, relative(root, file));
  }
}

function inspectText(context, file, root, patterns) {
  const content = readText(file);
  if (content === null) return;
  const filePath = relative(root, file);
  for (const pattern of patterns) {
    if (content.includes(pattern)) addSignal(context, { type: 'text', file: filePath, pattern });
  }
}

function detectProjectContext(projectRoot) {
  const root = path.resolve(projectRoot);
  const context = { root, files: [], dependencies: {}, frameworks: {}, platforms: {}, signals: [] };
  const files = walk(root);
  context.files = files.map((file) => relative(root, file));
  for (const file of files) {
    const filePath = relative(root, file);
    const basename = path.basename(file);
    if (basename === 'package.json') inspectPackage(context, file, root);
    if (basename === 'composer.json') inspectComposer(context, file, root);
    if (/^next\.config\.(js|mjs|cjs|ts)$/.test(basename)) addSignal(context, { type: 'file', path: filePath });
    if (basename === 'artisan') addSignal(context, { type: 'file', path: filePath });
    if (filePath.endsWith('bootstrap/app.php')) addSignal(context, { type: 'file', path: filePath });
    if (/^(pom\.xml|build\.gradle|build\.gradle\.kts)$/.test(basename)) inspectText(context, file, root, ['org.springframework.boot', 'spring-boot-starter']);
    if (/\.(ya?ml|json)$/.test(basename) || /(^|\/)(openshift|\.openshift)(\/|$)/.test(filePath)) {
      inspectText(context, file, root, ['route.openshift.io/', 'kind: DeploymentConfig', 'kind: BuildConfig', 'kind: ImageStream', 'openshift.io/']);
    }
  }
  const next = Object.entries(context.dependencies).find(([name]) => name === 'next');
  if (next) {
    context.frameworks.nextjs = { version: next[1].version, evidence: context.signals.filter((signal) => signal.type === 'dependency' && signal.name === 'next').map((signal) => `${signal.file} -> dependency "next"`) };
    for (const signal of context.signals.filter((entry) => entry.type === 'file' && /^next\.config\./.test(path.basename(entry.path)))) context.frameworks.nextjs.evidence.push(signal.path);
  }
  const laravel = Object.entries(context.dependencies).find(([name]) => name === 'laravel/framework');
  if (laravel) context.frameworks.laravel = { version: laravel[1].version, evidence: [`${laravel[1].file} -> dependency "laravel/framework"`] };
  const spring = context.signals.filter((signal) => signal.type === 'text' && ['org.springframework.boot', 'spring-boot-starter'].includes(signal.pattern));
  if (spring.length) context.frameworks.springBoot = { evidence: spring.map((signal) => `${signal.file} -> ${signal.pattern}`) };
  const openshift = context.signals.filter((signal) => signal.type === 'text' && signal.pattern.includes('openshift'));
  if (openshift.length) context.platforms.openshift = { evidence: openshift.map((signal) => `${signal.file} -> ${signal.pattern}`) };
  return context;
}

module.exports = { detectProjectContext };
