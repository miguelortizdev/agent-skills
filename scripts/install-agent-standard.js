#!/usr/bin/env node

'use strict';

const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CATALOG_FILE = path.join(ROOT, 'registry', 'catalog.json');
const PROFILE_DIR = path.join(ROOT, 'profiles');
const HOST_DIR = path.join(ROOT, 'registry', 'hosts.json');
const TYPE_FIELDS = { skill: 'skills', command: 'commands', agent: 'agents', reference: 'references' };

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function parseArgs(argv) {
  const options = { dryRun: false, global: false, project: false, uninstall: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--uninstall') options.uninstall = true;
    else if (arg === '--global') options.global = true;
    else if (arg === '--project') options.project = true;
    else if (arg === '--host') options.host = argv[++index];
    else if (arg === '--profile') options.profile = argv[++index];
    else throw new Error(`unknown option: ${arg}`);
  }
  if (!options.host) throw new Error('--host is required');
  if (!options.profile) throw new Error('--profile is required');
  if (options.global === options.project) throw new Error('choose exactly one of --global or --project');
  return options;
}

function safePath(root, relativePath) {
  if (!relativePath || path.isAbsolute(relativePath)) throw new Error(`unsafe destination path: ${relativePath}`);
  const resolved = path.resolve(root, relativePath);
  const back = path.relative(root, resolved);
  if (!back || back === '..' || back.startsWith(`..${path.sep}`) || path.isAbsolute(back)) {
    throw new Error(`destination escapes install root: ${relativePath}`);
  }
  return resolved;
}

function assertNoSymlinkPath(root, target) {
  let current = target;
  while (current !== root && current.startsWith(`${root}${path.sep}`)) {
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
      throw new Error(`refusing to write through symlink: ${current}`);
    }
    current = path.dirname(current);
  }
}

function filesIn(source, relative = '') {
  const current = path.join(source, relative);
  const stat = fs.lstatSync(current);
  if (stat.isSymbolicLink()) throw new Error(`source symlink is not installable: ${path.relative(ROOT, current)}`);
  if (stat.isFile()) return [{ source: current, relative: relative || path.basename(current) }];
  return fs.readdirSync(current).flatMap((entry) => filesIn(source, path.join(relative, entry)));
}

function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function canonicalCommand(source) {
  const content = fs.readFileSync(source, 'utf8');
  const descriptionMatch = content.match(/^description\s*=\s*"((?:[^"\\]|\\.)*)"/m);
  const promptMatch = content.match(/^prompt\s*=\s*"""\r?\n([\s\S]*?)\r?\n"""/m);
  if (!descriptionMatch || !promptMatch) throw new Error(`malformed canonical command: ${source}`);
  return {
    description: JSON.parse(`"${descriptionMatch[1]}"`),
    prompt: promptMatch[1],
  };
}

function renderMarkdownCommand(command) {
  return `---\ndescription: ${JSON.stringify(command.description)}\n---\n\n${command.prompt}\n`;
}

function renderSubagent(source) {
  const content = fs.readFileSync(source, 'utf8');
  if (!content.startsWith('---\n')) throw new Error(`malformed agent frontmatter: ${source}`);
  const closing = content.indexOf('\n---\n', 4);
  if (closing === -1) throw new Error(`malformed agent frontmatter: ${source}`);
  const frontmatter = content.slice(4, closing);
  if (/^mode\s*:/m.test(frontmatter)) return content;
  return `---\n${frontmatter}\nmode: subagent\n---\n${content.slice(closing + 5)}`;
}

function parseAgent(source) {
  const content = fs.readFileSync(source, 'utf8');
  if (!content.startsWith('---\n')) throw new Error(`malformed agent frontmatter: ${source}`);
  const closing = content.indexOf('\n---\n', 4);
  if (closing === -1) throw new Error(`malformed agent frontmatter: ${source}`);
  const fields = Object.fromEntries(content.slice(4, closing).split('\n').flatMap((line) => {
    const separator = line.indexOf(':');
    return separator === -1 ? [] : [[line.slice(0, separator).trim(), line.slice(separator + 1).trim()]];
  }));
  if (!fields.name || !fields.description) throw new Error(`agent frontmatter requires name and description: ${source}`);
  return { name: fields.name, description: fields.description, instructions: content.slice(closing + 5).trim() };
}

function renderCodexAgent(source) {
  const agent = parseAgent(source);
  // Basic TOML strings keep arbitrary instruction text from closing a multiline
  // value or being interpreted as TOML syntax.
  return `name = ${JSON.stringify(agent.name)}\ndescription = ${JSON.stringify(agent.description)}\ndeveloper_instructions = ${JSON.stringify(agent.instructions)}\n`;
}

function commandAction(source, id, destination, representation) {
  const filename = representation.filenameMap && representation.filenameMap[id] || id;
  const nativeSource = representation.nativeSourceDirectory && path.join(
    ROOT,
    representation.nativeSourceDirectory,
    `${filename}${representation.extension}`,
  );
  if (nativeSource && fs.existsSync(nativeSource)) {
    return { source: nativeSource, target: safePath(destination, `${filename}${representation.extension}`) };
  }
  const command = canonicalCommand(source);
  if (representation.format === 'markdown') {
    return {
      source,
      content: renderMarkdownCommand(command),
      target: safePath(destination, `${filename}${representation.extension}`),
    };
  }
  if (representation.format === 'toml') {
    return {
      source,
      target: safePath(destination, `${filename}${representation.extension}`),
    };
  }
  throw new Error(`unsupported command representation: ${representation.format}`);
}

function agentAction(source, id, destination, representation) {
  const target = safePath(destination, `${id}.md`);
  if (representation.format === 'toml') {
    return { source, content: renderCodexAgent(source), target: safePath(destination, `${id}.toml`) };
  }
  if (representation.format === 'markdown' && representation.addMode === 'subagent') {
    return { source, content: renderSubagent(source), target };
  }
  return { source, target };
}

function installDestinations(adapter, scope) {
  const destinations = adapter.installDestinations;
  if (!destinations) return {};
  return destinations[scope] || destinations;
}

function manifestPath(installRoot, hostId) {
  return safePath(installRoot, path.join('.agent-standard', 'installations', `${hostId}.json`));
}

function readManifest(file) {
  if (!fs.existsSync(file)) return null;
  if (fs.lstatSync(file).isSymbolicLink()) throw new Error(`refusing to read symlinked manifest: ${file}`);
  return readJson(file);
}

function readInstallationManifests(installRoot) {
  const directory = safePath(installRoot, path.join('.agent-standard', 'installations'));
  if (!fs.existsSync(directory)) return [];
  if (fs.lstatSync(directory).isSymbolicLink()) throw new Error(`refusing to read symlinked installations directory: ${directory}`);
  return fs.readdirSync(directory).filter((file) => file.endsWith('.json')).map((file) => ({
    file: path.join(directory, file),
    manifest: readManifest(path.join(directory, file)),
  }));
}

function writeManifest(file, manifest) {
  assertNoSymlinkPath(path.dirname(file), path.dirname(file));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

function buildPlan(options) {
  const catalog = readJson(CATALOG_FILE);
  const profile = readJson(path.join(PROFILE_DIR, `${options.profile}.json`));
  if (profile.name !== options.profile) throw new Error(`profile filename does not match name: ${options.profile}`);
  const hosts = readJson(HOST_DIR).hosts;
  const host = hosts.find((entry) => entry.id === options.host);
  if (!host) throw new Error(`unknown host: ${options.host}`);
  const adapter = readJson(path.join(ROOT, host.adapterPath, 'adapter.json'));
  const assets = new Map(catalog.assets.map((asset) => [asset.id, asset]));
  const scope = options.global ? 'global' : 'project';
  const installRoot = options.global ? os.homedir() : process.cwd();
  const installationManifest = manifestPath(installRoot, host.id);
  const existingManifest = readManifest(installationManifest);
  if (existingManifest && (existingManifest.host !== host.id || existingManifest.profile !== profile.name || existingManifest.scope !== scope)) {
    throw new Error(`a different profile is already installed (${existingManifest.host}/${existingManifest.profile}); uninstall it before switching profiles`);
  }
  const actions = [];
  const skipped = [];

  const selectedProfile = { ...profile };
  const resolved = new Set();
  function requireAsset(id) {
    if (resolved.has(id)) return;
    resolved.add(id);
    const asset = assets.get(id);
    if (!asset) throw new Error(`${profile.name} dependency references missing asset: ${id}`);
    for (const dependency of asset.requires || []) requireAsset(dependency);
    const field = TYPE_FIELDS[asset.type];
    if (field && !selectedProfile[field].includes(id)) selectedProfile[field].push(id);
  }
  for (const field of Object.values(TYPE_FIELDS)) selectedProfile[field] = [...(profile[field] || [])];
  for (const field of Object.values(TYPE_FIELDS)) for (const id of selectedProfile[field]) requireAsset(id);

  for (const [type, field] of Object.entries(TYPE_FIELDS)) {
    const destination = installDestinations(adapter, scope)[field];
    for (const id of selectedProfile[field] || []) {
      const asset = assets.get(id);
      if (!asset || asset.type !== type) throw new Error(`${profile.name}.${field} references an invalid ${type}: ${id}`);
      if (!destination) {
        skipped.push(`${field}/${id}: host has no native destination; use documented fallback`);
        continue;
      }
      const source = path.join(ROOT, asset.path);
      const targetBase = safePath(installRoot, destination);
      if (type === 'command' && adapter.commandRepresentation) {
        actions.push(commandAction(source, id, targetBase, adapter.commandRepresentation));
        continue;
      }
      if (type === 'agent' && adapter.agentRepresentation) {
        actions.push(agentAction(source, id, targetBase, adapter.agentRepresentation));
        actions.push({
          source: path.join(ROOT, 'docs', 'agents.md'),
          target: safePath(path.dirname(targetBase), path.join('docs', 'agents.md')),
        });
        continue;
      }
      const bundleRoot = type === 'skill' ? path.dirname(source) : source;
      const sourceIsDirectory = fs.lstatSync(bundleRoot).isDirectory();
      for (const entry of filesIn(bundleRoot)) {
        const targetRelative = type === 'skill' || sourceIsDirectory ? path.join(id, entry.relative) : entry.relative;
        const target = safePath(targetBase, targetRelative);
        actions.push({ source: entry.source, target });
      }
      if (type === 'agent') {
        actions.push({
          source: path.join(ROOT, 'docs', 'agents.md'),
          target: safePath(path.dirname(targetBase), path.join('docs', 'agents.md')),
        });
      }
    }
  }
  if ((profile.mcp || []).length) skipped.push(`mcp: no safe native translation configured for ${host.id}; configure through the host UI or config`);
  const uniqueActions = [...new Map(actions.map((action) => [action.target, action])).values()];
  return { options, host, profile: selectedProfile, installRoot, actions: uniqueActions, skipped, installationManifest, existingManifest };
}

function executeInstall(plan) {
  const conflicts = [];
  const previousFiles = new Map((plan.existingManifest && plan.existingManifest.files || []).map((file) => [file.path, file]));
  for (const action of plan.actions) {
    assertNoSymlinkPath(plan.installRoot, path.dirname(action.target));
    if (fs.existsSync(action.target)) {
      if (fs.lstatSync(action.target).isSymbolicLink()) throw new Error(`refusing to write through symlink: ${action.target}`);
      const sourceContent = Buffer.from(action.content ?? fs.readFileSync(action.source));
      if (sourceContent.equals(fs.readFileSync(action.target))) continue;
      conflicts.push(action.target);
    }
  }
  if (conflicts.length) throw new Error(`refusing to overwrite existing files:\n${conflicts.join('\n')}`);
  const files = [];
  for (const action of plan.actions) {
    const relative = path.relative(plan.installRoot, action.target);
    const existed = fs.existsSync(action.target);
    if (!existed) {
      fs.mkdirSync(path.dirname(action.target), { recursive: true });
      if (action.content === undefined) fs.copyFileSync(action.source, action.target, fs.constants.COPYFILE_EXCL);
      else fs.writeFileSync(action.target, action.content, { flag: 'wx' });
    }
    files.push({
      path: relative,
      sha256: hashFile(action.target),
      created: previousFiles.has(relative) ? previousFiles.get(relative).created : !existed,
    });
  }
  assertNoSymlinkPath(plan.installRoot, path.dirname(plan.installationManifest));
  writeManifest(plan.installationManifest, { version: 1, host: plan.host.id, profile: plan.profile.name, scope: plan.options.global ? 'global' : 'project', files });
}

function removeEmptyParents(start, stop) {
  let current = start;
  while (current !== stop && current.startsWith(`${stop}${path.sep}`) && fs.existsSync(current)) {
    if (fs.lstatSync(current).isSymbolicLink() || fs.readdirSync(current).length > 0) break;
    fs.rmdirSync(current);
    current = path.dirname(current);
  }
}

function executeUninstall(plan) {
  const modified = [];
  const removable = [];
  const otherManifests = readInstallationManifests(plan.installRoot)
    .filter((entry) => entry.file !== plan.installationManifest);
  const otherOwners = new Map();
  for (const entry of otherManifests) for (const file of entry.manifest.files || []) {
    if (!otherOwners.has(file.path)) otherOwners.set(file.path, []);
    otherOwners.get(file.path).push(entry);
  }
  for (const entry of plan.existingManifest.files || []) {
    const target = safePath(plan.installRoot, entry.path);
    assertNoSymlinkPath(plan.installRoot, path.dirname(target));
    if (!entry.created || !fs.existsSync(target)) continue;
    if (fs.lstatSync(target).isSymbolicLink() || !fs.statSync(target).isFile() || hashFile(target) !== entry.sha256) {
      modified.push(target);
      continue;
    }
    const owners = otherOwners.get(entry.path) || [];
    if (owners.length) {
      const successor = owners.find((owner) => (owner.manifest.files || []).some((file) => file.path === entry.path));
      const successorFile = successor.manifest.files.find((file) => file.path === entry.path);
      successorFile.created = true;
      writeManifest(successor.file, successor.manifest);
    } else {
      removable.push(target);
    }
  }
  if (modified.length) throw new Error(`refusing to uninstall modified files:\n${modified.join('\n')}`);
  for (const target of removable) {
    fs.unlinkSync(target);
    removeEmptyParents(path.dirname(target), plan.installRoot);
  }
  fs.unlinkSync(plan.installationManifest);
  removeEmptyParents(path.dirname(plan.installationManifest), plan.installRoot);
}

function uninstallPlan(options) {
  const installRoot = options.global ? os.homedir() : process.cwd();
  const installationManifest = manifestPath(installRoot, options.host);
  const existingManifest = readManifest(installationManifest);
  if (!existingManifest) throw new Error('no installation manifest found; cannot safely uninstall untracked files');
  if (existingManifest.host !== options.host || existingManifest.profile !== options.profile || existingManifest.scope !== (options.global ? 'global' : 'project')) {
    throw new Error(`installation manifest belongs to ${existingManifest.host}/${existingManifest.profile}, not ${options.host}/${options.profile}`);
  }
  return { options, host: { id: existingManifest.host, displayName: existingManifest.host }, profile: { name: existingManifest.profile }, installRoot, installationManifest, existingManifest, actions: [], skipped: [] };
}

function execute(plan) {
  if (plan.options.uninstall) return executeUninstall(plan);
  return executeInstall(plan);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const plan = options.uninstall ? uninstallPlan(options) : buildPlan(options);
  console.log(`${plan.options.dryRun ? 'Dry run' : plan.options.uninstall ? 'Uninstall' : 'Install'}: ${plan.host.displayName} / ${plan.profile.name}`);
  console.log(`Target root: ${plan.installRoot}`);
  if (plan.options.uninstall) {
    for (const entry of plan.existingManifest.files || []) console.log(`${plan.options.dryRun ? '  would remove' : '  remove'} ${entry.path}`);
  } else {
    for (const action of plan.actions) console.log(`${plan.options.dryRun ? '  would copy' : '  copy'} ${path.relative(ROOT, action.source)} -> ${path.relative(plan.installRoot, action.target)}`);
    console.log(`${plan.options.dryRun ? '  would write' : '  write'} ${path.relative(plan.installRoot, plan.installationManifest)}`);
  }
  for (const skipped of plan.skipped) console.log(`  skip ${skipped}`);
  if (!plan.options.dryRun) execute(plan);
  console.log(plan.options.dryRun ? 'No files changed.' : plan.options.uninstall ? 'Uninstallation complete.' : 'Installation complete.');
}

try {
  main();
} catch (error) {
  console.error(`Installation failed: ${error.message}`);
  process.exit(1);
}
