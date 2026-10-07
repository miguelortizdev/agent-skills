#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { afterEach, test } = require('node:test');
const { detectProjectContext } = require('./context-detector');
const { resolveContextualSkills } = require('./context-resolver');

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

function registry() {
  return { assets: [
    { id: 'nextjs-vercel-engineering', type: 'skill', contextual: true, appliesWhen: { any: [{ type: 'dependency', file: 'package.json', names: ['next'] }, { type: 'file', paths: ['next.config.ts'] }] } },
    { id: 'spring-boot-engineering', type: 'skill', contextual: true, appliesWhen: { any: [{ type: 'text', files: ['pom.xml'], patterns: ['org.springframework.boot'] }] } },
  ] };
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

test('detects Next.js from package metadata and config evidence', () => {
  const root = project({
    'package.json': JSON.stringify({ dependencies: { next: '^15.0.0', react: '^19.0.0' } }),
    'next.config.ts': 'export default {}',
  });
  const context = detectProjectContext(root);
  assert.equal(context.frameworks.nextjs.version, '^15.0.0');
  assert.deepEqual(context.frameworks.nextjs.evidence, ['package.json -> dependency "next"', 'next.config.ts']);
});

test('does not detect Next.js for a plain React project', () => {
  const root = project({ 'package.json': JSON.stringify({ dependencies: { react: '^19.0.0' } }) });
  assert.equal(detectProjectContext(root).frameworks.nextjs, undefined);
});

test('detects Laravel but not Symfony', () => {
  const root = project({
    'composer.json': JSON.stringify({ require: { 'laravel/framework': '^10.0' } }),
    artisan: '#!/usr/bin/env php',
  });
  assert.equal(detectProjectContext(root).frameworks.laravel.version, '^10.0');

  const symfony = project({ 'composer.json': JSON.stringify({ require: { 'symfony/framework-bundle': '^7.0' } }) });
  assert.equal(detectProjectContext(symfony).frameworks.laravel, undefined);
});

test('detects Spring Boot but not plain Maven', () => {
  const root = project({ 'pom.xml': '<dependency>org.springframework.boot</dependency>' });
  assert.ok(detectProjectContext(root).frameworks.springBoot);
  const plain = project({ 'pom.xml': '<artifactId>commons-lang</artifactId>' });
  assert.equal(detectProjectContext(plain).frameworks.springBoot, undefined);
});

test('detects OpenShift markers but not generic Kubernetes', () => {
  const openshift = project({ 'openshift/route.yaml': 'apiVersion: route.openshift.io/v1\nkind: Route\n' });
  assert.ok(detectProjectContext(openshift).platforms.openshift);
  const kubernetes = project({ 'deployment.yaml': 'apiVersion: apps/v1\nkind: Deployment\n', 'service.yaml': 'kind: Service\n' });
  assert.equal(detectProjectContext(kubernetes).platforms.openshift, undefined);
});

test('resolves multiple contextual Skills with deterministic evidence', () => {
  const root = project({
    'package.json': JSON.stringify({ dependencies: { next: '^15.0.0' } }),
    'pom.xml': '<dependency>org.springframework.boot</dependency>',
  });
  const context = detectProjectContext(root);
  const resolved = resolveContextualSkills(context, registry());
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
  context.signals.push({ type: 'text', file: 'openshift/route.yaml', pattern: 'route.openshift.io/' });
  const resolved = resolveContextualSkills(context, { assets: [
    ...registry().assets,
    { id: 'openshift-engineering', type: 'skill', contextual: true, appliesWhen: { any: [{ type: 'text', files: ['openshift/route.yaml'], patterns: ['route.openshift.io/'] }] } },
  ] });
  assert.deepEqual([...new Set(resolved.map((entry) => entry.id))].sort(), ['nextjs-vercel-engineering', 'openshift-engineering', 'spring-boot-engineering']);
});

test('detects bounded workspace manifests without traversing excluded directories', () => {
  const root = project({
    'packages/web/package.json': JSON.stringify({ dependencies: { next: '^15.0.0' } }),
    'node_modules/ignored/package.json': JSON.stringify({ dependencies: { next: '^15.0.0' } }),
  });
  assert.equal(detectProjectContext(root).frameworks.nextjs.version, '^15.0.0');
});
