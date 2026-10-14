#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const readline = require('node:readline');

const TYPES = new Set(['feature', 'bugfix', 'hotfix', 'refactor', 'chore', 'spike']);
const HISTORY_DIRS = { feature: 'features', bugfix: 'bugfixes', hotfix: 'hotfixes', refactor: 'refactors', chore: 'chores', spike: 'spikes' };
const DOCUMENTS = [
  { source: 'SPEC.md', target: 'SPEC.md' },
  { source: path.join('tasks', 'plan.md'), target: 'plan.md' },
  { source: path.join('tasks', 'todo.md'), target: 'todo.md' },
];

function repoPath(file) {
  return file.split(path.sep).join('/');
}

function fail(message) {
  throw new Error(message);
}

function runGit(args, cwd, allowFailure = false, environment = {}) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...environment },
  });
  if (result.error) fail(`git ${args.join(' ')} failed: ${result.error.message}`);
  if (result.status !== 0 && !allowFailure) {
    fail(`git ${args.join(' ')} failed: ${(result.stderr || result.stdout || '').trim()}`);
  }
  return result;
}

function runGitRaw(args, cwd, allowFailure = false, environment = {}, input) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: null,
    input,
    env: { ...process.env, ...environment },
  });
  if (result.error) fail(`git ${args.join(' ')} failed: ${result.error.message}`);
  if (result.status !== 0 && !allowFailure) {
    fail(`git ${args.join(' ')} failed: ${(result.stderr || result.stdout || Buffer.alloc(0)).toString().trim()}`);
  }
  return result;
}

function gitOutput(args, cwd, environment = {}) {
  return runGit(args, cwd, false, environment).stdout.trim();
}

function gitInputOutput(args, cwd, input, environment = {}) {
  return runGitRaw(args, cwd, false, environment, input).stdout.toString().trim();
}

function gitBlob(root, content) {
  return gitInputOutput(['hash-object', '-w', '--stdin'], root, content);
}

function nulRecords(args, cwd, environment = {}) {
  const output = runGitRaw(args, cwd, false, environment).stdout;
  const records = [];
  let start = 0;
  for (let end = 0; end < output.length; end += 1) {
    if (output[end] === 0) {
      records.push(output.subarray(start, end));
      start = end + 1;
    }
  }
  if (start < output.length) records.push(output.subarray(start));
  return records.filter((record) => record.length > 0);
}

function indexInfoRecord(entry) {
  return Buffer.concat([
    Buffer.from(`${entry.mode} ${entry.object} ${entry.stage}\t`, 'ascii'),
    entry.pathBytes,
    Buffer.from([0]),
  ]);
}

function symbolicHead(root) {
  const result = runGit(['symbolic-ref', '-q', 'HEAD'], root, true);
  return result.status === 0 ? result.stdout.trim() : null;
}

function repoRoot(cwd = process.cwd()) {
  return gitOutput(['rev-parse', '--show-toplevel'], cwd);
}

function currentBranch(root) {
  return gitOutput(['branch', '--show-current'], root);
}

function statusEntries(root) {
  return runGit(['status', '--porcelain=v1', '--untracked-files=all'], root).stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3).split(' -> ').pop());
}

function isClean(root) {
  return statusEntries(root).length === 0;
}

function lstatIfPresent(file) {
  try {
    return fs.lstatSync(file);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function pathExists(file) {
  return lstatIfPresent(file) !== null;
}

function readRegularFile(file) {
  const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0);
  let descriptor;
  try {
    descriptor = fs.openSync(file, flags);
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile()) fail(`refusing to read a non-regular file: ${file}`);
    return { content: fs.readFileSync(descriptor), mode: stat.mode & 0o777, stat };
  } catch (error) {
    if (error.code === 'ELOOP') fail(`refusing to read through symlink: ${file}`);
    throw error;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function worktrees(root) {
  const output = runGitRaw(['worktree', 'list', '--porcelain', '-z'], root).stdout.toString('utf8');
  const entries = [];
  let current = null;
  for (const field of output.split('\0')) {
    if (!field) {
      if (current) entries.push(current);
      current = null;
    } else if (field.startsWith('worktree ')) {
      if (current) entries.push(current);
      current = { path: field.slice('worktree '.length) };
    } else if (current && field.startsWith('branch ')) {
      current.branch = field.slice('branch '.length).replace(/^refs\/heads\//, '');
    } else if (current && field === 'detached') {
      current.branch = null;
    } else if (current && field.startsWith('locked')) {
      current.locked = true;
    } else if (current && field.startsWith('prunable')) {
      current.prunable = true;
    }
  }
  if (current) entries.push(current);
  return entries;
}

function branchExists(root, branch) {
  return runGit(['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], root, true).status === 0;
}

function remoteBranchExists(root, branch) {
  return gitOutput(['for-each-ref', '--format=%(refname:strip=3)', 'refs/remotes'], root)
    .split(/\r?\n/)
    .filter(Boolean)
    .includes(branch);
}

function resolveReference(root, reference, allowFailure = false) {
  if (!reference || reference.startsWith('-') || /\s/.test(reference)) {
    if (allowFailure) return null;
    fail(`unsafe source reference: ${reference || '<missing>'}`);
  }
  const result = runGit(['rev-parse', '--verify', '--end-of-options', `${reference}^{commit}`], root, allowFailure);
  return result.status === 0 ? result.stdout.trim() : null;
}

function inheritedDocuments(root, reference) {
  const tree = gitOutput(['ls-tree', '-r', '--name-only', reference], root).split(/\r?\n/).filter(Boolean);
  return tree.filter((file) => DOCUMENTS.some((document) => file === repoPath(document.source)));
}

function parseStartArgs(args) {
  const [type, name, ...rest] = args;
  if (!TYPES.has(type)) fail(`invalid work type: ${type || '<missing>'}`);
  if (!name || !/^[a-z0-9][a-z0-9-]*$/.test(name)) fail('work name must be lowercase alphanumeric words separated by hyphens');
  let from;
  let worktree = false;
  let existing = false;
  for (let index = 0; index < rest.length; index += 1) {
    if (rest[index] === '--worktree') worktree = true;
    else if (rest[index] === '--from') from = rest[++index];
    else if (rest[index] === '--existing') existing = true;
    else fail(`unknown start option: ${rest[index]}`);
  }
  if (rest.includes('--from') && !from) fail('--from requires a reference');
  if (existing && from) fail('--existing cannot be combined with --from');
  return { type, name, from, worktree, existing, branch: `${type}/${name}` };
}

async function askForReference(root) {
  if (!process.stdin.isTTY) fail('specify --from <reference> when running non-interactively');
  const current = currentBranch(root);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rl.question('Source reference: ', resolve));
  rl.close();
  const reference = answer.trim();
  if (!reference) fail('a source reference is required; no default was selected');
  if (reference === current) return reference;
  return reference;
}

function assertSafeSource(root, reference) {
  const commit = resolveReference(root, reference);
  const inherited = inheritedDocuments(root, commit);
  if (inherited.length) fail(`source reference contains active work documents; resolve them before starting: ${inherited.join(', ')}`);
  return commit;
}

function activeWorkBranches(entries) {
  return entries.filter((entry) => entry.branch && [...TYPES].some((type) => entry.branch.startsWith(`${type}/`)));
}

function defaultWorktreePath(root, type, name) {
  const base = path.basename(root);
  return path.resolve(root, '..', `${base}-${type}-${name}`);
}

async function withStartLock(root, operation) {
  const directory = path.resolve(root, gitOutput(['rev-parse', '--git-path', 'work-lifecycle'], root));
  const directoryStat = lstatIfPresent(directory);
  const directoryExisted = Boolean(directoryStat);
  if (directoryStat && (!directoryStat.isDirectory() || directoryStat.isSymbolicLink())) {
    fail(`refusing to use an unsafe work lifecycle directory: ${directory}`);
  }
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const lockFile = path.join(directory, 'start.lock');
  let descriptor;
  try {
    descriptor = fs.openSync(lockFile, 'wx', 0o600);
  } catch (error) {
    if (error.code === 'EEXIST') fail(`another /work start operation is in progress: ${lockFile}`);
    throw error;
  }
  const lockIdentity = fs.fstatSync(descriptor);
  try {
    return await operation();
  } finally {
    fs.closeSync(descriptor);
    const current = lstatIfPresent(lockFile);
    if (current && current.dev === lockIdentity.dev && current.ino === lockIdentity.ino) fs.rmSync(lockFile, { force: true });
    if (!directoryExisted && lstatIfPresent(directory)?.isDirectory() && fs.readdirSync(directory).length === 0) fs.rmdirSync(directory);
  }
}

async function startWork(args, root) {
  const options = parseStartArgs(args);
  return withStartLock(root, async () => {
    if (options.existing) return reuseExistingWork(options, root);
    const reference = options.from || await askForReference(root);
    const sourceCommit = assertSafeSource(root, reference);
    if (branchExists(root, options.branch)) fail(`branch already exists: ${options.branch}`);

    const entries = worktrees(root);
    const current = currentBranch(root);
    const currentIsWork = [...TYPES].some((type) => current.startsWith(`${type}/`));
    const anotherWork = activeWorkBranches(entries).some((entry) => entry.path !== root);
    const requiresIsolation = options.worktree || currentIsWork || anotherWork || !isClean(root);
    if (requiresIsolation) {
      const target = defaultWorktreePath(root, options.type, options.name);
      if (fs.existsSync(target)) fail(`Worktree destination already exists: ${target}`);
      runGit(['worktree', 'add', '-b', options.branch, target, sourceCommit], root);
      console.log(`Created Worktree: ${target}`);
      console.log(`Branch: ${options.branch}`);
      console.log(`Source: ${reference} (${sourceCommit})`);
      console.log(`Continue in: cd ${target}`);
      return;
    }
    runGit(['switch', '-c', options.branch, sourceCommit], root);
    console.log(`Created branch: ${options.branch}`);
    console.log(`Source: ${reference} (${sourceCommit})`);
    console.log(`Continue in: ${root}`);
  });
}

function reuseExistingWork(options, root) {
  if (!branchExists(root, options.branch)) {
    if (remoteBranchExists(root, options.branch)) {
      fail(`local branch does not exist: ${options.branch}; it only exists remotely, prepare the local branch explicitly before using --existing`);
    }
    fail(`local branch does not exist: ${options.branch}; use --from to create a new branch`);
  }

  const entries = worktrees(root);
  const match = entries.find((entry) => entry.branch === options.branch);
  if (match) {
    if (match.locked || match.prunable || !fs.existsSync(match.path)) {
      fail(`existing Worktree for ${options.branch} is locked, inaccessible, or prunable; resolve it manually`);
    }
    if (path.resolve(match.path) === path.resolve(root)) {
      if (currentBranch(root) !== options.branch) {
        fail(`Worktree metadata for ${options.branch} does not match the current branch; resolve the inconsistent Worktree state manually`);
      }
      console.log(`Work already active in the current Worktree: ${match.path}`);
    } else {
      console.log(`Existing branch is already associated with a Worktree: ${match.path}`);
    }
    console.log(`Branch: ${options.branch}`);
    console.log(`Open it with: cd ${match.path}`);
    return;
  }

  const current = currentBranch(root);
  if (current === options.branch) {
    fail(`branch ${options.branch} is active but Git did not report its Worktree; resolve the inconsistent Worktree state manually`);
  }
  const currentIsWork = [...TYPES].some((type) => current.startsWith(`${type}/`));
  const anotherWork = activeWorkBranches(entries).some((entry) => entry.path !== root);
  const requiresIsolation = options.worktree || currentIsWork || anotherWork || !isClean(root);
  if (requiresIsolation) {
    const target = defaultWorktreePath(root, options.type, options.name);
    if (fs.existsSync(target)) fail(`Worktree destination already exists: ${target}`);
    runGit(['worktree', 'add', target, options.branch], root);
    console.log(`Reused existing branch in Worktree: ${target}`);
    console.log(`Branch: ${options.branch}`);
    console.log(`Continue in: cd ${target}`);
    return;
  }

  runGit(['switch', options.branch], root);
  console.log(`Reused existing branch: ${options.branch}`);
  console.log(`Worktree: ${root}`);
  console.log(`Branch: ${options.branch}`);
}

function switchWork(args, root) {
  if (args.length > 1) fail('switch accepts at most one branch or work name');
  const entries = worktrees(root);
  if (!args[0]) {
    console.log('Available Worktrees:');
    for (const entry of entries) console.log(`- ${entry.branch || '(detached)'}: ${entry.path}`);
    return;
  }
  const query = args[0].replace(/^refs\/heads\//, '');
  const matches = entries.filter((entry) => entry.branch === query || entry.branch?.endsWith(`/${query}`) || path.basename(entry.path) === query);
  if (!matches.length) {
    if (branchExists(root, query)) fail(`branch exists without an associated Worktree: ${query}`);
    fail(`no Worktree matches: ${args[0]}`);
  }
  if (matches.length > 1) fail(`ambiguous Worktree name; choose a full branch: ${matches.map((entry) => entry.branch).join(', ')}`);
  const entry = matches[0];
  const status = runGit(['status', '--short', '--branch'], entry.path).stdout.trim();
  console.log(`Worktree: ${entry.path}`);
  console.log(`Branch: ${entry.branch || '(detached)'}`);
  console.log(`Open it with: cd ${entry.path}`);
  console.log(status || 'Context: clean');
}

function safePath(root, relative) {
  const target = path.resolve(root, relative);
  const relativeTarget = path.relative(root, target);
  if (!relativeTarget || relativeTarget === '..' || relativeTarget.startsWith(`..${path.sep}`) || path.isAbsolute(relativeTarget)) fail(`unsafe document path: ${relative}`);
  let current = root;
  for (const segment of relativeTarget.split(path.sep)) {
    current = path.join(current, segment);
    const stat = lstatIfPresent(current);
    if (stat?.isSymbolicLink()) fail(`refusing to cross symlink: ${current}`);
  }
  return target;
}

function sha256Buffer(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function sha256(file) {
  return sha256Buffer(readRegularFile(file).content);
}

function headSha256(root, relative) {
  const result = spawnSync('git', ['cat-file', 'blob', `HEAD:${repoPath(relative)}`], { cwd: root, encoding: null });
  if (result.status !== 0) return null;
  return crypto.createHash('sha256').update(result.stdout).digest('hex');
}

function parseCloseArgs(args) {
  if (args.length > 1 || (args.length === 1 && args[0] !== '--allow-incomplete')) {
    fail('close accepts only --allow-incomplete');
  }
  return { allowIncomplete: args.includes('--allow-incomplete') };
}

function historicalMoves(root, type, name) {
  const destinationRoot = safePath(root, path.join('docs', 'work-items', HISTORY_DIRS[type], name));
  return DOCUMENTS.map((document) => ({
    source: safePath(root, document.source),
    sourceRelative: repoPath(document.source),
    target: safePath(root, path.join('docs', 'work-items', HISTORY_DIRS[type], name, document.target)),
    targetRelative: repoPath(path.join('docs', 'work-items', HISTORY_DIRS[type], name, document.target)),
  })).filter((move) => pathExists(move.source) || pathExists(move.target));
}

function isTracked(root, relative, environment = {}) {
  return runGit(['ls-files', '--error-unmatch', '--', repoPath(relative)], root, true, environment).status === 0;
}

function existsInHead(root, relative) {
  return runGit(['cat-file', '-e', `HEAD:${repoPath(relative)}`], root, true).status === 0;
}

function checklistPending(file) {
  if (!file || !pathExists(file)) return 0;
  return (fs.readFileSync(file, 'utf8').match(/^\s*[-*+]\s+\[ \]/gm) || []).length;
}

function hookPath(root, name, environment) {
  return path.resolve(root, gitOutput(['rev-parse', '--git-path', 'hooks'], root, environment), name);
}

function runHook(root, name, args, environment) {
  const hook = hookPath(root, name, environment);
  if (!fs.existsSync(hook) || !fs.statSync(hook).isFile()) return;
  runGit(['hook', 'run', name, '--', ...args], root, false, environment);
}

function assertDocumentHashes(moves, hashes) {
  for (const move of moves) if (sha256(move.target) !== hashes.get(move.sourceRelative)) {
    fail(`document changed during close: ${move.targetRelative}`);
  }
}

function assertApprovedTree(root, moves, approvedBlobs, environment, tree = gitOutput(['write-tree'], root, environment)) {
  for (const move of moves) {
    const result = runGit(['rev-parse', '--verify', `${tree}:${repoPath(move.targetRelative)}`], root, true, environment);
    if (result.status !== 0 || result.stdout.trim() !== approvedBlobs.get(move.sourceRelative)) {
      fail(`prepared blob differs from the original document: ${move.targetRelative}`);
    }
    if (runGit(['rev-parse', '--verify', `${tree}:${repoPath(move.sourceRelative)}`], root, true, environment).status === 0) {
      fail(`prepared tree still contains the source document: ${move.sourceRelative}`);
    }
  }
  return tree;
}

function assertApprovedCommit(root, moves, approvedBlobs, commit = 'HEAD') {
  for (const move of moves) {
    const result = runGit(['rev-parse', '--verify', `${commit}:${repoPath(move.targetRelative)}`], root, true);
    if (result.status !== 0 || result.stdout.trim() !== approvedBlobs.get(move.sourceRelative)) {
      fail(`committed blob differs from the original document: ${move.targetRelative}`);
    }
    if (runGit(['rev-parse', '--verify', `${commit}:${repoPath(move.sourceRelative)}`], root, true).status === 0) {
      fail(`commit still contains the source document: ${move.sourceRelative}`);
    }
  }
}

function assertCommittedDocuments(root, moves, commit) {
  for (const move of moves) {
    const result = spawnSync('git', ['cat-file', 'blob', `${commit}:${repoPath(move.targetRelative)}`], { cwd: root, encoding: null });
    if (result.status !== 0) fail(`could not verify committed document: ${move.targetRelative}`);
    safePath(root, move.targetRelative);
    const stat = lstatIfPresent(move.target);
    if (!stat) fail(`archived document is missing after post-commit: ${move.targetRelative}`);
    if (stat.isSymbolicLink() || !stat.isFile()) fail(`archived document is not a regular file after post-commit: ${move.targetRelative}`);
    if (sha256(move.target) !== sha256Buffer(result.stdout)) fail(`archived document conflicts with the committed content: ${move.targetRelative}`);
  }
}

function assertAllowedIndex(root, allowed, environment) {
  const indexTree = gitOutput(['write-tree'], root, environment);
  const staged = gitOutput(['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD', indexTree], root, environment)
    .split(/\r?\n/)
    .filter(Boolean);
  const unexpected = staged.filter((file) => !allowed.has(file));
  if (unexpected.length) fail(`unexpected staged path during close: ${unexpected.join(', ')}`);
  return staged;
}

function indexEntries(root, environment) {
  const entries = [];
  for (const record of nulRecords(['ls-files', '--stage', '-z'], root, environment)) {
    const separator = record.indexOf(0x09);
    const metadata = (separator === -1 ? record : record.subarray(0, separator)).toString('ascii');
    const pathBytes = separator === -1 ? Buffer.alloc(0) : record.subarray(separator + 1);
    const file = pathBytes.toString('utf8');
    const [mode, object, stage] = metadata.split(/\s+/);
    entries.push({ mode, object, stage, file, pathBytes });
  }
  return entries;
}

function assertSupportedIndexState(root, environment) {
  if (runGit(['ls-files', '-u'], root, true, environment).stdout.trim()) {
    fail('close cannot preserve unresolved index conflicts');
  }
  const debug = runGit(['ls-files', '--debug'], root, false, environment).stdout;
  if (/flags:\s+(?!0\s*$)\S+/m.test(debug)) {
    fail('close cannot preserve special index entries such as intent-to-add or skip-worktree');
  }
}

function stagedPaths(root, expectedHead, environment) {
  return new Set(runGit(['diff', '--cached', '--name-only', '-z', expectedHead], root, false, environment).stdout
    .split('\0').filter(Boolean));
}

function reconcileIndex(root, expectedHead, commit, sourceIndex, allowed, environment) {
  const sourceEnvironment = { GIT_INDEX_FILE: sourceIndex };
  assertSupportedIndexState(root, sourceEnvironment);
  const reconciled = path.join(os.tmpdir(), `work-reconciled-index-${process.pid}-${crypto.randomUUID()}`);
  const reconciledEnvironment = { GIT_INDEX_FILE: reconciled };
  try {
    runGit(['read-tree', commit], root, false, reconciledEnvironment);
    const entries = indexEntries(root, sourceEnvironment);
    const entryPaths = new Set(entries.map((entry) => entry.pathBytes.toString('hex')));
    const headPaths = nulRecords(['ls-tree', '-r', '--name-only', '-z', expectedHead], root);
    const removedPaths = headPaths
      .filter((pathBytes) => !allowed.has(pathBytes.toString('utf8')) && !entryPaths.has(pathBytes.toString('hex')))
      .flatMap((pathBytes) => [pathBytes, Buffer.from([0])]);
    if (removedPaths.length) {
      runGitRaw(['update-index', '--force-remove', '-z', '--stdin'], root, false, reconciledEnvironment, Buffer.concat(removedPaths));
    }
    const overlay = entries.filter((entry) => !allowed.has(entry.file))
      .map(indexInfoRecord);
    if (overlay.length) runGitRaw(['update-index', '-z', '--index-info'], root, false, reconciledEnvironment, Buffer.concat(overlay));
    return { file: reconciled, environment: reconciledEnvironment };
  } catch (error) {
    fs.rmSync(reconciled, { force: true });
    throw error;
  }
}

function publishReconciledIndex(root, reconciled, developerIndex, expectedFingerprint) {
  const current = indexFingerprint(developerIndex);
  if (current !== expectedFingerprint) fail('developer index changed after the archival commit; reconciled index was not published');
  const lock = `${developerIndex}.lock`;
  const lockStat = lstatIfPresent(lock);
  if (lockStat) fail(`developer index is locked by another operation: ${lock}`);
  const indexStat = lstatIfPresent(developerIndex);
  if (indexStat?.isSymbolicLink()) fail('refusing to publish the reconciled index through a symlink');
  const descriptor = fs.openSync(lock, 'wx', 0o600);
  const lockIdentity = fs.fstatSync(descriptor);
  let published = false;
  try {
    if (indexFingerprint(developerIndex) !== expectedFingerprint) fail('developer index changed while preparing reconciliation');
    fs.copyFileSync(reconciled, lock);
    fs.chmodSync(lock, indexStat?.mode & 0o777 || 0o600);
    if (indexFingerprint(developerIndex) !== expectedFingerprint) fail('developer index changed while copying the reconciled index');
    fs.renameSync(lock, developerIndex);
    published = true;
  } finally {
    fs.closeSync(descriptor);
    const currentLock = lstatIfPresent(lock);
    if (!published && currentLock && currentLock.dev === lockIdentity.dev && currentLock.ino === lockIdentity.ino) {
      fs.rmSync(lock, { force: true });
    }
  }
}

function preserveReconciledIndex(snapshot, reconciled) {
  const target = path.join(snapshot.directory, 'reconciled-index');
  const temporary = `${target}.tmp-${process.pid}-${crypto.randomUUID()}`;
  fs.copyFileSync(reconciled, temporary);
  fs.chmodSync(temporary, 0o600);
  fs.renameSync(temporary, target);
}

function indexFingerprint(file) {
  if (!lstatIfPresent(file)) return 'missing';
  const snapshot = readRegularFile(file);
  return `${snapshot.stat.dev}:${snapshot.stat.ino}:${snapshot.stat.size}:${snapshot.stat.mtimeMs}:${sha256Buffer(snapshot.content)}`;
}

function assertDeveloperIndexUnchanged(indexFile, fingerprint) {
  if (indexFingerprint(indexFile) !== fingerprint) fail('developer index changed during close');
}

function assertHeadIdentity(root, expectedHead, expectedRef) {
  if (gitOutput(['rev-parse', 'HEAD'], root) !== expectedHead) fail('HEAD changed during close; refusing to create a commit from a stale parent');
  if (symbolicHead(root) !== expectedRef) fail('HEAD ref changed during close; refusing to update another branch');
}

function stageMoves(root, moves, environment) {
  for (const move of moves) {
    if (isTracked(root, move.sourceRelative, environment)) {
      runGit(['update-index', '--remove', '--', repoPath(move.sourceRelative)], root, false, environment);
    }
    const target = readRegularFile(move.target);
    const mode = (target.mode & 0o111) ? '100755' : '100644';
    const object = gitInputOutput(['hash-object', '-w', '--stdin'], root, target.content, environment);
    runGit(['update-index', '--add', '--cacheinfo', `${mode},${object},${repoPath(move.targetRelative)}`], root, false, environment);
  }
}

function createRecoverySnapshot(root, moves, originalDocuments, approvedBlobs, indexState) {
  const operation = `recovery-${process.pid}-${crypto.randomUUID()}`;
  const base = path.resolve(root, gitOutput(['rev-parse', '--git-path', 'work-lifecycle'], root));
  const directory = path.join(base, operation);
  try {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    fs.chmodSync(directory, 0o700);
    fs.writeFileSync(path.join(directory, 'index-before'), indexState.content, { mode: 0o600, flag: 'wx' });
    const manifest = [];
    let index = 0;
    for (const move of moves) {
      const original = originalDocuments.get(move.sourceRelative);
      if (!original) continue;
      const file = `${String(index).padStart(2, '0')}-${path.basename(move.sourceRelative)}`;
      const target = path.join(directory, file);
      fs.writeFileSync(target, original.content, { mode: 0o600, flag: 'wx' });
      manifest.push({ source: move.sourceRelative, target: move.targetRelative, file, sha256: sha256(target), blob: approvedBlobs.get(move.sourceRelative), mode: original.mode });
      index += 1;
    }
    const manifestTemp = path.join(directory, 'manifest.json.tmp');
    fs.writeFileSync(manifestTemp, `${JSON.stringify({ version: 1, files: manifest, indexFingerprint: indexState?.fingerprint || null, parent: indexState?.parent || null }, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    fs.renameSync(manifestTemp, path.join(directory, 'manifest.json'));
    return { directory, manifest };
  } catch (error) {
    fs.rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

function loadRecoverySnapshot(root, moves, workTarget) {
  const base = path.resolve(root, gitOutput(['rev-parse', '--git-path', 'work-lifecycle'], root));
  const baseStat = lstatIfPresent(base);
  if (!baseStat || !baseStat.isDirectory()) return null;
  const expected = moves ? new Set(moves.map((move) => `${move.sourceRelative}\0${move.targetRelative}`)) : null;
  const matches = [];
  for (const entry of fs.readdirSync(base)) {
    const directory = path.join(base, entry);
    const directoryStat = lstatIfPresent(directory);
    if (!entry.startsWith('recovery-') || !directoryStat || directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) continue;
    const manifestFile = path.join(directory, 'manifest.json');
    const manifestStat = lstatIfPresent(manifestFile);
    if (!manifestStat || manifestStat.isSymbolicLink() || !manifestStat.isFile()) continue;
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    const files = manifest.files || [];
    const targetPrefix = workTarget ? `${repoPath(workTarget)}/` : null;
    if (files.some((file) => !file.source || !file.target || !file.file || (targetPrefix && !file.target.startsWith(targetPrefix)))) continue;
    if (expected && (files.length !== expected.size || files.some((file) => !expected.has(`${file.source}\0${file.target}`)))) continue;
    const originalDocuments = new Map();
    const approvedBlobs = new Map();
    for (const file of files) {
      const snapshot = path.resolve(directory, file.file);
      if (file.file === '.' || file.file === '..' || path.basename(file.file) !== file.file || path.dirname(snapshot) !== directory) fail(`recovery snapshot is invalid: ${file.file}`);
      const snapshotStat = lstatIfPresent(snapshot);
      if (!snapshotStat || snapshotStat.isSymbolicLink() || !snapshotStat.isFile() || sha256(snapshot) !== file.sha256 || !file.blob) fail(`recovery snapshot is invalid: ${snapshot}`);
      originalDocuments.set(file.source, { content: fs.readFileSync(snapshot), mode: file.mode });
      approvedBlobs.set(file.source, file.blob);
    }
    const indexBefore = path.join(directory, 'index-before');
    const indexBeforeStat = lstatIfPresent(indexBefore);
    if (manifest.indexFingerprint && (!indexBeforeStat || indexBeforeStat.isSymbolicLink() || !indexBeforeStat.isFile())) fail(`recovery index is invalid: ${indexBefore}`);
    const reconciledIndex = path.join(directory, 'reconciled-index');
    const reconciledStat = lstatIfPresent(reconciledIndex);
    if (reconciledStat && (reconciledStat.isSymbolicLink() || !reconciledStat.isFile())) fail(`recovery index is invalid: ${reconciledIndex}`);
    matches.push({ directory, manifest: files, originalDocuments, approvedBlobs, indexBefore: indexBeforeStat ? indexBefore : null, reconciledIndex: reconciledStat ? reconciledIndex : null, indexFingerprint: manifest.indexFingerprint || null, parent: manifest.parent || null, moves: files.map((file) => ({
      source: safePath(root, file.source),
      sourceRelative: file.source,
      target: safePath(root, file.target),
      targetRelative: file.target,
    })) });
  }
  if (matches.length > 1) fail(`multiple recovery snapshots match this work item; resolve manually: ${matches.map((match) => match.directory).join(', ')}`);
  return matches[0] || null;
}

function cleanupRecoverySnapshot(snapshot) {
  if (!snapshot) return;
  fs.rmSync(snapshot.directory, { recursive: true, force: true });
}

function rollbackMovedDocuments(root, moved, originalDocuments) {
  const conflicts = [];
  for (const move of [...moved].reverse()) {
    if (!pathExists(move.target)) {
      conflicts.push(move.sourceRelative);
      continue;
    }
    try {
      safePath(root, move.targetRelative);
    } catch {
      conflicts.push(move.sourceRelative);
      continue;
    }
    if (fs.lstatSync(move.target).isSymbolicLink()) {
      conflicts.push(move.sourceRelative);
      continue;
    }
    const original = originalDocuments.get(move.sourceRelative);
    if (!original) {
      try {
        safePath(root, move.sourceRelative);
        if (!fs.existsSync(move.source)) fs.renameSync(move.target, move.source);
      } catch {
        conflicts.push(move.sourceRelative);
      }
      continue;
    }
    if (fs.existsSync(move.source)) {
      if (fs.lstatSync(move.source).isSymbolicLink()) {
        conflicts.push(move.sourceRelative);
        continue;
      }
      if (sha256(move.source) !== sha256Buffer(original.content) || sha256(move.target) !== sha256Buffer(original.content)) conflicts.push(move.sourceRelative);
      else fs.rmSync(move.target, { force: true });
      continue;
    }
    safePath(root, move.sourceRelative);
    if (sha256(move.target) !== sha256Buffer(original.content)) {
      conflicts.push(move.sourceRelative);
      continue;
    }
    fs.writeFileSync(move.source, original.content, { mode: original.mode, flag: 'wx' });
    fs.rmSync(move.target, { force: true });
  }
  return conflicts;
}

function commitClose(root, moves, environment, hashes, approvedBlobs, expectedHead, expectedHeadRef, developerIndex, developerIndexFingerprint) {
  const messageFile = path.join(os.tmpdir(), `work-message-${process.pid}-${crypto.randomUUID()}.txt`);
  const message = `docs: archive ${path.basename(path.dirname(moves[0].target))} documentation\n`;
  fs.writeFileSync(messageFile, message);
  try {
    runHook(root, 'pre-commit', [], environment);
    assertDeveloperIndexUnchanged(developerIndex, developerIndexFingerprint);
    assertHeadIdentity(root, expectedHead, expectedHeadRef);
    const allowed = new Set(moves.flatMap((move) => [move.sourceRelative, move.targetRelative]));
    assertAllowedIndex(root, allowed, environment);
    runHook(root, 'prepare-commit-msg', [messageFile, 'message'], environment);
    assertDeveloperIndexUnchanged(developerIndex, developerIndexFingerprint);
    assertHeadIdentity(root, expectedHead, expectedHeadRef);
    runHook(root, 'commit-msg', [messageFile], environment);
    assertDeveloperIndexUnchanged(developerIndex, developerIndexFingerprint);
    assertHeadIdentity(root, expectedHead, expectedHeadRef);
    assertAllowedIndex(root, allowed, environment);
    assertDocumentHashes(moves, hashes);
    const tree = assertApprovedTree(root, moves, approvedBlobs, environment);
    assertHeadIdentity(root, expectedHead, expectedHeadRef);
    const signing = runGit(['config', '--bool', 'commit.gpgSign'], root, true).stdout.trim();
    if (signing === 'true') fail('close requires commit signing, but the deterministic plumbing path cannot satisfy the configured signing policy');
    const commit = gitOutput(['commit-tree', tree, '-p', expectedHead, '-F', messageFile], root, environment);
    runGit(['update-ref', '-m', 'docs: archive work documentation', expectedHeadRef, commit, expectedHead], root, false, environment);
    try {
      runHook(root, 'post-commit', [], environment);
      assertDeveloperIndexUnchanged(developerIndex, developerIndexFingerprint);
      if (gitOutput(['rev-parse', 'HEAD'], root) !== commit || symbolicHead(root) !== expectedHeadRef) fail('HEAD changed after close commit');
      const committedHashes = new Map(moves.map((move) => [move.sourceRelative, sha256Buffer(spawnSync('git', ['cat-file', 'blob', `${commit}:${repoPath(move.targetRelative)}`], { cwd: root, encoding: null }).stdout)]));
      assertCommittedDocuments(root, moves, commit);
      assertDocumentHashes(moves, committedHashes);
      assertApprovedCommit(root, moves, approvedBlobs, commit);
    } catch (error) {
      const ownershipConflict = gitOutput(['rev-parse', 'HEAD'], root) !== commit
        || symbolicHead(root) !== expectedHeadRef;
      error.commitCreated = true;
      error.commitPostConflict = true;
      error.commitOwnershipConflict = ownershipConflict;
      error.message = ownershipConflict
        ? `post-commit hook changed HEAD ownership; committed content was not overwritten, and manual recovery is required: ${error.message}`
        : `post-commit hook left a document conflict; committed content was not overwritten: ${error.message}`;
      throw error;
    }
    return commit;
  } finally {
    fs.rmSync(messageFile, { force: true });
  }
}

function closeWork(root, args = []) {
  const options = parseCloseArgs(args);
  const branch = currentBranch(root);
  const match = branch.match(/^(feature|bugfix|hotfix|refactor|chore|spike)\/(.+)$/);
  if (!match) fail(`current branch is not a work branch: ${branch || '(detached)'}`);
  const [, type, name] = match;
  const workTarget = path.join('docs', 'work-items', HISTORY_DIRS[type], name);
  const existingRecovery = loadRecoverySnapshot(root, null, workTarget);
  const moves = historicalMoves(root, type, name).length ? historicalMoves(root, type, name) : (existingRecovery?.moves || []);
  if (!moves.length) {
    console.log('No work documents found; no commit created.');
    return;
  }
  const destinationRoot = safePath(root, path.join('docs', 'work-items', HISTORY_DIRS[type], name));
  if (fs.existsSync(destinationRoot) && !fs.lstatSync(destinationRoot).isDirectory()) fail(`historical destination is not a directory: ${destinationRoot}`);
  for (const move of moves) {
    if (fs.existsSync(move.source) && fs.existsSync(move.target)) {
      fail(`source and historical document both exist; resolve manually: ${move.sourceRelative}`);
    }
  }
  const todo = moves.find((move) => move.sourceRelative === repoPath(path.join('tasks', 'todo.md')));
  const allowedPaths = new Set(moves.flatMap((move) => [move.sourceRelative, move.targetRelative]));
  const developerIndex = path.resolve(root, gitOutput(['rev-parse', '--git-path', 'index'], root));
  const developerIndexState = readRegularFile(developerIndex);
  const developerIndexFingerprint = `${developerIndexState.stat.dev}:${developerIndexState.stat.ino}:${developerIndexState.stat.size}:${developerIndexState.stat.mtimeMs}:${sha256Buffer(developerIndexState.content)}`;
  assertSupportedIndexState(root, {});
  const committedMismatch = moves.find((move) => !pathExists(move.source) && existsInHead(root, move.targetRelative) && pathExists(move.target) && sha256(move.target) !== headSha256(root, move.targetRelative));
  if (committedMismatch) fail(`historical document differs from its confirmed commit; resolve manually: ${committedMismatch.targetRelative}`);
  const alreadyCommitted = moves.every((move) => !pathExists(move.source) && existsInHead(root, move.targetRelative));
  if (alreadyCommitted) {
    if (existingRecovery?.indexFingerprint && existingRecovery.indexBefore) {
      let reconciled = existingRecovery.reconciledIndex;
      if (!reconciled) {
        const retryIndex = reconcileIndex(root, existingRecovery.parent || gitOutput(['rev-parse', 'HEAD^'], root), gitOutput(['rev-parse', 'HEAD'], root), existingRecovery.indexBefore, allowedPaths, {});
        reconciled = retryIndex.file;
      }
      if (!existingRecovery.indexFingerprint) fail(`recovery snapshot lacks the original index fingerprint: ${existingRecovery.directory}`);
      try {
        publishReconciledIndex(root, reconciled, developerIndex, existingRecovery.indexFingerprint);
      } finally {
        if (reconciled !== existingRecovery.reconciledIndex) fs.rmSync(reconciled, { force: true });
      }
    }
    cleanupRecoverySnapshot(existingRecovery);
    console.log('Documents already archived; no commit created.');
    return;
  }
  const stagedBeforeClose = stagedPaths(root, gitOutput(['rev-parse', 'HEAD'], root), {});
  const stagedDocument = [...stagedBeforeClose].find((file) => allowedPaths.has(file));
  if (stagedDocument) fail(`close cannot reconcile a staged work document: ${stagedDocument}`);
  const pending = checklistPending(todo ? (pathExists(todo.source) ? todo.source : todo.target) : null);
  if (pending && !options.allowIncomplete) {
    fail(`${pending} pending task(s) remain; rerun with --allow-incomplete to archive exceptionally`);
  }
  const unconfirmedMissing = moves.find((move) => !pathExists(move.source) && !existingRecovery && !existsInHead(root, move.targetRelative));
  if (unconfirmedMissing) fail(`source is absent without a durable recovery snapshot or confirmed commit: ${unconfirmedMissing.sourceRelative}`);
  const originalDocuments = existingRecovery?.originalDocuments || new Map(moves
    .filter((move) => pathExists(move.source))
    .map((move) => [move.sourceRelative, readRegularFile(move.source)]));
  const hashes = new Map(moves.map((move) => [move.sourceRelative, sha256Buffer(originalDocuments.get(move.sourceRelative)?.content || readRegularFile(move.target).content)]));
  const approvedBlobs = existingRecovery?.approvedBlobs || new Map(moves.map((move) => [
    move.sourceRelative,
    pathExists(move.source) ? gitBlob(root, readRegularFile(move.source).content) : gitOutput(['rev-parse', '--verify', `HEAD:${repoPath(move.targetRelative)}`], root),
  ]));
  const moved = [];
  const destinationExisted = fs.existsSync(destinationRoot);
  let recoverySnapshot = existingRecovery;
  const snapshotOwned = !existingRecovery;
  let committed = false;
  const expectedHead = gitOutput(['rev-parse', 'HEAD'], root);
  const expectedHeadRef = symbolicHead(root);
  const indexFile = path.join(os.tmpdir(), `work-index-${process.pid}-${crypto.randomUUID()}`);
  const environment = { GIT_INDEX_FILE: indexFile };
  try {
    if (!recoverySnapshot) recoverySnapshot = createRecoverySnapshot(root, moves, originalDocuments, approvedBlobs, {
      content: developerIndexState.content,
      fingerprint: developerIndexFingerprint,
      parent: expectedHead,
    });
    fs.mkdirSync(destinationRoot, { recursive: true });
    runGit(['read-tree', 'HEAD'], root, false, environment);
    for (const move of moves) {
      if (!pathExists(move.source)) {
        const original = originalDocuments.get(move.sourceRelative);
        if (original && !pathExists(move.target)) {
          safePath(root, move.targetRelative);
          fs.writeFileSync(move.target, original.content, { mode: original.mode, flag: 'wx' });
          moved.push(move);
        }
        continue;
      }
      safePath(root, move.sourceRelative);
      safePath(root, move.targetRelative);
      if (pathExists(move.target)) fail(`historical document appeared during close: ${move.targetRelative}`);
      fs.renameSync(move.source, move.target);
      moved.push(move);
    }
    assertDocumentHashes(moves, hashes);
    stageMoves(root, moves, environment);
    const staged = assertAllowedIndex(root, new Set(moves.flatMap((move) => [move.sourceRelative, move.targetRelative])), environment);
    if (!staged.length) fail('close would create an empty commit');
    assertApprovedTree(root, moves, approvedBlobs, environment);
    const commit = commitClose(root, moves, environment, hashes, approvedBlobs, expectedHead, expectedHeadRef, developerIndex, developerIndexFingerprint);
    committed = true;
    let reconciled;
    try {
      reconciled = reconcileIndex(root, expectedHead, commit, developerIndex, allowedPaths, environment);
      publishReconciledIndex(root, reconciled.file, developerIndex, developerIndexFingerprint);
    } catch (error) {
      if (reconciled && recoverySnapshot) preserveReconciledIndex(recoverySnapshot, reconciled.file);
      error.indexReconciliationFailed = true;
      throw error;
    } finally {
      if (reconciled) fs.rmSync(reconciled.file, { force: true });
    }
    assertDocumentHashes(moves, hashes);
    const committedFiles = gitOutput(['show', '--format=', '--name-only', 'HEAD'], root).split(/\r?\n/).filter(Boolean);
    const allowedCommitted = new Set(moves.flatMap((move) => [move.sourceRelative, move.targetRelative]));
    if (!committedFiles.length || committedFiles.some((file) => !allowedCommitted.has(file))) fail(`close commit contains unexpected paths: ${committedFiles.join(', ')}`);
    cleanupRecoverySnapshot(recoverySnapshot);
    console.log(`Archived ${moves.length} document(s) under ${path.relative(root, destinationRoot)}`);
  } catch (error) {
    const developerIndexChanged = indexFingerprint(developerIndex) !== developerIndexFingerprint;
    if (error.commitOwnershipConflict) {
      fail(`close committed but HEAD ownership changed; original snapshots preserved at ${recoverySnapshot?.directory || '(unavailable)'}; manual recovery is required: ${error.message}`);
    }
    committed = committed || error.commitCreated === true;
    if (!committed) {
      const conflicts = rollbackMovedDocuments(root, moved, originalDocuments);
      if (conflicts.length) {
        fail(`close failed without overwriting recreated documents: ${conflicts.join(', ')}; original snapshots preserved at ${recoverySnapshot?.directory || '(unavailable)'}`);
      }
      if (snapshotOwned) cleanupRecoverySnapshot(recoverySnapshot);
      if (!destinationExisted && fs.existsSync(destinationRoot) && fs.readdirSync(destinationRoot).length === 0) {
        fs.rmdirSync(destinationRoot);
      }
       fail(developerIndexChanged
         ? `close failed; documents were restored, but the developer index changed and was not overwritten: ${error.message}`
         : `close failed; documents were restored and the original index was preserved: ${error.message}`);
    }
    if (error.indexReconciliationFailed) {
      fail(`close committed but the developer index was not reconciled; original snapshots preserved at ${recoverySnapshot?.directory || '(unavailable)'}; ${error.message}`);
    }
    if (error.commitCreated || error.commitPostConflict) {
      fail(`close committed but post-commit verification found a conflict; original snapshots preserved at ${recoverySnapshot?.directory || '(unavailable)'}; ${error.message}`);
    }
    if (snapshotOwned) cleanupRecoverySnapshot(recoverySnapshot);
    fail(`close committed but post-commit verification failed: ${error.message}`);
  } finally {
    fs.rmSync(indexFile, { force: true });
  }
}

async function main(argv = process.argv.slice(2)) {
  const root = repoRoot();
  const [operation, ...args] = argv;
  if (operation === 'start') return startWork(args, root);
  if (operation === 'switch') return switchWork(args, root);
  if (operation === 'close') return closeWork(root, args);
  fail('usage: work.js <start|switch|close> ...');
}

if (require.main === module) {
  Promise.resolve(main()).catch((error) => {
    console.error(`Work lifecycle failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { DOCUMENTS, HISTORY_DIRS, main, parseStartArgs, parseCloseArgs, worktrees };
