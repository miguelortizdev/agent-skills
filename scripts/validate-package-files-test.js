#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const packageManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const hosts = JSON.parse(fs.readFileSync(path.join(ROOT, 'registry', 'hosts.json'), 'utf8'));

function isPackaged(relativePath) {
  return packageManifest.files.some((entry) => {
    const normalized = entry.endsWith('/') ? entry.slice(0, -1) : entry;
    return relativePath === normalized || relativePath.startsWith(`${normalized}/`);
  });
}

test('npm package includes every configured host adapter', () => {
  for (const host of hosts.hosts) {
    const adapterPath = `${host.adapterPath}/adapter.json`;
    assert.equal(fs.existsSync(path.join(ROOT, adapterPath)), true, `${adapterPath} must exist`);
    assert.equal(isPackaged(adapterPath), true, `${adapterPath} must be included in package.json files`);
  }
});
