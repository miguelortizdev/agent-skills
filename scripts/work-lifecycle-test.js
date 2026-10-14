'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { afterEach, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'work-lifecycle.js');
const INSTALLER = path.join(ROOT, 'scripts', 'install-agent-standard.js');
const INTEGRITY = path.join(ROOT, 'scripts', 'validate-installation-integrity.js');
const repos = [];

function git(repo, args, allowFailure = false) {
  const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  if (!allowFailure) assert.equal(result.status, 0, result.stdout + result.stderr);
  return result;
}

function gitNulPaths(root, args) {
  return git(root, [...args, '-z']).stdout.split('\0').filter(Boolean);
}

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'work-lifecycle-'));
  repos.push(root);
  git(root, ['init', '-b', 'main']);
  git(root, ['config', 'user.name', 'Work Lifecycle Test']);
  git(root, ['config', 'user.email', 'work-lifecycle@example.test']);
  fs.writeFileSync(path.join(root, 'README.md'), '# Test\n');
  git(root, ['add', 'README.md']);
  git(root, ['commit', '-m', 'test: initialize repository']);
  return root;
}

function run(root, args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { cwd: root, encoding: 'utf8' });
}

function runWithEnv(root, args, env) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

function install(root, args, env = {}) {
  return spawnSync(process.execPath, [INSTALLER, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

afterEach(() => {
  for (const root of repos.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

test('starts a branch from an explicit reference without remote operations', () => {
  const root = repo();
  const result = run(root, ['start', 'feature', 'integracion-dingus', '--from', 'main']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(git(root, ['branch', '--show-current']).stdout.trim(), 'feature/integracion-dingus');
  assert.match(result.stdout, /Created branch: feature\/integracion-dingus/);
});

test('reuses an existing local branch in a clean repository without rewriting its commit', () => {
  const root = repo();
  git(root, ['branch', 'feature/integracion-dingus']);
  const before = git(root, ['rev-parse', 'feature/integracion-dingus']).stdout.trim();
  const result = run(root, ['start', 'feature', 'integracion-dingus', '--existing']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(git(root, ['branch', '--show-current']).stdout.trim(), 'feature/integracion-dingus');
  assert.equal(git(root, ['rev-parse', 'feature/integracion-dingus']).stdout.trim(), before);
  assert.match(result.stdout, /Reused existing branch: feature\/integracion-dingus/);
});

test('reports an existing branch already active in the current Worktree without changing it', () => {
  const root = repo();
  git(root, ['switch', '-c', 'feature/integracion-dingus']);
  const before = git(root, ['rev-parse', 'HEAD']).stdout.trim();
  const result = run(root, ['start', 'feature', 'integracion-dingus', '--existing']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(git(root, ['rev-parse', 'HEAD']).stdout.trim(), before);
  assert.match(result.stdout, /already active/);
  assert.match(result.stdout, /Branch: feature\/integracion-dingus/);
  const lifecycleDirectory = path.resolve(root, git(root, ['rev-parse', '--git-path', 'work-lifecycle']).stdout.trim());
  assert.equal(fs.existsSync(lifecycleDirectory), false);
});

test('locates an existing branch owned by another Worktree without changing either Worktree', () => {
  const root = repo();
  const target = path.resolve(root, '..', `${path.basename(root)}-feature-integracion-dingus`);
  git(root, ['worktree', 'add', '-b', 'feature/integracion-dingus', target, 'main']);
  fs.writeFileSync(path.join(target, 'local.txt'), 'uncommitted\n');
  const result = run(root, ['start', 'feature', 'integracion-dingus', '--existing']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(fs.readFileSync(path.join(target, 'local.txt'), 'utf8'), 'uncommitted\n');
  assert.equal(git(root, ['branch', '--show-current']).stdout.trim(), 'main');
  fs.rmSync(target, { recursive: true, force: true });
});

test('locates an existing Worktree whose path contains a newline', () => {
  const initial = repo();
  const root = `${initial}\nworktree-root`;
  fs.renameSync(initial, root);
  repos[repos.length - 1] = root;
  const target = path.resolve(root, '..', `${path.basename(root)}-feature-integracion-dingus`);
  git(root, ['worktree', 'add', '-b', 'feature/integracion-dingus', target, 'main']);
  const result = run(root, ['start', 'feature', 'integracion-dingus', '--existing']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Existing branch is already associated with a Worktree/);
  assert.ok(result.stdout.includes(target));
  fs.rmSync(target, { recursive: true, force: true });
});

test('associates an existing local branch with a Worktree when the current tree is dirty', () => {
  const root = repo();
  git(root, ['branch', 'feature/integracion-dingus']);
  fs.writeFileSync(path.join(root, 'keep.txt'), 'keep\n');
  const result = run(root, ['start', 'feature', 'integracion-dingus', '--existing']);
  const target = path.resolve(root, '..', `${path.basename(root)}-feature-integracion-dingus`);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(git(root, ['branch', '--show-current']).stdout.trim(), 'main');
  assert.equal(fs.readFileSync(path.join(root, 'keep.txt'), 'utf8'), 'keep\n');
  assert.equal(git(target, ['branch', '--show-current']).stdout.trim(), 'feature/integracion-dingus');
  assert.match(result.stdout, /Reused existing branch in Worktree/);
  fs.rmSync(target, { recursive: true, force: true });
});

test('does not apply inherited-document protection when reusing an existing branch', () => {
  const root = repo();
  git(root, ['switch', '-c', 'feature/integracion-dingus']);
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# Existing\n');
  fs.mkdirSync(path.join(root, 'tasks'));
  fs.writeFileSync(path.join(root, 'tasks', 'plan.md'), '# Plan\n');
  fs.writeFileSync(path.join(root, 'tasks', 'todo.md'), '- [ ] pending\n');
  git(root, ['add', 'SPEC.md', 'tasks']);
  git(root, ['commit', '-m', 'docs: preserve existing work context']);
  const result = run(root, ['start', 'feature', 'integracion-dingus', '--existing']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(git(root, ['branch', '--show-current']).stdout.trim(), 'feature/integracion-dingus');
  assert.equal(fs.existsSync(path.join(root, 'SPEC.md')), true);
});

test('rejects existing mode when the local branch is absent without creating it', () => {
  const root = repo();
  const result = run(root, ['start', 'feature', 'integracion-dingus', '--existing']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /local branch does not exist/);
  assert.equal(git(root, ['show-ref', '--verify', '--quiet', 'refs/heads/feature/integracion-dingus'], true).status, 1);
  assert.equal(git(root, ['branch', '--show-current']).stdout.trim(), 'main');
});

test('rejects existing mode combined with from', () => {
  const root = repo();
  const result = run(root, ['start', 'feature', 'integracion-dingus', '--existing', '--from', 'main']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--existing cannot be combined with --from/);
});

test('rejects unknown start arguments while preserving new-branch behavior', () => {
  const root = repo();
  const result = run(root, ['start', 'feature', 'integracion-dingus', '--existing', '--unknown']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unknown start option: --unknown/);
  const created = run(root, ['start', 'feature', 'new-work', '--from', 'main']);
  assert.equal(created.status, 0, created.stdout + created.stderr);
});

test('does not select a remote-only branch for existing mode', () => {
  const root = repo();
  git(root, ['remote', 'add', 'origin', 'https://example.invalid/repository.git']);
  git(root, ['update-ref', 'refs/remotes/origin/feature/integracion-dingus', git(root, ['rev-parse', 'main']).stdout.trim()]);
  const result = run(root, ['start', 'feature', 'integracion-dingus', '--existing']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /only exists remotely|local branch does not exist/);
  assert.equal(git(root, ['branch', '--show-current']).stdout.trim(), 'main');
});

test('associates an existing clean branch with an explicit Worktree without creating a branch', () => {
  const root = repo();
  git(root, ['branch', 'feature/integracion-dingus']);
  const result = run(root, ['start', 'feature', 'integracion-dingus', '--existing', '--worktree']);
  const target = path.resolve(root, '..', `${path.basename(root)}-feature-integracion-dingus`);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(git(root, ['branch', '--show-current']).stdout.trim(), 'main');
  assert.equal(git(target, ['branch', '--show-current']).stdout.trim(), 'feature/integracion-dingus');
  assert.match(git(root, ['branch', '--list', 'feature/integracion-dingus']).stdout.trim(), /feature\/integracion-dingus/);
  fs.rmSync(target, { recursive: true, force: true });
});

test('stops on a locked existing Worktree without removing or changing it', () => {
  const root = repo();
  const target = path.resolve(root, '..', `${path.basename(root)}-feature-integracion-dingus`);
  git(root, ['worktree', 'add', '-b', 'feature/integracion-dingus', target, 'main']);
  git(root, ['worktree', 'lock', target, '--reason', 'keep this worktree']);
  const result = run(root, ['start', 'feature', 'integracion-dingus', '--existing']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /locked, inaccessible, or prunable/);
  assert.equal(fs.existsSync(target), true);
  assert.equal(git(target, ['branch', '--show-current']).stdout.trim(), 'feature/integracion-dingus');
  git(root, ['worktree', 'unlock', target]);
  fs.rmSync(target, { recursive: true, force: true });
});

test('stops on an existing Worktree destination collision without altering the repository', () => {
  const root = repo();
  git(root, ['branch', 'feature/integracion-dingus']);
  const target = path.resolve(root, '..', `${path.basename(root)}-feature-integracion-dingus`);
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, 'do-not-touch.txt'), 'preserve\n');
  fs.writeFileSync(path.join(root, 'dirty.txt'), 'dirty\n');
  const result = run(root, ['start', 'feature', 'integracion-dingus', '--existing']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Worktree destination already exists/);
  assert.equal(fs.readFileSync(path.join(target, 'do-not-touch.txt'), 'utf8'), 'preserve\n');
  assert.equal(git(root, ['branch', '--show-current']).stdout.trim(), 'main');
  fs.rmSync(target, { recursive: true, force: true });
});

test('reusing an existing branch performs no remote operation', () => {
  const root = repo();
  git(root, ['remote', 'add', 'origin', 'https://example.invalid/repository.git']);
  git(root, ['branch', 'feature/integracion-dingus']);
  const trace = path.join(root, 'git-trace.json');
  const result = runWithEnv(root, ['start', 'feature', 'integracion-dingus', '--existing'], { GIT_TRACE2_EVENT: trace });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.doesNotMatch(fs.readFileSync(trace, 'utf8'), /fetch|pull|push/);
});

test('stops when another start operation owns the lifecycle lock', () => {
  const root = repo();
  git(root, ['branch', 'feature/integracion-dingus']);
  const lifecycleDirectory = path.resolve(root, git(root, ['rev-parse', '--git-path', 'work-lifecycle']).stdout.trim());
  fs.mkdirSync(lifecycleDirectory, { recursive: true });
  const lock = path.join(lifecycleDirectory, 'start.lock');
  fs.writeFileSync(lock, 'held\n');
  const result = run(root, ['start', 'feature', 'integracion-dingus', '--existing']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /another \/work start operation is in progress/);
  assert.equal(fs.readFileSync(lock, 'utf8'), 'held\n');
  assert.equal(git(root, ['branch', '--show-current']).stdout.trim(), 'main');
});

test('creates and discovers an isolated Worktree without changing the original directory', () => {
  const root = repo();
  const result = run(root, ['start', 'hotfix', 'error-pagos', '--from', 'main', '--worktree']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const target = path.resolve(root, '..', `${path.basename(root)}-hotfix-error-pagos`);
  assert.equal(fs.existsSync(target), true);
  assert.equal(git(root, ['branch', '--show-current']).stdout.trim(), 'main');
  const switched = run(root, ['switch', 'hotfix/error-pagos']);
  assert.equal(switched.status, 0, switched.stdout + switched.stderr);
  assert.match(switched.stdout, new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  fs.rmSync(target, { recursive: true, force: true });
});

test('isolates dirty work automatically and still refuses inherited documents', () => {
  const root = repo();
  fs.writeFileSync(path.join(root, 'dirty.txt'), 'local\n');
  const dirty = run(root, ['start', 'feature', 'dirty', '--from', 'main']);
  assert.equal(dirty.status, 0, dirty.stdout + dirty.stderr);
  assert.equal(fs.existsSync(path.resolve(root, '..', `${path.basename(root)}-feature-dirty`)), true);
  assert.equal(git(root, ['branch', '--show-current']).stdout.trim(), 'main');
  fs.rmSync(path.resolve(root, '..', `${path.basename(root)}-feature-dirty`), { recursive: true, force: true });
  fs.rmSync(path.join(root, 'dirty.txt'));
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# Existing spec\n');
  git(root, ['add', 'SPEC.md']);
  git(root, ['commit', '-m', 'docs: add active spec']);
  const result = run(root, ['start', 'feature', 'inherited', '--from', 'main']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /active work documents/);
});

test('closes documents selectively, preserves content, and is safe to retry', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'integracion-dingus', '--from', 'main']).status, 0);
  fs.mkdirSync(path.join(root, 'tasks'));
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# Specification\n');
  fs.writeFileSync(path.join(root, 'tasks', 'plan.md'), '# Plan\n');
  fs.writeFileSync(path.join(root, 'tasks', 'todo.md'), '- [ ] pending follow-up\n');
  const close = run(root, ['close', '--allow-incomplete']);
  assert.equal(close.status, 0, close.stdout + close.stderr);
  const destination = path.join(root, 'docs', 'work-items', 'features', 'integracion-dingus');
  assert.equal(fs.readFileSync(path.join(destination, 'SPEC.md'), 'utf8'), '# Specification\n');
  assert.equal(fs.readFileSync(path.join(destination, 'plan.md'), 'utf8'), '# Plan\n');
  assert.equal(fs.readFileSync(path.join(destination, 'todo.md'), 'utf8'), '- [ ] pending follow-up\n');
  assert.equal(fs.existsSync(path.join(root, 'SPEC.md')), false);
  assert.equal(git(root, ['log', '-1', '--pretty=%s']).stdout.trim(), 'docs: archive integracion-dingus documentation');
  const retry = run(root, ['close']);
  assert.equal(retry.status, 0, retry.stdout + retry.stderr);
  assert.match(retry.stdout, /Documents already archived/);
});

test('leaves documents recoverable when the archival commit fails', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'bugfix', 'error-reservas', '--from', 'main']).status, 0);
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# Bugfix\n');
  const hook = path.join(root, '.git', 'hooks', 'pre-commit');
  fs.writeFileSync(hook, '#!/bin/sh\nexit 1\n');
  fs.chmodSync(hook, 0o755);
  const close = run(root, ['close']);
  assert.equal(close.status, 1, close.stdout + close.stderr);
  assert.match(close.stderr, /partial preparation|commit/);
  assert.equal(fs.existsSync(path.join(root, 'SPEC.md')), true, close.stdout + close.stderr);
  assert.equal(fs.existsSync(path.join(root, 'docs', 'work-items', 'bugfixes', 'error-reservas', 'SPEC.md')), false);
  assert.equal(git(root, ['diff', '--cached', '--name-only']).stdout, '');
});

test('installed commands execute the Skill script from the installed Skill location', () => {
  const root = repo();
  const result = install(root, ['--project', '--host', 'claude', '--profile', 'decameron']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const command = fs.readFileSync(path.join(root, '.claude', 'commands', 'work.md'), 'utf8');
  assert.match(command, /\.claude[\\/]skills[\\/]work-lifecycle[\\/]scripts[\\/]work\.js/);
  assert.doesNotMatch(command, /node skills[\\/]work-lifecycle[\\/]scripts[\\/]work\.js/);
  assert.match(command, /--existing/);
  const installedScript = path.join(root, '.claude', 'skills', 'work-lifecycle', 'scripts', 'work.js');
  const executed = spawnSync(process.execPath, [installedScript, 'start', 'feature', 'portable', '--from', 'main'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(executed.status, 0, executed.stdout + executed.stderr);
});

test('installed Work Lifecycle scripts run from project and global locations for every host', () => {
  const hosts = JSON.parse(fs.readFileSync(path.join(ROOT, 'registry', 'hosts.json'), 'utf8')).hosts;
  for (const host of hosts) {
    const adapter = JSON.parse(fs.readFileSync(path.join(ROOT, host.adapterPath, 'adapter.json'), 'utf8'));
    const root = repo();
    const projectInstall = install(root, ['--project', '--host', host.id, '--profile', 'decameron']);
    assert.equal(projectInstall.status, 0, `${host.id}: ${projectInstall.stdout}${projectInstall.stderr}`);
    const projectIntegrity = spawnSync(process.execPath, [INTEGRITY, '--root', root, '--host', host.id, '--profile', 'decameron', '--scope', 'project'], { cwd: root, encoding: 'utf8' });
    assert.equal(projectIntegrity.status, 0, `${host.id}: ${projectIntegrity.stdout}${projectIntegrity.stderr}`);
    const projectSkill = path.join(root, adapter.installDestinations.project.skills, 'work-lifecycle', 'scripts', 'work.js');
    assert.equal(fs.existsSync(projectSkill), true, `${host.id} project Skill`);
    const projectRun = spawnSync(process.execPath, [projectSkill, 'start', 'feature', `project-${host.id}`, '--from', 'main'], { cwd: root, encoding: 'utf8' });
    assert.equal(projectRun.status, 0, `${host.id}: ${projectRun.stdout}${projectRun.stderr}`);
    if (adapter.commandRepresentation) {
      const filename = adapter.commandRepresentation.filenameMap?.work || 'work';
      const command = path.join(root, adapter.installDestinations.project.commands, `${filename}${adapter.commandRepresentation.extension}`);
      assert.equal(fs.existsSync(command), true, `${host.id} project Command`);
      assert.match(fs.readFileSync(command, 'utf8'), /work-lifecycle[\\/]scripts[\\/]work\.js/);
      assert.match(fs.readFileSync(command, 'utf8'), /--existing/);
    } else {
      assert.equal(fs.existsSync(path.join(root, '.codex', 'commands')), false, 'Codex must not receive command files');
    }

    const home = fs.mkdtempSync(path.join(os.tmpdir(), `work-lifecycle-${host.id}-home-`));
    repos.push(home);
    const globalInstall = install(root, ['--global', '--host', host.id, '--profile', 'decameron'], { HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: path.join(home, '.config') });
    assert.equal(globalInstall.status, 0, `${host.id}: ${globalInstall.stdout}${globalInstall.stderr}`);
    const globalIntegrity = spawnSync(process.execPath, [INTEGRITY, '--root', home, '--host', host.id, '--profile', 'decameron', '--scope', 'global'], { cwd: root, encoding: 'utf8' });
    assert.equal(globalIntegrity.status, 0, `${host.id}: ${globalIntegrity.stdout}${globalIntegrity.stderr}`);
    const globalSkill = path.join(home, adapter.installDestinations.global.skills, 'work-lifecycle', 'scripts', 'work.js');
    assert.equal(fs.existsSync(globalSkill), true, `${host.id} global Skill`);
    const globalRun = spawnSync(process.execPath, [globalSkill, 'switch'], { cwd: root, encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: path.join(home, '.config') } });
    assert.equal(globalRun.status, 0, `${host.id}: ${globalRun.stdout}${globalRun.stderr}`);
  }
});

test('close never commits a file injected by a pre-commit hook', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'hook-safe', '--from', 'main']).status, 0);
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# Hook-safe\n');
  fs.writeFileSync(path.join(root, 'injected.php'), '<?php echo "unrelated";\n');
  const hook = path.join(root, '.git', 'hooks', 'pre-commit');
  fs.writeFileSync(hook, '#!/bin/sh\ngit add injected.php\n');
  fs.chmodSync(hook, 0o755);
  const close = run(root, ['close', '--allow-incomplete']);
  assert.equal(close.status, 1, close.stdout + close.stderr);
  const committed = git(root, ['show', '--format=', '--name-only', 'HEAD']).stdout;
  assert.doesNotMatch(committed, /injected\.php/);
  assert.equal(fs.existsSync(path.join(root, 'injected.php')), true);
  assert.equal(fs.existsSync(path.join(root, 'SPEC.md')), true);
});

test('close rejects a hook that mutates an archived document', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'hook-mutates', '--from', 'main']).status, 0);
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# Original\n');
  const hook = path.join(root, '.git', 'hooks', 'pre-commit');
  fs.writeFileSync(hook, '#!/bin/sh\nprintf "# Mutated\\n" > docs/work-items/features/hook-mutates/SPEC.md\n');
  fs.chmodSync(hook, 0o755);
  const close = run(root, ['close']);
  assert.equal(close.status, 1, close.stdout + close.stderr);
  assert.match(close.stderr, /document changed during close|restored|original snapshots preserved/);
  const archived = path.join(root, 'docs', 'work-items', 'features', 'hook-mutates', 'SPEC.md');
  assert.equal(fs.readFileSync(archived, 'utf8'), '# Mutated\n');
  assert.match(close.stderr, /original snapshots preserved/);
  assert.equal(git(root, ['log', '-1', '--pretty=%s']).stdout.trim(), 'test: initialize repository');
});

test('close rejects a hook that replaces only the prepared document blob', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'blob-mutation', '--from', 'main']).status, 0);
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# ORIGINAL CONFIDENTIAL SPEC\n');
  const hook = path.join(root, '.git', 'hooks', 'pre-commit');
  fs.writeFileSync(hook, '#!/bin/sh\nblob=$(printf "# MODIFIED BY HOOK\\n" | git hash-object -w --stdin)\ngit update-index --add --cacheinfo "100644,$blob,docs/work-items/features/blob-mutation/SPEC.md"\n');
  fs.chmodSync(hook, 0o755);
  const close = run(root, ['close']);
  assert.equal(close.status, 1);
  assert.equal(fs.readFileSync(path.join(root, 'SPEC.md'), 'utf8'), '# ORIGINAL CONFIDENTIAL SPEC\n');
  assert.equal(git(root, ['log', '-1', '--pretty=%s']).stdout.trim(), 'test: initialize repository');
});

test('close rejects a hook that removes a document from the prepared index', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'removed-blob', '--from', 'main']).status, 0);
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# ORIGINAL\n');
  const hook = path.join(root, '.git', 'hooks', 'pre-commit');
  fs.writeFileSync(hook, '#!/bin/sh\ngit update-index --force-remove docs/work-items/features/removed-blob/SPEC.md\n');
  fs.chmodSync(hook, 0o755);
  const close = run(root, ['close']);
  assert.equal(close.status, 1);
  assert.equal(fs.readFileSync(path.join(root, 'SPEC.md'), 'utf8'), '# ORIGINAL\n');
});

test('close rejects an equal-size replacement blob', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'same-size', '--from', 'main']).status, 0);
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# ORIGINAL\n');
  const hook = path.join(root, '.git', 'hooks', 'pre-commit');
  fs.writeFileSync(hook, '#!/bin/sh\nblob=$(printf "# MODIFIED\\n" | git hash-object -w --stdin)\ngit update-index --add --cacheinfo "100644,$blob,docs/work-items/features/same-size/SPEC.md"\n');
  fs.chmodSync(hook, 0o755);
  const close = run(root, ['close']);
  assert.equal(close.status, 1);
  assert.equal(git(root, ['log', '-1', '--pretty=%s']).stdout.trim(), 'test: initialize repository');
});

test('rollback preserves a new source document recreated by a failing hook', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'recreated-source', '--from', 'main']).status, 0);
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# ORIGINAL\n');
  const hook = path.join(root, '.git', 'hooks', 'pre-commit');
  fs.writeFileSync(hook, '#!/bin/sh\nprintf "# CREATED BY HOOK\\n" > SPEC.md\nexit 1\n');
  fs.chmodSync(hook, 0o755);
  const close = run(root, ['close']);
  assert.equal(close.status, 1);
  assert.equal(fs.readFileSync(path.join(root, 'SPEC.md'), 'utf8'), '# CREATED BY HOOK\n');
  const archived = path.join(root, 'docs', 'work-items', 'features', 'recreated-source', 'SPEC.md');
  assert.equal(fs.existsSync(archived), true);
  assert.equal(fs.readFileSync(archived, 'utf8'), '# ORIGINAL\n');
  const recoveryMatch = close.stderr.match(/original snapshots preserved at (.+)/);
  assert.ok(recoveryMatch);
  assert.equal(fs.existsSync(path.join(recoveryMatch[1].trim(), 'manifest.json')), true);
  const retry = run(root, ['close']);
  assert.equal(retry.status, 1);
  assert.equal(fs.readFileSync(path.join(root, 'SPEC.md'), 'utf8'), '# CREATED BY HOOK\n');
  assert.equal(fs.readFileSync(archived, 'utf8'), '# ORIGINAL\n');
});

test('a durable recovery snapshot supplies the original bytes on a later retry', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'durable-retry', '--from', 'main']).status, 0);
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# DURABLE ORIGINAL\n');
  const hook = path.join(root, '.git', 'hooks', 'pre-commit');
  fs.writeFileSync(hook, '#!/bin/sh\nprintf "# RECREATED\\n" > SPEC.md\nexit 1\n');
  fs.chmodSync(hook, 0o755);
  const failed = run(root, ['close']);
  assert.equal(failed.status, 1);
  const recoveryMatch = failed.stderr.match(/original snapshots preserved at (.+)/);
  assert.ok(recoveryMatch);
  fs.unlinkSync(path.join(root, 'SPEC.md'));
  fs.unlinkSync(hook);
  const retry = run(root, ['close']);
  assert.equal(retry.status, 0, retry.stdout + retry.stderr);
  const archived = path.join(root, 'docs', 'work-items', 'features', 'durable-retry', 'SPEC.md');
  assert.equal(fs.readFileSync(archived, 'utf8'), '# DURABLE ORIGINAL\n');
  assert.equal(fs.existsSync(recoveryMatch[1].trim()), false);
});

test('preserves the durable snapshot when a moved destination disappears', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'missing-destination', '--from', 'main']).status, 0);
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# Durable source\n');
  const hook = path.join(root, '.git', 'hooks', 'pre-commit');
  fs.writeFileSync(hook, '#!/bin/sh\nrm docs/work-items/features/missing-destination/SPEC.md\nexit 1\n');
  fs.chmodSync(hook, 0o755);
  const close = run(root, ['close']);
  assert.equal(close.status, 1);
  assert.match(close.stderr, /original snapshots preserved/);
  assert.equal(fs.existsSync(path.join(root, 'SPEC.md')), false);
  const snapshot = close.stderr.match(/original snapshots preserved at ([^;\n]+)/)[1].trim();
  assert.equal(fs.existsSync(path.join(snapshot, 'manifest.json')), true, close.stderr);
});

test('recovers from a durable snapshot when both source and destination are absent', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'orphaned-recovery', '--from', 'main']).status, 0);
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# Durable orphan\n');
  const hook = path.join(root, '.git', 'hooks', 'pre-commit');
  fs.writeFileSync(hook, '#!/bin/sh\nrm docs/work-items/features/orphaned-recovery/SPEC.md\nexit 1\n');
  fs.chmodSync(hook, 0o755);
  const failed = run(root, ['close']);
  assert.equal(failed.status, 1);
  const snapshot = failed.stderr.match(/original snapshots preserved at (.+)/)[1].trim();
  assert.match(fs.readFileSync(path.join(snapshot, 'manifest.json'), 'utf8'), /orphaned-recovery/);
  fs.unlinkSync(hook);
  const retry = run(root, ['close']);
  assert.equal(retry.status, 0, retry.stdout + retry.stderr);
  assert.equal(fs.readFileSync(path.join(root, 'docs/work-items/features/orphaned-recovery/SPEC.md'), 'utf8'), '# Durable orphan\n');
  assert.equal(fs.existsSync(snapshot), false);
});

test('rejects a close when a hook advances HEAD before commit creation', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'head-race', '--from', 'main']).status, 0);
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# HEAD race\n');
  const hook = path.join(root, '.git', 'hooks', 'pre-commit');
  fs.writeFileSync(hook, '#!/bin/sh\nmv .git/hooks/pre-commit .git/hooks/pre-commit.disabled\ngit commit --allow-empty -m "hook advanced HEAD"\nmv .git/hooks/pre-commit.disabled .git/hooks/pre-commit\n');
  fs.chmodSync(hook, 0o755);
  const close = run(root, ['close']);
  assert.equal(close.status, 1);
  assert.match(close.stderr, /HEAD changed/);
  assert.equal(git(root, ['log', '-1', '--pretty=%s']).stdout.trim(), 'hook advanced HEAD');
});

test('rejects a hook that changes the symbolic HEAD ref', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'head-ref-race', '--from', 'main']).status, 0);
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# HEAD ref race\n');
  const hook = path.join(root, '.git', 'hooks', 'pre-commit');
  fs.writeFileSync(hook, '#!/bin/sh\ngit symbolic-ref HEAD refs/heads/main\n');
  fs.chmodSync(hook, 0o755);
  const close = run(root, ['close']);
  assert.equal(close.status, 1);
  assert.match(close.stderr, /HEAD ref changed/);
  assert.equal(git(root, ['symbolic-ref', '--short', 'HEAD']).stdout.trim(), 'main');
});

test('rejects an unconfirmed destination when the source is absent', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'unconfirmed-destination', '--from', 'main']).status, 0);
  const destination = path.join(root, 'docs', 'work-items', 'features', 'unconfirmed-destination');
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, 'SPEC.md'), '# Untrusted\n');
  const close = run(root, ['close']);
  assert.equal(close.status, 1);
  assert.match(close.stderr, /source is absent|recovery snapshot/);
});

test('rejects hooks that mutate the developer index directly', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'real-index', '--from', 'main']).status, 0);
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# Real index\n');
  fs.writeFileSync(path.join(root, 'index-mutation.txt'), 'keep out\n');
  const hook = path.join(root, '.git', 'hooks', 'pre-commit');
  fs.writeFileSync(hook, '#!/bin/sh\nunset GIT_INDEX_FILE\ngit add index-mutation.txt\n');
  fs.chmodSync(hook, 0o755);
  const close = run(root, ['close']);
  assert.equal(close.status, 1);
  assert.match(close.stderr, /developer index changed/);
  assert.equal(git(root, ['diff', '--cached', '--name-only']).stdout.trim(), 'index-mutation.txt');
});

test('rejects broken symlinks in document paths', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'broken-link', '--from', 'main']).status, 0);
  fs.symlinkSync('missing-target', path.join(root, 'SPEC.md'));
  const close = run(root, ['close']);
  assert.equal(close.status, 1);
  assert.match(close.stderr, /symlink/);
});

test('prepare-commit-msg executes once per close attempt', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'single-prepare', '--from', 'main']).status, 0);
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# Single prepare\n');
  const hook = path.join(root, '.git', 'hooks', 'prepare-commit-msg');
  fs.writeFileSync(hook, '#!/bin/sh\nprintf x >> hook-count\n');
  fs.chmodSync(hook, 0o755);
  const close = run(root, ['close']);
  assert.equal(close.status, 0, close.stdout + close.stderr);
  assert.equal(fs.readFileSync(path.join(root, 'hook-count'), 'utf8'), 'x');
});

test('each supported commit hook executes once under the close policy', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'hook-counts', '--from', 'main']).status, 0);
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# Hook counts\n');
  const hooks = {
    'pre-commit': 'pre',
    'prepare-commit-msg': 'prepare',
    'commit-msg': 'commit',
    'post-commit': 'post',
  };
  for (const [hook, label] of Object.entries(hooks)) {
    const file = path.join(root, '.git', 'hooks', hook);
    fs.writeFileSync(file, `#!/bin/sh\nprintf ${label} >> hook-counts\n`);
    fs.chmodSync(file, 0o755);
  }
  const close = run(root, ['close']);
  assert.equal(close.status, 0, close.stdout + close.stderr);
  assert.equal(fs.readFileSync(path.join(root, 'hook-counts'), 'utf8'), 'prepreparecommitpost');
});

test('commit hooks resolve through core.hooksPath', () => {
  const root = repo();
  const hooks = path.join(root, '.githooks');
  fs.mkdirSync(hooks);
  git(root, ['config', 'core.hooksPath', '.githooks']);
  assert.equal(run(root, ['start', 'feature', 'custom-hooks', '--from', 'main']).status, 0);
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# Custom hooks\n');
  const hook = path.join(hooks, 'prepare-commit-msg');
  fs.writeFileSync(hook, '#!/bin/sh\nprintf x >> custom-hook-count\n');
  fs.chmodSync(hook, 0o755);
  assert.equal(run(root, ['close']).status, 0);
  assert.equal(fs.readFileSync(path.join(root, 'custom-hook-count'), 'utf8'), 'x');
});

test('close blocks when the repository requires commit signing unsupported by the deterministic path', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'signed-close', '--from', 'main']).status, 0);
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# Signed close\n');
  git(root, ['config', 'commit.gpgSign', 'true']);
  const close = run(root, ['close']);
  assert.equal(close.status, 1);
  assert.match(close.stderr, /commit signing/);
  assert.equal(fs.existsSync(path.join(root, 'SPEC.md')), true);
  assert.equal(git(root, ['log', '-1', '--pretty=%s']).stdout.trim(), 'test: initialize repository');
});

test('close restores committed document content after a post-commit hook mutation', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'post-hook', '--from', 'main']).status, 0);
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# Original post-hook\n');
  const hook = path.join(root, '.git', 'hooks', 'post-commit');
  fs.writeFileSync(hook, '#!/bin/sh\nprintf "# Mutated after commit\\n" > docs/work-items/features/post-hook/SPEC.md\n');
  fs.chmodSync(hook, 0o755);
  const close = run(root, ['close']);
  assert.equal(close.status, 1);
  assert.match(close.stderr, /post-commit verification failed|conflict/);
  const archived = path.join(root, 'docs', 'work-items', 'features', 'post-hook', 'SPEC.md');
  assert.equal(fs.existsSync(archived), true, close.stdout + close.stderr);
  assert.equal(fs.readFileSync(archived, 'utf8'), '# Mutated after commit\n');
  assert.equal(git(root, ['log', '-1', '--pretty=%s']).stdout.trim(), 'docs: archive post-hook documentation');
});

test('preserves recovery data when a post-commit hook changes HEAD ownership', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'post-head-ref', '--from', 'main']).status, 0);
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# Post HEAD ref\n');
  const hook = path.join(root, '.git', 'hooks', 'post-commit');
  fs.writeFileSync(hook, '#!/bin/sh\ngit symbolic-ref HEAD refs/heads/main\n');
  fs.chmodSync(hook, 0o755);
  const close = run(root, ['close']);
  assert.equal(close.status, 1);
  assert.match(close.stderr, /HEAD ownership changed|manual recovery/);
  const snapshot = close.stderr.match(/original snapshots preserved at ([^;\n]+)/)[1].trim();
  assert.equal(fs.existsSync(path.join(snapshot, 'manifest.json')), true, close.stderr);
});

test('preserves recovery data when a post-commit hook detaches HEAD', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'post-detached-head', '--from', 'main']).status, 0);
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# Detached HEAD\n');
  const hook = path.join(root, '.git', 'hooks', 'post-commit');
  fs.writeFileSync(hook, '#!/bin/sh\ngit checkout --detach HEAD\n');
  fs.chmodSync(hook, 0o755);
  const close = run(root, ['close']);
  assert.equal(close.status, 1);
  assert.match(close.stderr, /HEAD ownership changed|manual recovery/);
  const snapshot = close.stderr.match(/original snapshots preserved at ([^;\n]+)/)[1].trim();
  assert.equal(fs.existsSync(path.join(snapshot, 'manifest.json')), true, close.stderr);
});

test('close preserves unrelated files already staged in the developer index', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'preserve-index', '--from', 'main']).status, 0);
  fs.writeFileSync(path.join(root, 'local-change.txt'), 'keep staged\n');
  git(root, ['add', 'local-change.txt']);
  const indexPath = path.resolve(root, git(root, ['rev-parse', '--git-path', 'index']).stdout.trim());
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# Preserve index\n');
  const close = run(root, ['close']);
  assert.equal(close.status, 0, close.stdout + close.stderr);
  assert.equal(git(root, ['diff', '--cached', '--name-only', '--', 'local-change.txt']).stdout.trim(), 'local-change.txt');
  assert.doesNotMatch(git(root, ['show', '--format=', '--name-only', 'HEAD']).stdout, /local-change\.txt/);
  assert.doesNotMatch(git(root, ['status', '--porcelain']).stdout, /docs\/work-items\/features\/preserve-index\/SPEC\.md/);
});

test('reconciles the index base while preserving staged and unstaged unrelated changes', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'index-reconcile', '--from', 'main']).status, 0);
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# Reconcile\n');
  fs.writeFileSync(path.join(root, 'staged.txt'), 'staged bytes\n');
  fs.writeFileSync(path.join(root, 'staged-exec.sh'), '#!/bin/sh\n');
  fs.chmodSync(path.join(root, 'staged-exec.sh'), 0o755);
  fs.writeFileSync(path.join(root, 'unstaged.txt'), 'before\n');
  git(root, ['add', 'staged.txt', 'staged-exec.sh']);
  fs.writeFileSync(path.join(root, 'unstaged.txt'), 'after\n');
  const close = run(root, ['close']);
  assert.equal(close.status, 0, close.stdout + close.stderr);
  assert.equal(git(root, ['diff', '--cached', '--name-only']).stdout.trim(), 'staged-exec.sh\nstaged.txt');
  assert.equal(fs.readFileSync(path.join(root, 'staged.txt'), 'utf8'), 'staged bytes\n');
  assert.equal(fs.readFileSync(path.join(root, 'unstaged.txt'), 'utf8'), 'after\n');
  assert.match(git(root, ['ls-files', '--stage', '--', 'staged-exec.sh']).stdout, /^100755 /);
  const status = git(root, ['status', '--porcelain']).stdout;
  assert.doesNotMatch(status, /docs\/work-items\/features\/index-reconcile\/SPEC\.md/);
  assert.doesNotMatch(status, /\?\? docs\//);
  assert.equal(git(root, ['show', '--format=', '--name-only', 'HEAD']).stdout.trim(), 'docs/work-items/features/index-reconcile/SPEC.md');
});

test('preserves staged deletions for Git paths with arbitrary bytes', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'special-index-paths', '--from', 'main']).status, 0);
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# Special paths\n');
  const names = ['café.txt', 'ñandú.txt', 'tab\tname.txt', 'line\nname.txt', 'quote"\\name.txt'];
  for (const name of names) fs.writeFileSync(path.join(root, name), `content:${name}`);
  git(root, ['add', '--', ...names]);
  git(root, ['commit', '-m', 'test: add special paths']);
  git(root, ['rm', '--', ...names]);
  const before = gitNulPaths(root, ['diff', '--cached', '--name-only']);
  assert.deepEqual([...before].sort(), [...names].sort());
  const close = run(root, ['close']);
  assert.equal(close.status, 0, close.stdout + close.stderr);
  const after = gitNulPaths(root, ['diff', '--cached', '--name-only']);
  assert.deepEqual([...after].sort(), [...names].sort());
  assert.equal(git(root, ['diff', '--name-only']).stdout, '');
});

test('preserves mixed staged additions, modifications, modes, and renames with special paths', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'mixed-special-index', '--from', 'main']).status, 0);
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# Mixed special paths\n');
  const modified = 'modifié.txt';
  const renameSource = 'rename\told.txt';
  const renameTarget = 'renamed\nnew.txt';
  fs.writeFileSync(path.join(root, modified), 'before\n');
  fs.writeFileSync(path.join(root, renameSource), 'rename bytes\n');
  git(root, ['add', '--', modified, renameSource]);
  git(root, ['commit', '-m', 'test: add mixed special paths']);
  fs.writeFileSync(path.join(root, modified), 'after\n');
  git(root, ['mv', '--', renameSource, renameTarget]);
  fs.writeFileSync(path.join(root, 'new\tfile.txt'), 'new staged\n');
  git(root, ['add', '--', modified, 'new\tfile.txt']);
  const close = run(root, ['close']);
  assert.equal(close.status, 0, close.stdout + close.stderr);
  const staged = new Set(gitNulPaths(root, ['diff', '--cached', '--name-only']));
  assert.deepEqual([...staged].sort(), [modified, renameTarget, 'new\tfile.txt'].sort());
  assert.match(git(root, ['diff', '--cached', '--name-status']).stdout, /(?:^|\n)R/);
  assert.equal(fs.readFileSync(path.join(root, modified), 'utf8'), 'after\n');
  assert.equal(fs.readFileSync(path.join(root, renameTarget), 'utf8'), 'rename bytes\n');
});

test('preserves a post-commit document conflict and its recovery snapshot', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'post-conflict', '--from', 'main']).status, 0);
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# Original post conflict\n');
  const hook = path.join(root, '.git', 'hooks', 'post-commit');
  fs.writeFileSync(hook, '#!/bin/sh\nprintf "# CRITICAL NEW DATA\\n" > docs/work-items/features/post-conflict/SPEC.md\n');
  fs.chmodSync(hook, 0o755);
  const close = run(root, ['close']);
  assert.equal(close.status, 1);
  assert.equal(fs.readFileSync(path.join(root, 'docs/work-items/features/post-conflict/SPEC.md'), 'utf8'), '# CRITICAL NEW DATA\n');
  assert.match(close.stderr, /snapshot|conflict|intervention/);
  const snapshot = close.stderr.match(/original snapshots preserved at ([^;\n]+)/)?.[1]?.trim();
  assert.ok(snapshot);
  assert.equal(fs.existsSync(path.join(snapshot, 'manifest.json')), true);
});

test('preserves a foreign index lock after the commit and repairs on retry', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'index-lock-recovery', '--from', 'main']).status, 0);
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# Index lock recovery\n');
  fs.writeFileSync(path.join(root, 'staged.txt'), 'staged\n');
  git(root, ['add', 'staged.txt']);
  const hook = path.join(root, '.git', 'hooks', 'post-commit');
  fs.writeFileSync(hook, '#!/bin/sh\nunset GIT_INDEX_FILE\ntouch .git/index.lock\n');
  fs.chmodSync(hook, 0o755);
  const failed = run(root, ['close']);
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /index was not reconciled|preserved/);
  assert.equal(git(root, ['log', '-1', '--pretty=%s']).stdout.trim(), 'docs: archive index-lock-recovery documentation');
  assert.equal(fs.existsSync(path.join(root, '.git', 'index.lock')), true);
  const snapshot = failed.stderr.match(/original snapshots preserved at ([^;\n]+)/)[1].trim();
  assert.equal(fs.existsSync(path.join(snapshot, 'reconciled-index')), true);
  fs.unlinkSync(path.join(root, '.git', 'index.lock'));
  fs.unlinkSync(hook);
  const retry = run(root, ['close']);
  assert.equal(retry.status, 0, retry.stdout + retry.stderr);
  assert.equal(git(root, ['diff', '--cached', '--name-only']).stdout.trim(), 'staged.txt');
  assert.equal(fs.existsSync(snapshot), false);
});

test('preserves the recovery snapshot when post-commit deletes the archive', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'post-delete', '--from', 'main']).status, 0);
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# Delete me\n');
  const hook = path.join(root, '.git', 'hooks', 'post-commit');
  fs.writeFileSync(hook, '#!/bin/sh\nrm docs/work-items/features/post-delete/SPEC.md\n');
  fs.chmodSync(hook, 0o755);
  const close = run(root, ['close']);
  assert.equal(close.status, 1);
  assert.equal(fs.existsSync(path.join(root, 'docs/work-items/features/post-delete/SPEC.md')), false);
  assert.match(close.stderr, /snapshot|missing|conflict/);
  const snapshot = close.stderr.match(/original snapshots preserved at ([^;\n]+)/)[1].trim();
  assert.equal(fs.existsSync(path.join(snapshot, 'manifest.json')), true);
});

test('does not write through a post-commit symlink replacement', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'post-symlink', '--from', 'main']).status, 0);
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# Symlink original\n');
  fs.writeFileSync(path.join(root, 'outside.txt'), '# Outside\n');
  const hook = path.join(root, '.git', 'hooks', 'post-commit');
  fs.writeFileSync(hook, '#!/bin/sh\nrm docs/work-items/features/post-symlink/SPEC.md\nln -s ../../../../../outside.txt docs/work-items/features/post-symlink/SPEC.md\n');
  fs.chmodSync(hook, 0o755);
  const close = run(root, ['close']);
  assert.equal(close.status, 1);
  assert.equal(fs.readFileSync(path.join(root, 'outside.txt'), 'utf8'), '# Outside\n');
  assert.equal(fs.lstatSync(path.join(root, 'docs/work-items/features/post-symlink/SPEC.md')).isSymbolicLink(), true);
  assert.match(close.stderr, /symlink|snapshot|conflict/);
});

test('close archives tracked work documents without altering earlier commits', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'tracked-docs', '--from', 'main']).status, 0);
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# Tracked\n');
  git(root, ['add', 'SPEC.md']);
  git(root, ['commit', '-m', 'docs: add tracked work spec']);
  const before = git(root, ['rev-parse', 'HEAD']);
  const close = run(root, ['close']);
  assert.equal(close.status, 0, close.stdout + close.stderr);
  assert.equal(git(root, ['rev-parse', 'HEAD~1']).stdout, before.stdout);
  assert.equal(fs.readFileSync(path.join(root, 'docs', 'work-items', 'features', 'tracked-docs', 'SPEC.md'), 'utf8'), '# Tracked\n');
  assert.match(git(root, ['show', '--format=', '--name-status', 'HEAD']).stdout, /R100.*SPEC\.md/);
});

test('a failed close can be retried after the commit failure is removed', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'bugfix', 'retryable', '--from', 'main']).status, 0);
  const content = '# Retryable\n';
  fs.writeFileSync(path.join(root, 'SPEC.md'), content);
  const hook = path.join(root, '.git', 'hooks', 'pre-commit');
  fs.writeFileSync(hook, '#!/bin/sh\nexit 1\n');
  fs.chmodSync(hook, 0o755);
  assert.equal(run(root, ['close']).status, 1);
  fs.unlinkSync(hook);
  const retry = run(root, ['close']);
  assert.equal(retry.status, 0, retry.stdout + retry.stderr);
  assert.equal(fs.readFileSync(path.join(root, 'docs', 'work-items', 'bugfixes', 'retryable', 'SPEC.md'), 'utf8'), content);
  assert.equal(git(root, ['log', '-1', '--pretty=%s']).stdout.trim(), 'docs: archive retryable documentation');
});

test('starts a hotfix in an automatic Worktree while the feature tree is dirty', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'integracion-dingus', '--from', 'main']).status, 0);
  fs.mkdirSync(path.join(root, 'tasks'));
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# Feature\n');
  fs.writeFileSync(path.join(root, 'tasks', 'plan.md'), '# Plan\n');
  fs.writeFileSync(path.join(root, 'tasks', 'todo.md'), '- [ ] pending\n');
  git(root, ['add', 'SPEC.md', 'tasks']);
  git(root, ['commit', '-m', 'docs: record feature work']);
  fs.writeFileSync(path.join(root, 'feature-local.txt'), 'keep me\n');
  const result = run(root, ['start', 'hotfix', 'error-pagos', '--from', 'main']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const target = path.resolve(root, '..', `${path.basename(root)}-hotfix-error-pagos`);
  assert.equal(fs.existsSync(target), true);
  assert.equal(git(root, ['branch', '--show-current']).stdout.trim(), 'feature/integracion-dingus');
  assert.equal(fs.readFileSync(path.join(root, 'feature-local.txt'), 'utf8'), 'keep me\n');
  assert.equal(git(target, ['branch', '--show-current']).stdout.trim(), 'hotfix/error-pagos');
  const switched = run(root, ['switch', 'feature/integracion-dingus']);
  assert.equal(switched.status, 0, switched.stdout + switched.stderr);
  assert.match(switched.stdout, /feature-local\.txt/);
  assert.equal(fs.readFileSync(path.join(root, 'SPEC.md'), 'utf8'), '# Feature\n');
});

test('blocks close with pending checklist items unless explicitly allowed', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'pending-checks', '--from', 'main']).status, 0);
  fs.mkdirSync(path.join(root, 'tasks'));
  fs.writeFileSync(path.join(root, 'SPEC.md'), '# Pending\n');
  fs.writeFileSync(path.join(root, 'tasks', 'todo.md'), '- [ ] still pending\n');
  const blocked = run(root, ['close']);
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /pending task/i);
  assert.equal(fs.existsSync(path.join(root, 'SPEC.md')), true);
  const allowed = run(root, ['close', '--allow-incomplete']);
  assert.equal(allowed.status, 0, allowed.stdout + allowed.stderr);
});

test('uses distinct Worktree paths for feature and hotfix names that collide', () => {
  const root = repo();
  assert.equal(run(root, ['start', 'feature', 'reservas', '--from', 'main', '--worktree']).status, 0);
  assert.equal(run(root, ['start', 'hotfix', 'reservas', '--from', 'main', '--worktree']).status, 0);
  const featureTarget = path.resolve(root, '..', `${path.basename(root)}-feature-reservas`);
  const hotfixTarget = path.resolve(root, '..', `${path.basename(root)}-hotfix-reservas`);
  assert.equal(fs.existsSync(featureTarget), true);
  assert.equal(fs.existsSync(hotfixTarget), true);
  assert.equal(git(featureTarget, ['branch', '--show-current']).stdout.trim(), 'feature/reservas');
  assert.equal(git(hotfixTarget, ['branch', '--show-current']).stdout.trim(), 'hotfix/reservas');
});
