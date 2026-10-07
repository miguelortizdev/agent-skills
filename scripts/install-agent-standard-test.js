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
const INTEGRITY_SCRIPT = path.join(ROOT, 'scripts', 'validate-installation-integrity.js');
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

function relativeFiles(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root).flatMap((entry) => {
    const absolute = path.join(root, entry);
    return fs.lstatSync(absolute).isDirectory()
      ? relativeFiles(absolute).map((child) => path.join(entry, child))
      : [entry];
  });
}

function assertBundleParity(sourceRoot, installedRoot) {
  assert.deepEqual(relativeFiles(installedRoot).sort(), relativeFiles(sourceRoot).sort());
  for (const relative of relativeFiles(sourceRoot)) {
    assert.deepEqual(
      fs.readFileSync(path.join(installedRoot, relative)),
      fs.readFileSync(path.join(sourceRoot, relative)),
      `${installedRoot}/${relative}`,
    );
  }
}

afterEach(() => {
  for (const root of sandboxes.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

test('dry-run reports actions without writing files', () => {
  const root = makeSandbox();
  const result = run(root, '--host', 'cursor', '--profile', 'decameron', '--project', '--dry-run');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /would copy/);
  assert.match(result.stdout, /would merge MCP/);
  assert.match(result.stdout, /context7/);
  assert.doesNotMatch(result.stdout, /secret|token-value|abc123/i);
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

test('installs Cursor native commands with the canonical plan alias', () => {
  const root = makeSandbox();
  const result = run(root, '--host', 'cursor', '--profile', 'default', '--project');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const filenames = ['spec.md', 'plan.md', 'build.md', 'test.md', 'constraints.md', 'review.md', 'webperf.md', 'code-simplify.md', 'ship.md'];
  assert.deepEqual(fs.readdirSync(path.join(root, '.cursor', 'commands')).sort(), filenames.sort());
  assert.match(readInstalled(root, path.join('.cursor', 'commands', 'plan.md')), /description:/);
  assert.match(readInstalled(root, path.join('.cursor', 'commands', 'plan.md')), /Invoke the planning-and-task-breakdown skill/);
  assert.equal(fs.existsSync(path.join(root, '.cursor', 'commands', 'planning.md')), false);
});

test('installs Cursor native subagents without OpenCode metadata', () => {
  const root = makeSandbox();
  const result = run(root, '--host', 'cursor', '--profile', 'default', '--project');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const id of ['code-reviewer', 'security-auditor', 'test-engineer', 'web-performance-auditor']) {
    const installed = readInstalled(root, path.join('.cursor', 'agents', `${id}.md`));
    const canonical = fs.readFileSync(path.join(ROOT, 'agents', `${id}.md`), 'utf8');
    assert.equal(installed, canonical);
    assert.doesNotMatch(installed, /^mode: subagent$/m);
  }
  assert.equal(fs.existsSync(path.join(root, '.cursor', 'docs', 'agents.md')), true);
});

test('allows concurrent project installations for every independent host', () => {
  const root = makeSandbox();
  for (const host of ['cursor', 'codex', 'claude', 'gemini']) {
    const result = run(root, '--host', host, '--profile', 'default', '--project');
    assert.equal(result.status, 0, `${host}: ${result.stdout}${result.stderr}`);
  }
  for (const host of ['cursor', 'codex', 'claude', 'gemini']) {
    assert.equal(fs.existsSync(path.join(root, '.agent-standard', 'installations', `${host}.json`)), true);
  }

  const uninstall = run(root, '--host', 'codex', '--profile', 'default', '--project', '--uninstall');
  assert.equal(uninstall.status, 0, uninstall.stdout + uninstall.stderr);
  assert.equal(fs.existsSync(path.join(root, '.cursor', 'skills', 'idea-refine', 'examples.md')), true);
  assert.equal(fs.existsSync(path.join(root, '.claude', 'skills', 'idea-refine', 'examples.md')), true);
  assert.equal(fs.existsSync(path.join(root, '.gemini', 'skills', 'idea-refine', 'examples.md')), true);
  assert.equal(fs.existsSync(path.join(root, '.codex', 'agents')), false);
});

test('allows concurrent global installations with an isolated HOME', () => {
  const root = makeSandbox();
  const home = makeSandbox();
  for (const host of ['cursor', 'codex', 'claude', 'gemini']) {
    const result = run(root, '--host', host, '--profile', 'default', '--global', { env: { HOME: home } });
    assert.equal(result.status, 0, `${host}: ${result.stdout}${result.stderr}`);
  }
  const uninstall = run(root, '--host', 'codex', '--profile', 'default', '--global', '--uninstall', { env: { HOME: home } });
  assert.equal(uninstall.status, 0, uninstall.stdout + uninstall.stderr);
  assert.equal(fs.existsSync(path.join(home, '.cursor', 'skills', 'idea-refine', 'examples.md')), true);
  assert.equal(fs.existsSync(path.join(home, '.claude', 'skills', 'idea-refine', 'examples.md')), true);
  assert.equal(fs.existsSync(path.join(home, '.gemini', 'skills', 'idea-refine', 'examples.md')), true);
  assert.equal(fs.existsSync(path.join(home, '.codex', 'agents')), false);
});

test('installs complete Skill bundles for every host', () => {
  const sourceRoot = path.join(ROOT, 'skills', 'idea-refine');
  const destinations = {
    claude: '.claude/skills', codex: '.agents/skills', cursor: '.cursor/skills',
    gemini: '.gemini/skills', opencode: '.opencode/skills', openchamber: '.opencode/skills',
  };
  for (const host of Object.keys(destinations)) {
    const root = makeSandbox();
    const result = run(root, '--host', host, '--profile', 'default', '--project');
    assert.equal(result.status, 0, `${host}: ${result.stdout}${result.stderr}`);
    assertBundleParity(sourceRoot, path.join(root, destinations[host], 'idea-refine'));
  }
});

test('protects and uninstalls Cursor native commands across lifecycle', () => {
  const root = makeSandbox();
  const first = run(root, '--host', 'cursor', '--profile', 'decameron', '--project');
  assert.equal(first.status, 0, first.stdout + first.stderr);
  const second = run(root, '--host', 'cursor', '--profile', 'decameron', '--project');
  assert.equal(second.status, 0, second.stdout + second.stderr);

  const target = path.join(root, '.cursor', 'commands', 'plan.md');
  const original = fs.readFileSync(target);
  fs.appendFileSync(target, '\nlocal modification\n');
  const conflict = run(root, '--host', 'cursor', '--profile', 'decameron', '--project');
  assert.equal(conflict.status, 1);
  assert.match(conflict.stderr, /refusing to overwrite existing files/);

  fs.writeFileSync(target, original);
  const uninstall = run(root, '--host', 'cursor', '--profile', 'decameron', '--project', '--uninstall');
  assert.equal(uninstall.status, 0, uninstall.stdout + uninstall.stderr);
  assert.equal(fs.existsSync(path.join(root, '.cursor')), false);
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

test('installs Codex custom agents using the documented TOML surface', () => {
  const root = makeSandbox();
  const result = run(root, '--host', 'codex', '--profile', 'default', '--project');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const content = readInstalled(root, path.join('.codex', 'agents', 'code-reviewer.toml'));
  assert.match(content, /^name = "code-reviewer"$/m);
  assert.match(content, /^description = ".+"$/m);
  assert.match(content, /^developer_instructions = "/m);
  assert.match(content, /developer_instructions = .*Review Framework/);
  assert.equal(fs.existsSync(path.join(root, '.agents', 'agents')), false);
  assert.equal(fs.existsSync(path.join(root, '.codex', 'docs', 'agents.md')), true);
});

test('keeps OpenCode and OpenChamber shared files alive until both owners uninstall', () => {
  const root = makeSandbox();
  for (const host of ['opencode', 'openchamber']) {
    const result = run(root, '--host', host, '--profile', 'default', '--project');
    assert.equal(result.status, 0, `${host}: ${result.stdout}${result.stderr}`);
  }
  const firstUninstall = run(root, '--host', 'opencode', '--profile', 'default', '--project', '--uninstall');
  assert.equal(firstUninstall.status, 0, firstUninstall.stdout + firstUninstall.stderr);
  assert.equal(fs.existsSync(path.join(root, '.opencode', 'skills', 'idea-refine', 'examples.md')), true);
  assert.equal(fs.existsSync(path.join(root, '.opencode', 'docs', 'agents.md')), true);
  const secondUninstall = run(root, '--host', 'openchamber', '--profile', 'default', '--project', '--uninstall');
  assert.equal(secondUninstall.status, 0, secondUninstall.stdout + secondUninstall.stderr);
  assert.equal(fs.existsSync(path.join(root, '.opencode')), false);
});

test('uses OpenCode V2 MCP servers and shared OpenChamber ownership', () => {
  const root = makeSandbox();
  for (const host of ['opencode', 'openchamber']) {
    const result = run(root, '--host', host, '--profile', 'decameron', '--project');
    assert.equal(result.status, 0, `${host}: ${result.stdout}${result.stderr}`);
  }
  const configPath = path.join(root, 'opencode.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  assert.deepEqual(Object.keys(config.mcp), ['servers']);
  assert.deepEqual(Object.keys(config.mcp.servers).sort(), ['context7', 'kubernetes']);
  assert.deepEqual(config.mcp.servers.context7, {
    type: 'local',
    command: ['npx', '-y', '@upstash/context7-mcp'],
  });
  assert.equal(config.mcp.servers.kubernetes.enabled, undefined);
  assert.equal(config.mcp.servers.kubernetes.disabled, undefined);

  const firstUninstall = run(root, '--host', 'opencode', '--profile', 'decameron', '--project', '--uninstall');
  assert.equal(firstUninstall.status, 0, firstUninstall.stdout + firstUninstall.stderr);
  assert.equal(fs.existsSync(configPath), true);
  assert.match(fs.readFileSync(configPath, 'utf8'), /"servers"/);
  const secondUninstall = run(root, '--host', 'openchamber', '--profile', 'decameron', '--project', '--uninstall');
  assert.equal(secondUninstall.status, 0, secondUninstall.stdout + secondUninstall.stderr);
  assert.equal(fs.existsSync(configPath), false);
});

test('respects existing higher-precedence OpenCode project configuration', () => {
  const root = makeSandbox();
  const configPath = path.join(root, '.opencode', 'opencode.json');
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({ projectSetting: true }, null, 2) + '\n');
  const result = run(root, '--host', 'opencode', '--profile', 'decameron', '--project');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(fs.existsSync(path.join(root, 'opencode.json')), false);
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  assert.equal(config.projectSetting, true);
  assert.deepEqual(Object.keys(config.mcp.servers).sort(), ['context7', 'kubernetes']);
});

test('merges Codex MCP around unrelated TOML and cleans installer-owned config', () => {
  const root = makeSandbox();
  const install = run(root, '--host', 'codex', '--profile', 'decameron', '--project');
  assert.equal(install.status, 0, install.stdout + install.stderr);
  const configPath = path.join(root, '.codex', 'config.toml');
  fs.appendFileSync(configPath, '\n[features]\nsome_setting = true\n');
  const reinstall = run(root, '--host', 'codex', '--profile', 'decameron', '--project');
  assert.equal(reinstall.status, 0, reinstall.stdout + reinstall.stderr);
  const merged = fs.readFileSync(configPath, 'utf8');
  assert.match(merged, /\[mcp_servers\.context7\]/);
  assert.match(merged, /\[features\]\nsome_setting = true/);
  const uninstall = run(root, '--host', 'codex', '--profile', 'decameron', '--project', '--uninstall');
  assert.equal(uninstall.status, 0, uninstall.stdout + uninstall.stderr);
  assert.match(fs.readFileSync(configPath, 'utf8'), /\[features\]\nsome_setting = true/);

  const cleanRoot = makeSandbox();
  const cleanInstall = run(cleanRoot, '--host', 'codex', '--profile', 'decameron', '--project');
  assert.equal(cleanInstall.status, 0, cleanInstall.stdout + cleanInstall.stderr);
  const cleanUninstall = run(cleanRoot, '--host', 'codex', '--profile', 'decameron', '--project', '--uninstall');
  assert.equal(cleanUninstall.status, 0, cleanUninstall.stdout + cleanUninstall.stderr);
  assert.equal(fs.existsSync(path.join(cleanRoot, '.codex', 'config.toml')), false);

  const userRoot = makeSandbox();
  const userConfig = path.join(userRoot, '.codex', 'config.toml');
  fs.mkdirSync(path.dirname(userConfig), { recursive: true });
  fs.writeFileSync(userConfig, '[features]\nsome_setting = true\n');
  const userInstall = run(userRoot, '--host', 'codex', '--profile', 'decameron', '--project');
  assert.equal(userInstall.status, 0, userInstall.stdout + userInstall.stderr);
  const userUninstall = run(userRoot, '--host', 'codex', '--profile', 'decameron', '--project', '--uninstall');
  assert.equal(userUninstall.status, 0, userUninstall.stdout + userUninstall.stderr);
  assert.equal(fs.readFileSync(userConfig, 'utf8'), '[features]\nsome_setting = true\n');

  const malformedRoot = makeSandbox();
  const malformedConfig = path.join(malformedRoot, '.codex', 'config.toml');
  fs.mkdirSync(path.dirname(malformedConfig), { recursive: true });
  fs.writeFileSync(malformedConfig, '{not toml\n');
  const original = fs.readFileSync(malformedConfig);
  const malformedInstall = run(malformedRoot, '--host', 'codex', '--profile', 'decameron', '--project');
  assert.equal(malformedInstall.status, 1);
  assert.deepEqual(fs.readFileSync(malformedConfig), original);
});

test('writes MCP configuration in each host native representation', () => {
  const cases = [
    ['claude', '.mcp.json', (content) => assert.equal(JSON.parse(content).mcpServers.context7.command, 'npx')],
    ['cursor', '.cursor/mcp.json', (content) => assert.equal(JSON.parse(content).mcpServers.context7.command, 'npx')],
    ['gemini', '.gemini/settings.json', (content) => assert.equal(JSON.parse(content).mcpServers.context7.command, 'npx')],
    ['opencode', 'opencode.json', (content) => assert.deepEqual(JSON.parse(content).mcp.servers.context7.command, ['npx', '-y', '@upstash/context7-mcp'])],
    ['openchamber', 'opencode.json', (content) => assert.deepEqual(JSON.parse(content).mcp.servers.context7.command, ['npx', '-y', '@upstash/context7-mcp'])],
  ];
  for (const [host, relative, verify] of cases) {
    const root = makeSandbox();
    const result = run(root, '--host', host, '--profile', 'decameron', '--project');
    assert.equal(result.status, 0, `${host}: ${result.stdout}${result.stderr}`);
    verify(readInstalled(root, relative));
  }
});

test('preserves identical MCP, rejects conflicts, and refuses malformed JSON', () => {
  const root = makeSandbox();
  const configPath = path.join(root, '.cursor', 'mcp.json');
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({ mcpServers: {
    context7: { command: 'npx', args: ['-y', '@upstash/context7-mcp'], type: 'stdio' },
  } }, null, 2) + '\n');
  const identical = run(root, '--host', 'cursor', '--profile', 'decameron', '--project');
  assert.equal(identical.status, 0, identical.stdout + identical.stderr);
  fs.writeFileSync(configPath, JSON.stringify({ mcpServers: {
    context7: { command: 'other', args: [], type: 'stdio' },
  } }, null, 2) + '\n');
  const conflict = run(root, '--host', 'cursor', '--profile', 'decameron', '--project');
  assert.equal(conflict.status, 1);
  assert.match(conflict.stderr, /MCP 'context7' already exists/);

  const malformedRoot = makeSandbox();
  const malformedPath = path.join(malformedRoot, '.cursor', 'mcp.json');
  fs.mkdirSync(path.dirname(malformedPath), { recursive: true });
  fs.writeFileSync(malformedPath, '{not json\n');
  const original = fs.readFileSync(malformedPath);
  const malformed = run(malformedRoot, '--host', 'cursor', '--profile', 'decameron', '--project');
  assert.equal(malformed.status, 1);
  assert.deepEqual(fs.readFileSync(malformedPath), original);
});

test('adds contextual Skills with explainable evidence and reconciles removal', () => {
  const root = makeSandbox();
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { next: '^15.0.0' } }));
  fs.writeFileSync(path.join(root, 'next.config.ts'), 'export default {}\n');
  const install = run(root, '--host', 'cursor', '--profile', 'decameron', '--project');
  assert.equal(install.status, 0, install.stdout + install.stderr);
  assert.match(install.stdout, /Detected project context: nextjs/);
  assert.match(install.stdout, /nextjs-vercel-engineering/);
  assert.equal(fs.existsSync(path.join(root, '.cursor', 'skills', 'nextjs-vercel-engineering', 'SKILL.md')), true);
  let manifest = JSON.parse(fs.readFileSync(path.join(root, '.agent-standard', 'installations', 'cursor.json'), 'utf8'));
  assert.equal(manifest.contextualSkills.length, 1);
  assert.match(manifest.contextualSkills[0].evidence.join('\n'), /package.json/);

  fs.rmSync(path.join(root, 'package.json'));
  fs.rmSync(path.join(root, 'next.config.ts'));
  const reinstall = run(root, '--host', 'cursor', '--profile', 'decameron', '--project');
  assert.equal(reinstall.status, 0, reinstall.stdout + reinstall.stderr);
  assert.equal(fs.existsSync(path.join(root, '.cursor', 'skills', 'nextjs-vercel-engineering')), false);
  manifest = JSON.parse(fs.readFileSync(path.join(root, '.agent-standard', 'installations', 'cursor.json'), 'utf8'));
  assert.deepEqual(manifest.contextualSkills, []);
  assert.equal(fs.existsSync(path.join(root, '.cursor', 'skills', 'security-and-hardening', 'SKILL.md')), true);
});

test('contextual Skills augment each host project installation but not global installation', () => {
  for (const host of ['claude', 'codex', 'cursor', 'gemini', 'opencode', 'openchamber']) {
    const root = makeSandbox();
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { next: '^15.0.0' } }));
    const project = run(root, '--host', host, '--profile', 'decameron', '--project');
    assert.equal(project.status, 0, `${host}: ${project.stdout}${project.stderr}`);
    const destination = { claude: '.claude', codex: '.agents', cursor: '.cursor', gemini: '.gemini', opencode: '.opencode', openchamber: '.opencode' }[host];
    assert.equal(fs.existsSync(path.join(root, destination, 'skills', 'nextjs-vercel-engineering', 'SKILL.md')), true, host);

    const globalRoot = makeSandbox();
    fs.writeFileSync(path.join(globalRoot, 'package.json'), JSON.stringify({ dependencies: { next: '^15.0.0' } }));
    const home = makeSandbox();
    const global = run(globalRoot, '--host', host, '--profile', 'decameron', '--global', { env: { HOME: home } });
    assert.equal(global.status, 0, `${host} global: ${global.stdout}${global.stderr}`);
    assert.equal(fs.existsSync(path.join(home, destination, 'skills', 'nextjs-vercel-engineering')), false, `${host} global context leaked`);
  }
});

test('contextual dry-run explains evidence without writing and shared hosts preserve ownership', () => {
  const root = makeSandbox();
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { next: '^15.0.0' } }));
  const before = relativeFiles(root).sort();
  const dry = run(root, '--host', 'cursor', '--profile', 'decameron', '--project', '--dry-run');
  assert.equal(dry.status, 0, dry.stdout + dry.stderr);
  assert.match(dry.stdout, /Detected project context: nextjs/);
  assert.match(dry.stdout, /package.json -> dependency "next"/);
  assert.deepEqual(relativeFiles(root).sort(), before);

  for (const host of ['opencode', 'openchamber']) {
    const install = run(root, '--host', host, '--profile', 'decameron', '--project');
    assert.equal(install.status, 0, `${host}: ${install.stdout}${install.stderr}`);
  }
  const skillFile = path.join(root, '.opencode', 'skills', 'nextjs-vercel-engineering', 'SKILL.md');
  assert.equal(fs.existsSync(skillFile), true);
  const first = run(root, '--host', 'opencode', '--profile', 'decameron', '--project', '--uninstall');
  assert.equal(first.status, 0, first.stdout + first.stderr);
  assert.equal(fs.existsSync(skillFile), true);
  const second = run(root, '--host', 'openchamber', '--profile', 'decameron', '--project', '--uninstall');
  assert.equal(second.status, 0, second.stdout + second.stderr);
  assert.equal(fs.existsSync(skillFile), false);
});

test('resolves Decameron command dependencies during installation', () => {
  const root = makeSandbox();
  const result = run(root, '--host', 'cursor', '--profile', 'decameron', '--project');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const skill of ['spec-driven-development', 'planning-and-task-breakdown', 'incremental-implementation', 'test-driven-development', 'code-review-and-quality', 'security-and-hardening', 'performance-optimization', 'shipping-and-launch']) {
    assert.equal(fs.existsSync(path.join(root, '.cursor', 'skills', skill, 'SKILL.md')), true, skill);
  }
  for (const agent of ['code-reviewer', 'security-auditor', 'test-engineer']) {
    assert.equal(fs.existsSync(path.join(root, '.cursor', 'agents', `${agent}.md`)), true, agent);
  }
  assert.equal(fs.existsSync(path.join(root, '.cursor', 'references', 'orchestration-patterns.md')), true);
});

test('runtime integrity is clean for default and Decameron profiles on every host', () => {
  for (const profile of ['default', 'decameron']) {
    for (const host of ['claude', 'codex', 'cursor', 'opencode', 'gemini', 'openchamber']) {
      const root = makeSandbox();
      const install = run(root, '--host', host, '--profile', profile, '--project');
      assert.equal(install.status, 0, `${host}/${profile}: ${install.stdout}${install.stderr}`);
      const integrity = spawnSync(process.execPath, [INTEGRITY_SCRIPT, '--root', root, '--host', host, '--profile', profile], {
        cwd: ROOT,
        encoding: 'utf8',
      });
      assert.equal(integrity.status, 0, `${host}/${profile}: ${integrity.stdout}${integrity.stderr}`);

      const globalRoot = makeSandbox();
      const home = makeSandbox();
      const globalInstall = run(globalRoot, '--host', host, '--profile', profile, '--global', { env: { HOME: home } });
      assert.equal(globalInstall.status, 0, `${host}/${profile} global: ${globalInstall.stdout}${globalInstall.stderr}`);
      const globalIntegrity = spawnSync(process.execPath, [INTEGRITY_SCRIPT, '--root', home, '--host', host, '--profile', profile, '--scope', 'global'], {
        cwd: ROOT,
        encoding: 'utf8',
      });
      assert.equal(globalIntegrity.status, 0, `${host}/${profile} global: ${globalIntegrity.stdout}${globalIntegrity.stderr}`);
    }
  }
});

test('uses isolated project and global destinations without touching the real home', () => {
  const cases = [
    ['opencode', '.opencode/agents/code-reviewer.md', '.config/opencode/agents/code-reviewer.md'],
    ['gemini', '.gemini/agents/code-reviewer.md', '.gemini/agents/code-reviewer.md'],
    ['openchamber', '.opencode/agents/code-reviewer.md', '.config/opencode/agents/code-reviewer.md'],
    ['codex', '.codex/agents/code-reviewer.toml', '.codex/agents/code-reviewer.toml'],
    ['claude', '.claude/agents/code-reviewer.md', '.claude/agents/code-reviewer.md'],
    ['cursor', '.cursor/skills/api-and-interface-design/SKILL.md', '.cursor/skills/api-and-interface-design/SKILL.md'],
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

test('installs Cursor agents in isolated global scope', () => {
  const root = makeSandbox();
  const home = makeSandbox();
  const result = run(root, '--host', 'cursor', '--profile', 'default', '--global', { env: { HOME: home } });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(fs.existsSync(path.join(home, '.cursor', 'agents', 'code-reviewer.md')), true);
  assert.equal(fs.existsSync(path.join(home, '.cursor', 'commands')), false);
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
    const manifest = JSON.parse(fs.readFileSync(path.join(root, '.agent-standard', 'installations', `${host}.json`), 'utf8'));
    assert.ok(manifest.files.length >= profile.skills.length);
  }
});

test('does not invent command files for hosts without native command support', () => {
  for (const host of ['codex']) {
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
  const manifestPath = path.join(root, '.agent-standard', 'installations', 'cursor.json');
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
