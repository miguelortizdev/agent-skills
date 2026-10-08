#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { afterEach, test } = require('node:test');
const { detectProjectContext } = require('./context-detector');
const { resolveContextualSkills } = require('./context-resolver');
const canonicalCatalog = require('../../registry/catalog.json');

const roots = [];

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-context-test-'));
  roots.push(root);
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}

function technologyFixtureRegistry() {
  return { assets: [
    { id: 'nextjs-vercel-engineering', type: 'skill', contextual: true, appliesWhen: { anyOf: [{ type: 'dependency', file: 'package.json', match: 'basename', names: ['next'] }, { type: 'file', paths: ['next.config.ts'] }] } },
    { id: 'spring-boot-engineering', type: 'skill', contextual: true, appliesWhen: { anyOf: [{ type: 'text', match: 'basename', files: ['pom.xml'], patterns: ['org.springframework.boot'] }] } },
  ] };
}

function genericRegistry() {
  return { assets: [
    { id: 'docker-fixture', type: 'skill', contextual: true, appliesWhen: { anyOf: [{ type: 'file', match: 'basename', paths: ['Dockerfile'] }] } },
    { id: 'redis-fixture', type: 'skill', contextual: true, appliesWhen: { anyOf: [{ type: 'text', match: 'basename', files: ['docker-compose.yml'], patterns: ['redis:'] }] } },
    { id: 'future-framework-engineering', type: 'skill', contextual: true, appliesWhen: { anyOf: [{ type: 'dependency', file: 'package.json', names: ['future-framework'] }, { type: 'file', match: 'basename', paths: ['future.config.js'] }] } },
    { id: 'future-platform-engineering', type: 'skill', contextual: true, appliesWhen: { allOf: [{ type: 'file', paths: ['platform.yaml'] }, { type: 'text', files: ['platform.yaml'], patterns: ['kind: FuturePlatform'] }], noneOf: [{ type: 'text', files: ['platform.yaml'], patterns: ['legacy: true'] }] } },
    { id: 'future-composed-engineering', type: 'skill', contextual: true, appliesWhen: { allOf: [{ type: 'file', paths: ['special.config'] }, { type: 'dependency', file: 'package.json', names: ['future-lib'] }] } },
    { id: 'standalone-react-fixture', type: 'skill', contextual: true, appliesWhen: { allOf: [{ type: 'dependency', file: 'package.json', names: ['react'] }], noneOf: [{ type: 'dependency', file: 'package.json', names: ['next'] }] } },
  ] };
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

test('canonical production registry has no contextual Skills', () => {
  const skills = canonicalCatalog.assets.filter((asset) => asset.type === 'skill');
  assert.equal(skills.length, 25);
  assert.equal(skills.filter((asset) => asset.contextual === true).length, 0);
  assert.deepEqual(skills.filter((asset) => asset.source !== 'upstream').map((asset) => asset.id), []);
  for (const id of ['nextjs-vercel-engineering', 'laravel-engineering', 'spring-boot-engineering', 'openshift-engineering']) {
    assert.equal(skills.some((asset) => asset.id === id), false, id);
  }
});

test('resolves Next.js from package metadata and config evidence', () => {
  const root = project({
    'package.json': JSON.stringify({ dependencies: { next: '^15.0.0', react: '^19.0.0' } }),
    'next.config.ts': 'export default {}',
  });
  const context = detectProjectContext(root);
  const resolved = resolveContextualSkills(context, technologyFixtureRegistry());
  assert.deepEqual(resolved.map((entry) => entry.id), ['nextjs-vercel-engineering']);
  assert.deepEqual(resolved[0].evidence, ['package.json -> dependency "next"', 'next.config.ts']);
});

test('does not resolve Next.js for a plain React project', () => {
  const root = project({ 'package.json': JSON.stringify({ dependencies: { react: '^19.0.0' } }) });
  assert.equal(resolveContextualSkills(detectProjectContext(root), technologyFixtureRegistry()).some((entry) => entry.id === 'nextjs-vercel-engineering'), false);
});

test('resolves Laravel but not Symfony', () => {
  const root = project({
    'composer.json': JSON.stringify({ require: { 'laravel/framework': '^10.0' } }),
    artisan: '#!/usr/bin/env php',
  });
  const fixture = {
    assets: [
      { id: 'laravel-engineering', type: 'skill', contextual: true, appliesWhen: { anyOf: [{ type: 'dependency', file: 'composer.json', match: 'basename', names: ['laravel/framework'] }, { type: 'file', match: 'basename', paths: ['artisan'] }] } },
    ],
  };
  assert.deepEqual(resolveContextualSkills(detectProjectContext(root), fixture).map((entry) => entry.id), ['laravel-engineering']);

  const symfony = project({ 'composer.json': JSON.stringify({ require: { 'symfony/framework-bundle': '^7.0' } }) });
  assert.equal(resolveContextualSkills(detectProjectContext(symfony), fixture).some((entry) => entry.id === 'laravel-engineering'), false);
});

test('resolves Spring Boot but not plain Maven', () => {
  const root = project({ 'pom.xml': '<dependency>org.springframework.boot</dependency>' });
  const fixture = { assets: [{ id: 'spring-boot-engineering', type: 'skill', contextual: true, appliesWhen: { anyOf: [{ type: 'text', match: 'basename', files: ['pom.xml'], patterns: ['org.springframework.boot'] }] } }] };
  assert.equal(resolveContextualSkills(detectProjectContext(root), fixture).some((entry) => entry.id === 'spring-boot-engineering'), true);
  const plain = project({ 'pom.xml': '<artifactId>commons-lang</artifactId>' });
  assert.equal(resolveContextualSkills(detectProjectContext(plain), fixture).some((entry) => entry.id === 'spring-boot-engineering'), false);
});

test('resolves OpenShift markers but not generic Kubernetes', () => {
  const openshift = project({ 'openshift/route.yaml': 'apiVersion: route.openshift.io/v1\nkind: Route\n' });
  const fixture = { assets: [{ id: 'openshift-engineering', type: 'skill', contextual: true, appliesWhen: { anyOf: [{ type: 'text', files: ['openshift/route.yaml'], patterns: ['route.openshift.io/'] }] } }] };
  assert.equal(resolveContextualSkills(detectProjectContext(openshift), fixture).some((entry) => entry.id === 'openshift-engineering'), true);
  const kubernetes = project({ 'deployment.yaml': 'apiVersion: apps/v1\nkind: Deployment\n', 'service.yaml': 'kind: Service\n' });
  assert.equal(resolveContextualSkills(detectProjectContext(kubernetes), fixture).some((entry) => entry.id === 'openshift-engineering'), false);
});

test('resolves multiple contextual Skills with deterministic evidence', () => {
  const root = project({
    'package.json': JSON.stringify({ dependencies: { next: '^15.0.0' } }),
    'pom.xml': '<dependency>org.springframework.boot</dependency>',
  });
  const context = detectProjectContext(root);
  const resolved = resolveContextualSkills(context, technologyFixtureRegistry());
  assert.deepEqual(resolved.map((entry) => entry.id), ['nextjs-vercel-engineering', 'spring-boot-engineering']);
  assert.ok(resolved.every((entry) => entry.evidence.length > 0));
});

test('resolves a multi-stack project without duplicate contextual Skills', () => {
  const root = project({
    'package.json': JSON.stringify({ dependencies: { next: '^15.0.0' } }),
    'pom.xml': '<dependency>org.springframework.boot</dependency>',
    'openshift/route.yaml': 'apiVersion: route.openshift.io/v1\nkind: Route\n',
  });
  const context = detectProjectContext(root);
  const resolved = resolveContextualSkills(context, { assets: [
    ...technologyFixtureRegistry().assets,
    { id: 'openshift-engineering', type: 'skill', contextual: true, appliesWhen: { anyOf: [{ type: 'text', files: ['openshift/route.yaml'], patterns: ['route.openshift.io/'] }] } },
  ] });
  assert.deepEqual([...new Set(resolved.map((entry) => entry.id))].sort(), ['nextjs-vercel-engineering', 'openshift-engineering', 'spring-boot-engineering']);
});

test('detects bounded workspace manifests without traversing excluded directories', () => {
  const root = project({
    'packages/web/package.json': JSON.stringify({ dependencies: { next: '^15.0.0' } }),
    'node_modules/ignored/package.json': JSON.stringify({ dependencies: { next: '^15.0.0' } }),
  });
  assert.equal(resolveContextualSkills(detectProjectContext(root), technologyFixtureRegistry()).some((entry) => entry.id === 'nextjs-vercel-engineering'), true);
});

test('resolves nested monorepo signals through the canonical catalog', () => {
  const root = project({
    'frontend/package.json': JSON.stringify({ dependencies: { next: '^15.0.0' } }),
    'frontend/next.config.ts': 'export default {}',
    'backend/pom.xml': '<dependency>org.springframework.boot</dependency>',
    'deploy/openshift/route.yaml': 'apiVersion: route.openshift.io/v1\nkind: Route\n',
  });
  const resolved = resolveContextualSkills(detectProjectContext(root), {
    assets: [
      ...technologyFixtureRegistry().assets,
      { id: 'openshift-engineering', type: 'skill', contextual: true, appliesWhen: { anyOf: [{ type: 'text', files: ['deploy/openshift/route.yaml'], patterns: ['route.openshift.io/'] }] } },
    ],
  });
  assert.deepEqual(resolved.map((entry) => entry.id).sort(), [
    'nextjs-vercel-engineering',
    'openshift-engineering',
    'spring-boot-engineering',
  ]);
});

test('resolves nested Laravel manifests and keeps generic Kubernetes out', () => {
  const laravel = project({
    'services/api/composer.json': JSON.stringify({ require: { 'laravel/framework': '^10.0' } }),
    'services/api/artisan': '#!/usr/bin/env php',
  });
  assert.deepEqual(resolveContextualSkills(detectProjectContext(laravel), {
    assets: [{ id: 'laravel-engineering', type: 'skill', contextual: true, appliesWhen: { anyOf: [{ type: 'dependency', file: 'composer.json', match: 'basename', names: ['laravel/framework'] }, { type: 'file', match: 'basename', paths: ['artisan'] }] } }],
  }).map((entry) => entry.id), ['laravel-engineering']);
  const kubernetes = project({
    'deploy/k8s/deployment.yaml': 'apiVersion: apps/v1\nkind: Deployment\n',
    'deploy/k8s/service.yaml': 'kind: Service\n',
  });
  assert.deepEqual(resolveContextualSkills(detectProjectContext(kubernetes), technologyFixtureRegistry()), []);
});

test('scans generic filesystem facts without technology-specific context fields', () => {
  const root = project({
    'infra/Dockerfile': 'FROM node:22\n',
    'docker-compose.yml': 'services:\n  cache:\n    image: redis:7\n',
    'package.json': JSON.stringify({ dependencies: { 'future-framework': '^1.0.0' } }),
    'infrastructure/special-platform/.keep': '',
  });
  const context = detectProjectContext(root);
  assert.equal('frameworks' in context, false);
  assert.equal('platforms' in context, false);
  assert.ok(context.files.includes('infra/Dockerfile'));
  assert.ok(context.directories.includes('infrastructure/special-platform'));
  assert.ok(context.dependencies.some((dependency) => dependency.name === 'future-framework'));
  assert.ok(context.texts.some((text) => text.file === 'docker-compose.yml'));
  assert.deepEqual(resolveContextualSkills(context, genericRegistry()).map((entry) => entry.id), [
    'docker-fixture',
    'redis-fixture',
    'future-framework-engineering',
  ]);
});

test('does not read secret files or oversized files', () => {
  const root = project({
    '.env': 'FUTURE_SECRET_MARKER=true\n',
    'credentials.json': '{"token":"secret"}\n',
    'large.txt': 'x'.repeat(512 * 1024 + 1),
    'visible.txt': 'safe\n',
  });
  const context = detectProjectContext(root);
  assert.ok(context.files.includes('.env'));
  assert.ok(context.files.includes('credentials.json'));
  assert.ok(context.files.includes('large.txt'));
  assert.ok(context.texts.some((text) => text.file === 'visible.txt'));
  assert.equal(context.texts.some((text) => text.file === '.env'), false);
  assert.equal(context.texts.some((text) => text.file === 'credentials.json'), false);
  assert.equal(context.texts.some((text) => text.file === 'large.txt'), false);
});

test('resolves a Registry path rule and rejects an absent path', () => {
  const present = project({ 'infrastructure/special-platform/.keep': '' });
  const absent = project({ 'infrastructure/other-platform/.keep': '' });
  const pathRegistry = { assets: [
    { id: 'special-platform-path-fixture', type: 'skill', contextual: true, appliesWhen: { type: 'path', match: 'suffix', paths: ['infrastructure/special-platform'] } },
  ] };
  const ids = (root) => resolveContextualSkills(detectProjectContext(root), pathRegistry).map((entry) => entry.id);

  assert.deepEqual(ids(present), ['special-platform-path-fixture']);
  assert.deepEqual(ids(absent), []);
});

test('evaluates generic path and logical composition rules', () => {
  const root = project({
    'platform.yaml': 'kind: FuturePlatform\n',
    'special.config': '',
    'package.json': JSON.stringify({ dependencies: { 'future-lib': '1.0.0', react: '^19.0.0' } }),
  });
  const resolved = resolveContextualSkills(detectProjectContext(root), genericRegistry());
  assert.deepEqual(resolved.map((entry) => entry.id), [
    'future-platform-engineering',
    'future-composed-engineering',
    'standalone-react-fixture',
  ]);

  fs.writeFileSync(path.join(root, 'platform.yaml'), 'kind: FuturePlatform\nlegacy: true\n');
  fs.rmSync(path.join(root, 'special.config'));
  const changed = resolveContextualSkills(detectProjectContext(root), genericRegistry());
  assert.deepEqual(changed.map((entry) => entry.id), ['standalone-react-fixture']);
});

test('activates future rules from dependency or file evidence without core changes', () => {
  const dependency = project({ 'package.json': JSON.stringify({ dependencies: { 'future-framework': '1.0.0' } }) });
  const file = project({ 'future.config.js': 'module.exports = {}\n' });
  const empty = project({ 'package.json': JSON.stringify({ dependencies: { react: '^19.0.0' } }) });
  const ids = (root) => resolveContextualSkills(detectProjectContext(root), genericRegistry()).map((entry) => entry.id);
  assert.deepEqual(ids(dependency), ['future-framework-engineering']);
  assert.deepEqual(ids(file), ['future-framework-engineering']);
  assert.deepEqual(ids(empty), ['standalone-react-fixture']);
});
