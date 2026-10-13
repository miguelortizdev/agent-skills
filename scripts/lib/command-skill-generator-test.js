'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '../..');
const { generateCommandSkill, parseCanonicalCommand, resolveCommandDependencies } = require('./command-skill-generator');
const { lintSkill } = require('./skill-lint');

test('parses a canonical command without losing its prompt', () => {
  const source = path.join(ROOT, 'commands', 'build.toml');
  const command = parseCanonicalCommand(source);
  assert.equal(command.id, 'build');
  assert.match(command.description, /Implement tasks incrementally/);
  assert.match(command.prompt, /\/build auto/);
  assert.match(command.prompt, /Every task still earns a passing test/);
});

test('generates a valid Codex Skill adapter with the complete canonical prompt', () => {
  const source = path.join(ROOT, 'commands', 'build.toml');
  const command = parseCanonicalCommand(source);
  const content = generateCommandSkill({
    command,
    dependencies: [
      { id: 'incremental-implementation', type: 'skill' },
      { id: 'test-driven-development', type: 'skill' },
    ],
    syntax: '$build',
  });
  assert.match(content, /^---\nname: build\n/);
  assert.match(content, /description: ".*Use when invoking \$build/);
  assert.match(content, /## Canonical Command Instructions/);
  assert.match(content, /\/build auto/);
  assert.match(content, /Every task still earns a passing test/);
  assert.match(content, /`incremental-implementation` \(skill\)/);
  assert.match(content, /## Verification/);
});

test('resolves transitive command dependencies by asset type', () => {
  const assets = new Map([
    ['ship', { id: 'ship', type: 'command', enabled: true, requires: ['shipping', 'reviewer'] }],
    ['shipping', { id: 'shipping', type: 'skill', enabled: true, requires: ['checklist'] }],
    ['reviewer', { id: 'reviewer', type: 'agent', enabled: true }],
    ['checklist', { id: 'checklist', type: 'reference', enabled: true }],
  ]);
  assert.deepEqual(resolveCommandDependencies('ship', assets).map((asset) => `${asset.type}:${asset.id}`), [
    'reference:checklist',
    'skill:shipping',
    'agent:reviewer',
  ]);
});

test('rejects missing, disabled, and cyclic dependencies', () => {
  assert.throws(() => resolveCommandDependencies('missing', new Map()), /missing asset/);
  assert.throws(() => resolveCommandDependencies('command', new Map([
    ['command', { id: 'command', type: 'command', enabled: true, requires: ['disabled'] }],
    ['disabled', { id: 'disabled', type: 'skill', enabled: false }],
  ])), /disabled asset/);
  assert.throws(() => resolveCommandDependencies('a', new Map([
    ['a', { id: 'a', type: 'command', enabled: true, requires: ['b'] }],
    ['b', { id: 'b', type: 'skill', enabled: true, requires: ['a'] }],
  ])), /dependency cycle/);
});

test('generates a newly registered Command without command-specific generator logic', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'command-skill-generator-'));
  try {
    const source = path.join(root, 'later.toml');
    fs.writeFileSync(source, 'description = "Run a later workflow"\nprompt = """\nUse the later workflow exactly.\n"""\n');
    const command = parseCanonicalCommand(source, 'later', 'commands/later.toml');
    const content = generateCommandSkill({ command, syntax: '$later' });
    assert.match(content, /name: later/);
    assert.match(content, /Use the later workflow exactly/);
    fs.mkdirSync(path.join(root, 'later'));
    fs.writeFileSync(path.join(root, 'later', 'SKILL.md'), content);
    const result = lintSkill('later', root, new Set(['later']));
    assert.deepEqual(result.errors, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
