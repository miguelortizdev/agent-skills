#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { afterEach, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'install-agent-standard.js');
const sandboxes = [];

function makeSandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-skills-install-test-'));
  sandboxes.push(root);
  return root;
}

function run(root, ...args) {
  const env = args.at(-1) && args.at(-1).env;
  if (env) args.pop();
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: env ? { ...process.env, ...env } : process.env,
  });
}

function readInstalled(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

afterEach(() => {
  for (const root of sandboxes.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

test('dry-run reports actions without writing files', () => {
  const root = makeSandbox();
  const result = run(root, '--host', 'cursor', '--profile', 'decameron', '--project', '--dry-run');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /would copy/);
  assert.match(result.stdout, /No files changed/);
  assert.equal(fs.existsSync(path.join(root, '.cursor')), false);
});

test('installs commands using each host native representation', () => {
  const cases = [
    {
      host: 'claude',
      path: path.join('.claude', 'commands', 'plan.md'),
      extension: '.md',
      directory: path.join('.claude', 'commands'),
      filenames: ['spec.md', 'plan.md', 'build.md', 'test.md', 'review.md', 'ship.md'],
      includes: ['description:', 'Invoke the agent-skills:planning-and-task-breakdown skill.'],
    },
    {
      host: 'opencode',
      path: path.join('.opencode', 'commands', 'plan.md'),
      extension: '.md',
      directory: path.join('.opencode', 'commands'),
      filenames: ['spec.md', 'plan.md', 'build.md', 'test.md', 'review.md', 'ship.md'],
      includes: ['description:', 'Invoke the planning-and-task-breakdown skill.'],
    },
    {
      host: 'openchamber',
      path: path.join('.opencode', 'commands', 'plan.md'),
      extension: '.md',
      directory: path.join('.opencode', 'commands'),
      filenames: ['spec.md', 'plan.md', 'build.md', 'test.md', 'review.md', 'ship.md'],
      includes: ['description:', 'Invoke the planning-and-task-breakdown skill.'],
    },
    {
      host: 'gemini',
      path: path.join('.gemini', 'commands', 'planning.toml'),
      extension: '.toml',
      directory: path.join('.gemini', 'commands'),
      filenames: ['spec.toml', 'planning.toml', 'build.toml', 'test.toml', 'review.toml', 'ship.toml'],
      includes: ['description = "Break work into small verifiable tasks', 'prompt = """'],
    },
  ];

  for (const expected of cases) {
    const root = makeSandbox();
    const result = run(root, '--host', expected.host, '--profile', 'decameron', '--project');
    assert.equal(result.status, 0, `${expected.host}: ${result.stdout}${result.stderr}`);
    assert.equal(path.extname(expected.path), expected.extension);
    assert.deepEqual(fs.readdirSync(path.join(root, expected.directory)).sort(), expected.filenames.sort());
    assert.equal(fs.existsSync(path.join(root, expected.path)), true);
    const content = readInstalled(root, expected.path);
    for (const fragment of expected.includes) assert.match(content, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('preserves upstream Claude and Gemini command implementations', () => {
  const nativeCommands = [
    { host: 'claude', directory: '.claude/commands', extension: '.md', planName: 'plan' },
    { host: 'gemini', directory: '.gemini/commands', extension: '.toml', planName: 'planning' },
  ];
  const profile = JSON.parse(fs.readFileSync(path.join(ROOT, 'profiles', 'default.json'), 'utf8'));

  for (const expected of nativeCommands) {
    const root = makeSandbox();
    const result = run(root, '--host', expected.host, '--profile', 'default', '--project');
    assert.equal(result.status, 0, `${expected.host}: ${result.stdout}${result.stderr}`);
    for (const id of ['code-simplify', 'constraints', 'ship', 'webperf']) {
      const filename = `${id}${expected.extension}`;
      assert.equal(
        readInstalled(root, path.join(expected.directory, filename)),
        fs.readFileSync(path.join(ROOT, expected.directory, filename), 'utf8'),
      );
    }
    const installedPlan = readInstalled(root, path.join(expected.directory, `${expected.planName}${expected.extension}`));
    const sourcePlan = fs.readFileSync(path.join(ROOT, expected.directory, `${expected.planName}${expected.extension}`), 'utf8');
    assert.equal(installedPlan, sourcePlan);
    assert.equal(fs.readdirSync(path.join(root, expected.directory)).length, profile.commands.length);
  }
});

test('installs Gemini custom subagents with native frontmatter', () => {
  const root = makeSandbox();
  const result = run(root, '--host', 'gemini', '--profile', 'default', '--project');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const id of ['code-reviewer', 'security-auditor', 'test-engineer', 'web-performance-auditor']) {
    const content = readInstalled(root, path.join('.gemini', 'agents', `${id}.md`));
    assert.match(content, new RegExp(`^---\\nname: ${id}\\n`));
    assert.match(content, /^description: .+$/m);
  }
});

test('installs OpenCode and OpenChamber agents as V2 subagents', () => {
  for (const host of ['opencode', 'openchamber']) {
    const root = makeSandbox();
    const result = run(root, '--host', host, '--profile', 'default', '--project');
    assert.equal(result.status, 0, `${host}: ${result.stdout}${result.stderr}`);
    for (const id of ['code-reviewer', 'security-auditor', 'test-engineer', 'web-performance-auditor']) {
      const content = readInstalled(root, path.join('.opencode', 'agents', `${id}.md`));
      assert.match(content, /^mode: subagent$/m);
      assert.match(content, new RegExp(`^name: ${id}$`, 'm'));
    }
    assert.equal(fs.existsSync(path.join(root, '.opencode', 'agent')), false);
  }
});

test('does not install unsupported Codex agent files', () => {
  const root = makeSandbox();
  const result = run(root, '--host', 'codex', '--profile', 'default', '--project');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(fs.existsSync(path.join(root, '.agents', 'agents')), false);
});

test('uses isolated project and global destinations without touching the real home', () => {
  const cases = [
    ['opencode', '.opencode/agents/code-reviewer.md', '.config/opencode/agents/code-reviewer.md'],
    ['gemini', '.gemini/agents/code-reviewer.md', '.gemini/agents/code-reviewer.md'],
  ];
  for (const [host, projectPath, globalPath] of cases) {
    const projectRoot = makeSandbox();
    const project = run(projectRoot, '--host', host, '--profile', 'default', '--project');
    assert.equal(project.status, 0, `${host} project: ${project.stdout}${project.stderr}`);
    assert.equal(fs.existsSync(path.join(projectRoot, projectPath)), true);

    const globalRoot = makeSandbox();
    const home = makeSandbox();
    const global = run(globalRoot, '--host', host, '--profile', 'default', '--global', { env: { HOME: home } });
    assert.equal(global.status, 0, `${host} global: ${global.stdout}${global.stderr}`);
    assert.equal(fs.existsSync(path.join(home, globalPath)), true);
    assert.equal(fs.existsSync(path.join(globalRoot, projectPath)), false);
  }
});

test('default profile installs all selected assets or documented fallbacks per host', () => {
  const profile = JSON.parse(fs.readFileSync(path.join(ROOT, 'profiles', 'default.json'), 'utf8'));
  assert.equal(profile.skills.length, 25);
  assert.equal(profile.commands.length, 9);
  assert.equal(profile.agents.length, 4);
  assert.equal(profile.references.length, 7);
  for (const host of ['claude', 'codex', 'cursor', 'opencode', 'gemini', 'openchamber']) {
    const root = makeSandbox();
    const result = run(root, '--host', host, '--profile', 'default', '--project');
    assert.equal(result.status, 0, `${host}: ${result.stdout}${result.stderr}`);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, '.agent-standard', 'installation.json'), 'utf8'));
    assert.ok(manifest.files.length >= profile.skills.length);
  }
});

test('does not invent command files for hosts without native command support', () => {
  for (const host of ['codex', 'cursor']) {
    const root = makeSandbox();
    const result = run(root, '--host', host, '--profile', 'decameron', '--project');
    assert.equal(result.status, 0, `${host}: ${result.stdout}${result.stderr}`);
    assert.equal(fs.existsSync(path.join(root, host === 'codex' ? '.agents' : '.cursor', 'commands')), false);
    assert.match(result.stdout, /host has no native destination/);
  }
});

test('keeps generated commands idempotent and refuses modified commands', () => {
  const root = makeSandbox();
  const first = run(root, '--host', 'claude', '--profile', 'decameron', '--project');
  assert.equal(first.status, 0, first.stdout + first.stderr);
  const second = run(root, '--host', 'claude', '--profile', 'decameron', '--project');
  assert.equal(second.status, 0, second.stdout + second.stderr);

  const target = path.join(root, '.claude', 'commands', 'plan.md');
  fs.appendFileSync(target, '\nlocal modification\n');
  const conflict = run(root, '--host', 'claude', '--profile', 'decameron', '--project');
  assert.equal(conflict.status, 1);
  assert.match(conflict.stderr, /refusing to overwrite existing files/);
});

test('uninstalls generated native command files', () => {
  const root = makeSandbox();
  const install = run(root, '--host', 'opencode', '--profile', 'decameron', '--project');
  assert.equal(install.status, 0, install.stdout + install.stderr);
  assert.equal(fs.existsSync(path.join(root, '.opencode', 'commands', 'plan.md')), true);

  const uninstall = run(root, '--host', 'opencode', '--profile', 'decameron', '--project', '--uninstall');
  assert.equal(uninstall.status, 0, uninstall.stdout + uninstall.stderr);
  assert.equal(fs.existsSync(path.join(root, '.opencode')), false);
});

test('safe install is idempotent for identical files', () => {
  const root = makeSandbox();
  const first = run(root, '--host', 'cursor', '--profile', 'decameron', '--project');
  assert.equal(first.status, 0, first.stdout + first.stderr);
  assert.equal(fs.existsSync(path.join(root, '.cursor', 'skills', 'api-and-interface-design', 'SKILL.md')), true);
  const second = run(root, '--host', 'cursor', '--profile', 'decameron', '--project');
  assert.equal(second.status, 0, second.stdout + second.stderr);
});

test('safe install refuses conflicting files', () => {
  const root = makeSandbox();
  const first = run(root, '--host', 'cursor', '--profile', 'decameron', '--project');
  assert.equal(first.status, 0, first.stdout + first.stderr);
  const target = path.join(root, '.cursor', 'skills', 'api-and-interface-design', 'SKILL.md');
  fs.appendFileSync(target, '\nlocal modification\n');
  const conflict = run(root, '--host', 'cursor', '--profile', 'decameron', '--project');
  assert.equal(conflict.status, 1);
  assert.match(conflict.stderr, /refusing to overwrite existing files/);
});

test('safe install refuses symlinked destination directories', () => {
  const root = makeSandbox();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-skills-install-outside-'));
  try {
    fs.mkdirSync(path.join(root, '.cursor'), { recursive: true });
    fs.symlinkSync(outside, path.join(root, '.cursor', 'skills'), 'dir');
    const result = run(root, '--host', 'cursor', '--profile', 'decameron', '--project');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /refusing to write through symlink/);
  } finally {
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test('records ownership and uninstalls only the selected profile', () => {
  const root = makeSandbox();
  const install = run(root, '--host', 'cursor', '--profile', 'decameron', '--project');
  assert.equal(install.status, 0, install.stdout + install.stderr);
  const manifestPath = path.join(root, '.agent-standard', 'installation.json');
  assert.equal(fs.existsSync(manifestPath), true);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.profile, 'decameron');
  assert.ok(manifest.files.length > 0);

  const uninstall = run(root, '--host', 'cursor', '--profile', 'decameron', '--project', '--uninstall');
  assert.equal(uninstall.status, 0, uninstall.stdout + uninstall.stderr);
  assert.equal(fs.existsSync(path.join(root, '.cursor')), false);
  assert.equal(fs.existsSync(manifestPath), false);
});

test('refuses to mix profiles until the installed profile is removed', () => {
  const root = makeSandbox();
  const install = run(root, '--host', 'cursor', '--profile', 'decameron', '--project');
  assert.equal(install.status, 0, install.stdout + install.stderr);
  const second = run(root, '--host', 'cursor', '--profile', 'default', '--project');
  assert.equal(second.status, 1);
  assert.match(second.stderr, /already installed/);
});

test('does not uninstall a file modified after installation', () => {
  const root = makeSandbox();
  const install = run(root, '--host', 'cursor', '--profile', 'decameron', '--project');
  assert.equal(install.status, 0, install.stdout + install.stderr);
  const target = path.join(root, '.cursor', 'skills', 'api-and-interface-design', 'SKILL.md');
  fs.appendFileSync(target, '\nlocal modification\n');
  const uninstall = run(root, '--host', 'cursor', '--profile', 'decameron', '--project', '--uninstall');
  assert.equal(uninstall.status, 1);
  assert.match(uninstall.stderr, /modified files/);
  assert.equal(fs.existsSync(target), true);
});
