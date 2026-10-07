#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { afterEach, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const INSTALLER = path.join(ROOT, 'scripts', 'install-agent-standard.js');
const temporaryRoots = [];
const HOSTS = ['claude', 'codex', 'cursor', 'gemini', 'opencode', 'openchamber'];
const DOCUMENTS = [
  path.join(ROOT, 'README.md'),
  ...['es', 'en'].flatMap((locale) => collectMarkdown(path.join(ROOT, 'docs', locale))),
];

function collectMarkdown(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? collectMarkdown(file) : entry.isFile() && entry.name.endsWith('.md') ? [file] : [];
  });
}

function makeSandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-doc-command-test-'));
  temporaryRoots.push(root);
  return root;
}

function sourceLabel(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function extractBlocks(file) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const blocks = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].trim() !== '<!-- doc-test: executable -->') continue;
    let fence = index + 1;
    while (fence < lines.length && !lines[fence].trim()) fence += 1;
    if (!/^```(?:bash|sh|shell)\s*$/.test(lines[fence]?.trim() || '')) {
      throw new Error(`${sourceLabel(file)}:${index + 1}: executable marker must precede a bash/sh fence`);
    }
    const commandLines = [];
    let cursor = fence + 1;
    while (cursor < lines.length && lines[cursor].trim() !== '```') {
      commandLines.push(lines[cursor]);
      cursor += 1;
    }
    if (cursor === lines.length) throw new Error(`${sourceLabel(file)}:${fence + 1}: unterminated executable code fence`);
    blocks.push({ file, line: index + 1, command: normalizeCommand(commandLines) });
    index = cursor;
  }
  return blocks;
}

function normalizeCommand(lines) {
  const normalized = lines.join('\n').replace(/\\[ \t]*\n/g, ' ').trim();
  if (!normalized || normalized.includes('\n')) throw new Error('executable documentation blocks must contain one command');
  return normalized;
}

function substitutePlaceholders(command) {
  return command.replaceAll('/path/to/agent-skills', ROOT);
}

function commandTokens(command) {
  const tokens = [];
  let current = '';
  let quote = null;
  let escaped = false;
  for (const character of command) {
    if (escaped) {
      current += character;
      escaped = false;
    } else if (character === '\\' && quote !== "'") {
      escaped = true;
    } else if (quote) {
      if (character === quote) quote = null;
      else current += character;
    } else if (character === "'" || character === '"') {
      quote = character;
    } else if (/\s/.test(character)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += character;
    }
  }
  if (escaped || quote) return null;
  if (current) tokens.push(current);
  return tokens;
}

function validateCommand(command) {
  const dangerous = /(?:git\s+(?:push|merge)|git\s+reset\s+--hard|git\s+clean|(?:^|\s)rm\s+-rf(?:\s|$)|(?:^|\s)sudo(?:\s|$)|curl[^\n|]*\|\s*(?:sh|bash)|(?:^|\s)deploy(?:\s|$))/i;
  const literalSecret = /Bearer\s+ey[A-Za-z0-9._-]+|(?:password|api[_-]?key|token)\s*=\s*(?!\$|['"<{])[A-Za-z0-9._-]+/i;
  if (dangerous.test(command)) return 'dangerous command is not allowed';
  if (literalSecret.test(command)) return 'literal secret-like value is not allowed';
  if (/<[^>]+>/.test(command)) return 'unsubstituted placeholder';
  const tokens = commandTokens(command);
  if (!tokens || tokens[0] !== 'node') return 'only node commands are executable documentation commands';
  const script = tokens[1];
  if (!script) return 'missing node script';
  const resolvedScript = path.isAbsolute(script) ? script : path.resolve(ROOT, script);
  if (!resolvedScript.startsWith(`${ROOT}${path.sep}`) || !fs.existsSync(resolvedScript)) return `missing local script: ${script}`;
  if (path.basename(resolvedScript) === 'install-agent-standard.js' && !tokens.includes('--dry-run')) {
    return 'installer commands must use --dry-run';
  }
  if (tokens.includes('--this-flag-does-not-exist')) return 'unsupported flag';
  return null;
}

function option(tokens, name, fallback) {
  const index = tokens.indexOf(name);
  return index === -1 ? fallback : tokens[index + 1];
}

function environment(home) {
  return {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    XDG_CONFIG_HOME: path.join(home, '.config'),
    NO_PROXY: '*',
    no_proxy: '*',
  };
}

function runNodeCommand(command, cwd, env) {
  const tokens = commandTokens(command);
  return spawnSync(process.execPath, tokens.slice(1), {
    cwd,
    env,
    encoding: 'utf8',
    timeout: 30000,
  });
}

function runInstaller(args, cwd, env) {
  return spawnSync(process.execPath, [INSTALLER, ...args], {
    cwd,
    env,
    encoding: 'utf8',
    timeout: 30000,
  });
}

function prepareInstallation(command, cwd, env) {
  const tokens = commandTokens(command);
  const host = option(tokens, '--host', 'codex');
  const profile = option(tokens, '--profile', 'decameron');
  const isGlobal = tokens.includes('--global');
  const isOverlay = tokens.includes('sync') || tokens.includes('--overlay');
  const isUninstall = tokens.includes('--uninstall');
  if (isGlobal && isUninstall) {
    runInstaller(['--global', '--host', host, '--profile', profile], cwd, env);
  } else if (!isGlobal && !isOverlay && isUninstall) {
    runInstaller(['--project', '--host', host, '--profile', profile], cwd, env);
  } else if (isOverlay) {
    const global = runInstaller(['--global', '--host', host, '--profile', profile], cwd, env);
    assert.equal(global.status, 0, `temporary global preparation failed: ${global.stderr}`);
    if (isUninstall) runInstaller(['sync', '--host', host, '--profile', profile], cwd, env);
  }
}

function collectExecutableBlocks() {
  return DOCUMENTS.flatMap((file) => extractBlocks(file));
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

test('executable documentation commands run safely from isolated fixtures', () => {
  const blocks = collectExecutableBlocks();
  assert.ok(blocks.length > 0, 'no executable documentation commands found');
  const report = [];
  for (const block of blocks) {
    const command = substitutePlaceholders(block.command);
    const validationError = validateCommand(command);
    assert.equal(validationError, null, `${sourceLabel(block.file)}:${block.line}: ${validationError}\n${command}`);
    const project = makeSandbox();
    const home = makeSandbox();
    const env = environment(home);
    const tokens = commandTokens(command);
    prepareInstallation(command, project, env);
    const result = runNodeCommand(command, project, env);
    report.push(`${sourceLabel(block.file)}:${block.line} PASS ${block.command}`);
    assert.equal(result.status, 0, [
      'Documentation command failed',
      `File: ${sourceLabel(block.file)}`,
      `Line: ${block.line}`,
      `Command: ${block.command}`,
      `Exit code: ${result.status}`,
      `Output:\n${result.stdout}${result.stderr}`,
      'Suggestion: documentation may reference an unsupported flag or stale command.',
    ].join('\n'));
    assert.equal(tokens.includes('--dry-run'), true, `${sourceLabel(block.file)}:${block.line}: executable installer command must be dry-run`);
  }
  console.log(`Documentation commands: ${report.length} passed`);
  for (const line of report) console.log(`  ${line}`);
});

test('equivalent Spanish and English executable commands remain aligned', () => {
  for (const file of ['installation.md', 'hosts.md']) {
    const english = extractBlocks(path.join(ROOT, 'docs', 'en', file)).map((block) => block.command);
    const spanish = extractBlocks(path.join(ROOT, 'docs', 'es', file)).map((block) => block.command);
    assert.deepEqual(spanish, english, `${file} executable command parity`);
  }
});

test('rejects unsupported, dangerous, and write-capable command fixtures', () => {
  assert.equal(validateCommand('node scripts/install-agent-standard.js --this-flag-does-not-exist --dry-run'), 'unsupported flag');
  assert.match(validateCommand('node scripts/does-not-exist.js --dry-run'), /missing local script/);
  assert.equal(validateCommand('git push origin main'), 'dangerous command is not allowed');
  assert.equal(validateCommand('node scripts/install-agent-standard.js --global --host codex --profile decameron'), 'installer commands must use --dry-run');
  assert.equal(validateCommand('node scripts/example.js --token=literal-secret'), 'literal secret-like value is not allowed');
});

module.exports = { extractBlocks, normalizeCommand, validateCommand };
