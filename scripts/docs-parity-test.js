#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const PRODUCT_DOCS = [
  'start-here.md',
  'installation.md',
  'daily-usage.md',
  'architecture.md',
  'skills.md',
  'context-aware-skills.md',
  'mcp.md',
  'hosts.md',
  'upstream-sync.md',
  'troubleshooting.md',
  'contributing.md',
];

function readLocale(locale, file) {
  const target = path.join(DOCS, locale, file);
  assert.equal(fs.existsSync(target), true, `missing ${locale}/${file}`);
  return fs.readFileSync(target, 'utf8');
}

function relativeLinks(file, content) {
  return [...content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
    .map((match) => match[1].split('#')[0])
    .filter((target) => target && !/^(?:[a-z]+:|#|\/)/i.test(target))
    .map((target) => path.resolve(path.dirname(file), target));
}

test('Spanish and English product documentation have matching documents and valid links', () => {
  for (const file of PRODUCT_DOCS) {
    const english = path.join(DOCS, 'en', file);
    const spanish = path.join(DOCS, 'es', file);
    const englishContent = readLocale('en', file);
    const spanishContent = readLocale('es', file);
    assert.match(englishContent, new RegExp(`\\.\\./es/${file.replace('.', '\\.')}`));
    assert.match(spanishContent, new RegExp(`\\.\\./en/${file.replace('.', '\\.')}`));
    for (const target of [...relativeLinks(english, englishContent), ...relativeLinks(spanish, spanishContent)]) {
      assert.equal(fs.existsSync(target), true, `broken documentation link: ${path.relative(ROOT, target)}`);
    }
  }
});

test('locale directories contain only paired product documents', () => {
  for (const locale of ['en', 'es']) {
    const files = fs.readdirSync(path.join(DOCS, locale)).filter((file) => file.endsWith('.md')).sort();
    assert.deepEqual(files, [...PRODUCT_DOCS].sort(), `${locale} product documentation set`);
  }
});
