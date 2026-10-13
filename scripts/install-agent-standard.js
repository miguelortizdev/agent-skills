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
const MCP_FILE = path.join(ROOT, 'mcp', 'registry.json');
const TYPE_FIELDS = { skill: 'skills', command: 'commands', agent: 'agents', reference: 'references' };
const mcp = require('./lib/mcp');
const { detectProjectContext } = require('./lib/context-detector');
const { resolveContextualSkills } = require('./lib/context-resolver');
const {
  generateCommandSkill,
  generatedSkillId,
  parseCanonicalCommand,
  resolveCommandDependencies,
  validateFallback,
} = require('./lib/command-skill-generator');
const { END_MARKER, START_MARKER, mergeProjectInstructions, removeProjectInstructions } = require('./lib/project-instructions');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function parseArgs(argv) {
  const options = { dryRun: false, global: false, project: false, overlay: false, uninstall: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--uninstall') options.uninstall = true;
    else if (arg === '--global') options.global = true;
    else if (arg === '--project') options.project = true;
    else if (arg === '--overlay' || arg === 'sync') options.overlay = true;
    else if (arg === '--host') options.host = argv[++index];
    else if (arg === '--profile') options.profile = argv[++index];
    else throw new Error(`unknown option: ${arg}`);
  }
  if (!options.host) throw new Error('--host is required');
  if (!options.profile) throw new Error('--profile is required');
  if (Number(options.global) + Number(options.project) + Number(options.overlay) !== 1) {
    throw new Error('choose exactly one of --global, --project, or --overlay');
  }
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

function projectInstructionAction(adapter, installRoot) {
  const target = safePath(installRoot, adapter.projectInstructions.path);
  const existed = fs.existsSync(target);
  const current = existed ? fs.readFileSync(target, 'utf8') : '';
  const createPrefix = adapter.projectInstructions.createPrefix || '';
  const merged = mergeProjectInstructions(current, createPrefix);
  return { target, path: path.relative(installRoot, target), content: merged.content, changed: merged.changed, created: !existed, emptyContent: createPrefix };
}

function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function canonicalCommand(source) {
  return parseCanonicalCommand(source);
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

function commandAction(source, id, destination, representation, workScript) {
  const filename = representation.filenameMap && representation.filenameMap[id] || id;
  const nativeSource = representation.nativeSourceDirectory && path.join(
    ROOT,
    representation.nativeSourceDirectory,
    `${filename}${representation.extension}`,
  );
  if (nativeSource && fs.existsSync(nativeSource)) {
    const content = fs.readFileSync(nativeSource, 'utf8');
    return content.includes('{{WORK_LIFECYCLE_SCRIPT}}')
      ? { source: nativeSource, content: content.replaceAll('{{WORK_LIFECYCLE_SCRIPT}}', workScript), target: safePath(destination, `${filename}${representation.extension}`) }
      : { source: nativeSource, target: safePath(destination, `${filename}${representation.extension}`) };
  }
  const command = canonicalCommand(source);
  if (representation.format === 'markdown') {
    return {
      source,
      content: renderMarkdownCommand(command).replaceAll('{{WORK_LIFECYCLE_SCRIPT}}', workScript),
      target: safePath(destination, `${filename}${representation.extension}`),
    };
  }
  if (representation.format === 'toml') {
    const content = fs.readFileSync(source, 'utf8');
    return content.includes('{{WORK_LIFECYCLE_SCRIPT}}')
      ? { source, content: content.replaceAll('{{WORK_LIFECYCLE_SCRIPT}}', workScript), target: safePath(destination, `${filename}${representation.extension}`) }
      : { source, target: safePath(destination, `${filename}${representation.extension}`) };
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

function workScriptPath(skillRoot, scope) {
  const relative = path.join(skillRoot, 'work-lifecycle', 'scripts', 'work.js').split(path.sep).join('/');
  if (scope !== 'global') return relative;
  return process.platform === 'win32' ? `"%USERPROFILE%\\${relative.replaceAll('/', '\\')}"` : `"$HOME/${relative}"`;
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

function installationMode(manifest) {
  if (manifest.mode) return manifest.mode;
  return manifest.scope === 'global' ? 'global' : 'full';
}

function requestedMode(options) {
  if (options.global) return 'global';
  if (options.overlay) return 'overlay';
  return 'full';
}

function validateGlobalFoundation(hostId, profileName) {
  const globalRoot = os.homedir();
  const globalManifests = readInstallationManifests(globalRoot)
    .filter((entry) => installationMode(entry.manifest) === 'global');
  const hostManifest = globalManifests.find((entry) => entry.manifest.host === hostId);
  if (!hostManifest) {
    if (globalManifests.length) {
      throw new Error(`global foundation host mismatch; requested ${hostId}, installed hosts: ${globalManifests.map((entry) => entry.manifest.host).join(', ')}`);
    }
    throw new Error(`global foundation was not found for host ${hostId}`);
  }
  if (hostManifest.manifest.profile !== profileName) {
    throw new Error(`global foundation profile mismatch; installed globally: ${hostManifest.manifest.profile}; requested by project: ${profileName}`);
  }
  if (!Array.isArray(hostManifest.manifest.files) || hostManifest.manifest.files.length === 0) {
    throw new Error(`global foundation was not found for host ${hostId}`);
  }
  const invalid = [];
  for (const file of hostManifest.manifest.files) {
    const target = safePath(globalRoot, file.path);
    if (!fs.existsSync(target)) {
      invalid.push(file.path);
      continue;
    }
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink() || !stat.isFile() || (file.sha256 && hashFile(target) !== file.sha256)) invalid.push(file.path);
  }
  if (invalid.length) throw new Error(`global foundation is incomplete or modified for host ${hostId}; invalid managed files: ${invalid.join(', ')}`);
  return hostManifest.manifest;
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
  const mcpRegistry = readJson(MCP_FILE);
  const profile = readJson(path.join(PROFILE_DIR, `${options.profile}.json`));
  if (profile.name !== options.profile) throw new Error(`profile filename does not match name: ${options.profile}`);
  const hosts = readJson(HOST_DIR).hosts;
  const host = hosts.find((entry) => entry.id === options.host);
  if (!host) throw new Error(`unknown host: ${options.host}`);
  const adapter = readJson(path.join(ROOT, host.adapterPath, 'adapter.json'));
  const assets = new Map(catalog.assets.map((asset) => [asset.id, asset]));
  const mode = requestedMode(options);
  const scope = options.global ? 'global' : 'project';
  const installRoot = options.global ? os.homedir() : process.cwd();
  const installationManifest = manifestPath(installRoot, host.id);
  const existingManifest = readManifest(installationManifest);
  if (existingManifest && (existingManifest.host !== host.id || existingManifest.profile !== profile.name || existingManifest.scope !== scope)) {
    throw new Error(`a different profile is already installed (${existingManifest.host}/${existingManifest.profile}); uninstall it before switching profiles`);
  }
  if (existingManifest && installationMode(existingManifest) !== mode) {
    if (mode === 'overlay' && installationMode(existingManifest) === 'full') {
      throw new Error('a full project installation is already present; uninstall it before switching to overlay mode');
    }
    if (mode === 'global' || installationMode(existingManifest) === 'global') {
      throw new Error(`installation mode mismatch: existing ${installationMode(existingManifest)}, requested ${mode}`);
    }
  }
  const globalFoundation = mode === 'overlay' ? validateGlobalFoundation(host.id, profile.name) : null;
  const actions = [];
  const generatedCommandSkills = [];
  const mcpActions = [];
  const skipped = [];

  const selectedProfile = { ...profile };
  const detectedContext = options.global ? null : detectProjectContext(installRoot);
  const contextualSkills = options.global ? [] : resolveContextualSkills(detectedContext, catalog);
  const projectInstructions = mode === 'overlay' ? [projectInstructionAction(adapter, installRoot)] : [];
  const otherInstructionOwners = readInstallationManifests(installRoot)
    .filter((entry) => entry.file !== installationManifest)
    .flatMap((entry) => entry.manifest.projectInstructions || []);
  for (const instruction of projectInstructions) {
    if (otherInstructionOwners.some((owner) => owner.path === instruction.path && owner.created)) instruction.created = true;
  }
  const contextualIds = new Set(contextualSkills.map((skill) => skill.id));
  const previousContextualSkills = existingManifest?.contextualSkills || [];
  const staleContextFiles = previousContextualSkills
    .filter((skill) => !contextualIds.has(skill.id))
    .flatMap((skill) => skill.files || []);
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
  for (const field of Object.values(TYPE_FIELDS)) selectedProfile[field] = mode === 'overlay' ? [] : [...(profile[field] || [])];
  for (const skill of contextualSkills) if (!selectedProfile.skills.includes(skill.id)) selectedProfile.skills.push(skill.id);
  for (const field of Object.values(TYPE_FIELDS)) for (const id of selectedProfile[field]) requireAsset(id);

  for (const [type, field] of Object.entries(TYPE_FIELDS)) {
    const destination = installDestinations(adapter, scope)[field];
    for (const id of selectedProfile[field] || []) {
      const asset = assets.get(id);
      if (!asset || asset.type !== type) throw new Error(`${profile.name}.${field} references an invalid ${type}: ${id}`);
      const source = path.join(ROOT, asset.path);
      if (!destination) {
        if (type === 'command' && adapter.commandFallback) {
          if (!validateFallback(adapter.commandFallback)) throw new Error(`unsupported command fallback for ${host.id}`);
          const generatedId = generatedSkillId(id, adapter.commandFallback);
          const collision = assets.get(generatedId);
          if (collision && collision.type === 'skill') throw new Error(`generated command Skill collides with canonical Skill: ${generatedId}`);
          const command = parseCanonicalCommand(source, id, asset.path);
          const dependencies = resolveCommandDependencies(id, assets);
          const skillRoot = installDestinations(adapter, scope).skills;
          if (!skillRoot) throw new Error(`host ${host.id} has no Skill destination for generated command: ${id}`);
          const workScript = id === 'work' ? workScriptPath(skillRoot, scope) : null;
          const generated = workScript ? { ...command, prompt: command.prompt.replaceAll('{{WORK_LIFECYCLE_SCRIPT}}', workScript) } : command;
          const content = generateCommandSkill({
            command: generated,
            dependencies,
            syntax: adapter.commandFallback.syntax.replace('<command-id>', generatedId),
          });
          const target = safePath(installRoot, path.join(skillRoot, generatedId, 'SKILL.md'));
          actions.push({ source, content, target, generatedCommand: { id, skill: generatedId, source: asset.path } });
          generatedCommandSkills.push({ id, skill: generatedId, source: asset.path, path: path.relative(installRoot, target) });
          continue;
        }
        skipped.push(`${field}/${id}: host has no native destination; use documented fallback`);
        continue;
      }
      const targetBase = safePath(installRoot, destination);
      if (type === 'command' && adapter.commandRepresentation) {
        const skillRoot = installDestinations(adapter, scope).skills;
        const installedWorkScript = id === 'work' ? workScriptPath(skillRoot, scope) : '';
        actions.push(commandAction(source, id, targetBase, adapter.commandRepresentation, installedWorkScript));
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
  if (mode !== 'overlay' && (profile.mcp || []).length) {
    if (!adapter.mcpConfig) throw new Error(`host ${host.id} has no MCP configuration adapter`);
    const representation = adapter.mcpConfig;
    const projectCandidates = representation.projectPaths || [representation.projectPath];
    const relativePath = options.global
      ? representation.globalPath
      : projectCandidates.find((candidate) => fs.existsSync(safePath(installRoot, candidate))) || representation.projectPath;
    const target = safePath(installRoot, relativePath);
    const configCreated = !fs.existsSync(target);
    const existing = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
    const servers = mcp.resolveMcpServers(profile.mcp, mcpRegistry);
    let merged;
    if (representation.format === 'toml') {
      merged = mcp.mergeCodexConfig(existing, relativePath, servers);
    } else {
      const render = representation.format === 'opencode-json'
        ? mcp.renderOpenCodeServer
        : (server) => mcp.renderJsonServer(server, representation);
      merged = mcp.mergeJsonConfig(existing, relativePath, servers, { ...representation, render });
    }
    const previousMcp = new Map((existingManifest?.mcp || [])
      .filter((entry) => entry.path === relativePath)
      .map((entry) => [entry.id, entry]));
    merged.entries = merged.entries.map((entry) => {
      const previous = previousMcp.get(entry.id);
      return previous && previous.created ? { ...entry, created: true, configCreated: previous.configCreated } : entry;
    });
    mcpActions.push({ target, relativePath, format: representation.format, rootKey: representation.rootKey, nestedRootKey: representation.nestedRootKey, configCreated, content: merged.content, changed: merged.changed, entries: merged.entries });
  }
  const uniqueActions = [...new Map(actions.map((action) => [action.target, action])).values()];
  const currentFilePaths = new Set(uniqueActions.map((action) => path.relative(installRoot, action.target)));
  const staleContextPaths = new Set(staleContextFiles.map((entry) => entry.path));
  const staleManagedFiles = (existingManifest?.files || []).filter((entry) =>
    entry.created
    && !currentFilePaths.has(entry.path)
    && !staleContextPaths.has(entry.path)
    && !entry.generatedCommand,
  );
  const contextualRoots = contextualSkills.map((skill) => ({
    id: skill.id,
    evidence: skill.evidence,
    root: safePath(installRoot, path.join(installDestinations(adapter, scope).skills, skill.id)),
  }));
  const currentGeneratedPaths = new Set(generatedCommandSkills.map((entry) => entry.path));
  const previousGenerated = existingManifest?.generatedCommandSkills || (existingManifest?.files || [])
    .filter((entry) => entry.generatedCommand)
    .map((entry) => ({ path: entry.path }));
  const staleGeneratedFiles = previousGenerated.filter((entry) => !currentGeneratedPaths.has(entry.path));
  return { options, mode, scope, host, adapter, profile: selectedProfile, installRoot, actions: uniqueActions, generatedCommandSkills, mcpActions, projectInstructions, skipped, installationManifest, existingManifest, detectedContext, contextualSkills, contextualRoots, staleContextFiles, staleManagedFiles, staleGeneratedFiles, globalFoundation };
}

function executeInstall(plan) {
  const conflicts = [];
  const previousFiles = new Map((plan.existingManifest && plan.existingManifest.files || []).map((file) => [file.path, file]));
  const otherManifests = readInstallationManifests(plan.installRoot).filter((entry) => entry.file !== plan.installationManifest);
  const otherOwners = new Map();
  for (const owner of otherManifests) for (const file of owner.manifest.files || []) {
    if (!otherOwners.has(file.path)) otherOwners.set(file.path, []);
    otherOwners.get(file.path).push({ owner, file });
  }
  const staleRemovable = [];
  const staleTransfers = [];
  const staleGeneratedRemovable = [];
  const staleGeneratedTransfers = [];
  const staleManagedRemovable = [];
  const staleManagedTransfers = [];
  for (const entry of plan.staleContextFiles) {
    const target = safePath(plan.installRoot, entry.path);
    const previous = previousFiles.get(entry.path) || entry;
    if (!previous.created || !fs.existsSync(target)) continue;
    if (fs.lstatSync(target).isSymbolicLink() || !fs.statSync(target).isFile() || hashFile(target) !== previous.sha256) {
      conflicts.push(target);
      continue;
    }
    const owners = otherOwners.get(entry.path) || [];
    if (owners.length) staleTransfers.push({ target, owners });
    else staleRemovable.push(target);
  }
  for (const entry of plan.staleGeneratedFiles || []) {
    const target = safePath(plan.installRoot, entry.path);
    const previous = previousFiles.get(entry.path);
    if (!previous?.created || !fs.existsSync(target)) continue;
    if (fs.lstatSync(target).isSymbolicLink() || !fs.statSync(target).isFile() || hashFile(target) !== previous.sha256) {
      conflicts.push(target);
      continue;
    }
    const owners = otherOwners.get(entry.path) || [];
    if (owners.length) staleGeneratedTransfers.push({ target, owners });
    else staleGeneratedRemovable.push(target);
  }
  for (const entry of plan.staleManagedFiles || []) {
    const target = safePath(plan.installRoot, entry.path);
    if (!fs.existsSync(target)) continue;
    if (fs.lstatSync(target).isSymbolicLink() || !fs.statSync(target).isFile() || hashFile(target) !== entry.sha256) {
      conflicts.push(target);
      continue;
    }
    const owners = otherOwners.get(entry.path) || [];
    if (owners.length) staleManagedTransfers.push({ target, owners });
    else staleManagedRemovable.push(target);
  }
  for (const action of plan.actions) {
    assertNoSymlinkPath(plan.installRoot, path.dirname(action.target));
    if (fs.existsSync(action.target)) {
      if (fs.lstatSync(action.target).isSymbolicLink()) throw new Error(`refusing to write through symlink: ${action.target}`);
      const sourceContent = Buffer.from(action.content ?? fs.readFileSync(action.source));
      if (sourceContent.equals(fs.readFileSync(action.target))) continue;
      const previous = previousFiles.get(path.relative(plan.installRoot, action.target));
      const managedUnchanged = previous && previous.created && hashFile(action.target) === previous.sha256;
      if (managedUnchanged) action.update = true;
      else conflicts.push(action.target);
    }
  }
  for (const action of plan.projectInstructions) {
    assertNoSymlinkPath(plan.installRoot, path.dirname(action.target));
    if (fs.existsSync(action.target) && fs.lstatSync(action.target).isSymbolicLink()) throw new Error(`refusing to write through symlink: ${action.target}`);
  }
  for (const action of plan.mcpActions) {
    assertNoSymlinkPath(plan.installRoot, path.dirname(action.target));
    if (action.changed && fs.existsSync(action.target) && fs.lstatSync(action.target).isSymbolicLink()) throw new Error(`refusing to write through symlink: ${action.target}`);
  }
  if (conflicts.length) throw new Error(`refusing to overwrite existing files:\n${conflicts.join('\n')}`);
  const files = [];
  for (const action of plan.actions) {
    const relative = path.relative(plan.installRoot, action.target);
    const existed = fs.existsSync(action.target);
    if (!existed || action.update) {
      fs.mkdirSync(path.dirname(action.target), { recursive: true });
      if (action.content === undefined) fs.copyFileSync(action.source, action.target, fs.constants.COPYFILE_EXCL);
      else fs.writeFileSync(action.target, action.content, { flag: existed ? 'w' : 'wx' });
    }
    files.push({
      path: relative,
      sha256: hashFile(action.target),
      created: previousFiles.has(relative) ? previousFiles.get(relative).created : !existed,
      generatedCommand: action.generatedCommand,
    });
  }
  const projectInstructionRecords = [];
  for (const action of plan.projectInstructions) {
    if (action.changed) {
      fs.mkdirSync(path.dirname(action.target), { recursive: true });
      fs.writeFileSync(action.target, action.content, { flag: fs.existsSync(action.target) ? 'w' : 'wx' });
    }
    const previous = (plan.existingManifest?.projectInstructions || []).find((entry) => entry.path === action.path);
    projectInstructionRecords.push({ path: action.path, created: previous ? previous.created : action.created, emptyContent: action.emptyContent, sha256: hashFile(action.target) });
  }
  const mcpRecords = [];
  for (const action of plan.mcpActions) {
    if (action.changed) {
      fs.mkdirSync(path.dirname(action.target), { recursive: true });
      fs.writeFileSync(action.target, action.content, { flag: fs.existsSync(action.target) ? 'w' : 'wx' });
    }
    for (const entry of action.entries) mcpRecords.push({ path: action.relativePath, format: action.format, rootKey: action.rootKey, nestedRootKey: action.nestedRootKey, configCreated: action.configCreated, ...entry });
  }
  for (const transfer of staleTransfers) {
    const successor = transfer.owners[0];
    const successorFile = successor.owner.manifest.files.find((file) => file.path === path.relative(plan.installRoot, transfer.target));
    successorFile.created = true;
    writeManifest(successor.owner.file, successor.owner.manifest);
  }
  for (const transfer of staleGeneratedTransfers) {
    const successor = transfer.owners[0];
    const relative = path.relative(plan.installRoot, transfer.target);
    const successorFile = successor.owner.manifest.files.find((file) => file.path === relative);
    successorFile.created = true;
    writeManifest(successor.owner.file, successor.owner.manifest);
  }
  for (const transfer of staleManagedTransfers) {
    const successor = transfer.owners[0];
    const relative = path.relative(plan.installRoot, transfer.target);
    const successorFile = successor.owner.manifest.files.find((file) => file.path === relative);
    successorFile.created = true;
    writeManifest(successor.owner.file, successor.owner.manifest);
  }
  for (const target of staleRemovable) {
    fs.unlinkSync(target);
    removeEmptyParents(path.dirname(target), plan.installRoot);
  }
  for (const target of staleGeneratedRemovable) {
    fs.unlinkSync(target);
    removeEmptyParents(path.dirname(target), plan.installRoot);
  }
  for (const target of staleManagedRemovable) {
    fs.unlinkSync(target);
    removeEmptyParents(path.dirname(target), plan.installRoot);
  }
  if (plan.mode === 'overlay' && plan.contextualSkills.length === 0 && plan.projectInstructions.length === 0) {
    if (plan.existingManifest) {
      fs.unlinkSync(plan.installationManifest);
      removeEmptyParents(path.dirname(plan.installationManifest), plan.installRoot);
    }
    return;
  }
  const contextualManifest = plan.contextualSkills.map((skill) => {
    const root = plan.contextualRoots.find((entry) => entry.id === skill.id).root;
    const prefix = `${path.relative(plan.installRoot, root)}${path.sep}`;
    return { id: skill.id, evidence: skill.evidence, files: files.filter((file) => file.path.startsWith(prefix)) };
  });
  assertNoSymlinkPath(plan.installRoot, path.dirname(plan.installationManifest));
  const context = plan.detectedContext && {
    files: plan.detectedContext.files.length,
    directories: plan.detectedContext.directories.length,
    dependencies: plan.detectedContext.dependencies.length,
    textFiles: plan.detectedContext.texts.length,
  };
  writeManifest(plan.installationManifest, {
    version: 1,
    host: plan.host.id,
    profile: plan.profile.name,
    scope: plan.scope,
    mode: plan.mode,
    foundation: plan.mode === 'overlay' ? { source: 'global', required: true } : undefined,
    context: context || undefined,
    files,
    projectInstructions: projectInstructionRecords,
    generatedCommandSkills: plan.generatedCommandSkills,
    contextualSkills: contextualManifest,
    mcp: mcpRecords,
  });
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
  const otherInstructions = new Map();
  for (const owner of otherManifests) for (const instruction of owner.manifest.projectInstructions || []) {
    if (!otherInstructions.has(instruction.path)) otherInstructions.set(instruction.path, []);
    otherInstructions.get(instruction.path).push(owner);
  }
  const instructionWrites = [];
  const instructionDeletes = [];
  for (const entry of plan.existingManifest.projectInstructions || []) {
    const target = safePath(plan.installRoot, entry.path);
    if (!fs.existsSync(target) || (otherInstructions.get(entry.path) || []).length) continue;
    assertNoSymlinkPath(plan.installRoot, path.dirname(target));
    if (fs.lstatSync(target).isSymbolicLink() || !fs.statSync(target).isFile()) throw new Error(`refusing to uninstall modified files:\n${target}`);
    const result = removeProjectInstructions(fs.readFileSync(target, 'utf8'));
    if (!result.changed) continue;
    if (entry.created && result.content === (entry.emptyContent || '')) instructionDeletes.push(target);
    else instructionWrites.push({ target, content: result.content });
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
  const mcpModified = [];
  const mcpChanges = new Map();
  const mcpDeleteCandidates = new Set();
  const mcpFormats = new Map();
  const mcpRepresentations = new Map();
  const mcpRemovalGroups = new Map();
  const otherMcp = new Map();
  for (const owner of otherManifests) for (const entry of owner.manifest.mcp || []) {
    const key = `${entry.path}\0${entry.id}`;
    if (!otherMcp.has(key)) otherMcp.set(key, []);
    otherMcp.get(key).push({ owner, entry });
  }
  for (const entry of plan.existingManifest.mcp || []) {
    if (!entry.created) continue;
    const target = safePath(plan.installRoot, entry.path);
    if (!fs.existsSync(target)) continue;
    const owners = otherMcp.get(`${entry.path}\0${entry.id}`) || [];
    if (owners.length) {
      const successor = owners[0];
      successor.entry.created = true;
      if (entry.configCreated) successor.entry.configCreated = true;
      writeManifest(successor.owner.file, successor.owner.manifest);
      continue;
    }
    if (!mcpRemovalGroups.has(target)) mcpRemovalGroups.set(target, []);
    mcpRemovalGroups.get(target).push(entry);
  }
  for (const [target, entries] of mcpRemovalGroups) {
    const stat = fs.existsSync(target) && fs.lstatSync(target);
    if (!stat || stat.isSymbolicLink() || !stat.isFile()) {
      modified.push(target);
      continue;
    }
    const content = fs.readFileSync(target, 'utf8');
    const first = entries[0];
    const result = first.format === 'toml'
      ? mcp.removeCodexEntries(content, entries)
      : mcp.removeJsonEntries(content, path.relative(plan.installRoot, target), entries, { rootKey: first.rootKey || 'mcpServers', nestedRootKey: first.nestedRootKey });
    if (result.modified.length) mcpModified.push(...result.modified.map((id) => `${path.relative(plan.installRoot, target)}:${id}`));
    else if (result.changed) {
      mcpChanges.set(target, result.content);
      if (entries.some((entry) => entry.configCreated)) {
        mcpDeleteCandidates.add(target);
        mcpFormats.set(target, first.format);
        mcpRepresentations.set(target, first);
      }
    }
  }
  if (mcpModified.length) modified.push(...mcpModified.map((entry) => path.join(plan.installRoot, entry)));
  if (modified.length) throw new Error(`refusing to uninstall modified files:\n${modified.join('\n')}`);
  for (const target of removable) {
    fs.unlinkSync(target);
    removeEmptyParents(path.dirname(target), plan.installRoot);
  }
  for (const action of instructionWrites) fs.writeFileSync(action.target, action.content);
  for (const target of instructionDeletes) {
    fs.unlinkSync(target);
    removeEmptyParents(path.dirname(target), plan.installRoot);
  }
  for (const [target, content] of mcpChanges) {
    const stat = fs.existsSync(target) && fs.lstatSync(target);
    if (!stat || stat.isSymbolicLink() || !stat.isFile()) throw new Error(`refusing to uninstall modified files:\n${target}`);
    fs.writeFileSync(target, content);
  }
  for (const target of mcpDeleteCandidates) {
    if (!fs.existsSync(target)) continue;
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`refusing to uninstall modified files:\n${target}`);
    if (mcpFormats.get(target) === 'toml' && fs.readFileSync(target, 'utf8').trim() === '') {
      fs.unlinkSync(target);
      removeEmptyParents(path.dirname(target), plan.installRoot);
      continue;
    }
    try {
      const config = JSON.parse(fs.readFileSync(target, 'utf8'));
      const rootKey = Object.keys(config).find((key) => key === 'mcpServers' || key === 'mcp');
      const representation = mcpRepresentations.get(target);
      const root = rootKey ? config[rootKey] : undefined;
      const emptyRoot = representation?.nestedRootKey
        ? root && Object.keys(root).every((key) => key === representation.nestedRootKey)
          && Object.keys(root[representation.nestedRootKey] || {}).length === 0
        : root && Object.keys(root).length === 0;
      if (rootKey && emptyRoot && Object.keys(config).every((key) => key === rootKey)) {
        fs.unlinkSync(target);
        removeEmptyParents(path.dirname(target), plan.installRoot);
      }
    } catch {}
  }
  fs.unlinkSync(plan.installationManifest);
  removeEmptyParents(path.dirname(plan.installationManifest), plan.installRoot);
}

function uninstallPlan(options) {
  const installRoot = options.global ? os.homedir() : process.cwd();
  const installationManifest = manifestPath(installRoot, options.host);
  const existingManifest = readManifest(installationManifest);
  if (!existingManifest) throw new Error('no installation manifest found; cannot safely uninstall untracked files');
  const mode = requestedMode(options);
  if (existingManifest.host !== options.host || existingManifest.profile !== options.profile || existingManifest.scope !== (options.global ? 'global' : 'project')) {
    throw new Error(`installation manifest belongs to ${existingManifest.host}/${existingManifest.profile}, not ${options.host}/${options.profile}`);
  }
  if (installationMode(existingManifest) !== mode) throw new Error(`installation manifest mode is ${installationMode(existingManifest)}, not ${mode}`);
  const host = readJson(HOST_DIR).hosts.find((entry) => entry.id === options.host);
  const adapter = readJson(path.join(ROOT, host.adapterPath, 'adapter.json'));
  return { options, mode, scope: existingManifest.scope, host, adapter, profile: { name: existingManifest.profile }, installRoot, installationManifest, existingManifest, actions: [], mcpActions: [], projectInstructions: [], skipped: [], contextualSkills: [], contextualRoots: [], staleContextFiles: [] };
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
  if (!plan.options.uninstall && plan.mode === 'overlay') {
    console.log('Global foundation: available');
    console.log('Project overlay: contextual Skills only');
    console.log(`  reused globally: ${plan.options.profile} foundation (Base Skills, Commands, Agents, References, MCP)`);
  }
  if (!plan.options.uninstall && plan.detectedContext) {
    console.log(`Detected project context: ${plan.contextualSkills.map((skill) => skill.id).join(', ') || 'none'}`);
    for (const skill of plan.contextualSkills) console.log(`  contextual skill: + ${skill.id} (${skill.evidence.join('; ')})`);
  }
  if (plan.options.uninstall) {
    for (const entry of plan.existingManifest.files || []) console.log(`${plan.options.dryRun ? '  would remove' : '  remove'} ${entry.path}`);
    for (const entry of plan.existingManifest.projectInstructions || []) console.log(`${plan.options.dryRun ? '  would update' : '  update'} project instructions ${entry.path}: remove ${START_MARKER} ... ${END_MARKER}`);
  } else {
    for (const action of plan.actions) {
      const verb = action.generatedCommand ? 'generate Command Skill' : 'copy';
      console.log(`${plan.options.dryRun ? `  would ${verb}` : `  ${verb}`} ${path.relative(ROOT, action.source)} -> ${path.relative(plan.installRoot, action.target)}`);
    }
    for (const action of plan.mcpActions) console.log(`${plan.options.dryRun ? '  would merge MCP' : '  merge MCP'} ${path.relative(plan.installRoot, action.target)}: ${action.entries.map((entry) => entry.id).join(', ')}`);
    for (const action of plan.projectInstructions) if (action.changed) console.log(`${plan.options.dryRun ? '  would update' : '  update'} project instructions ${action.path}: ${action.created ? 'create' : 'merge'} ${START_MARKER} ... ${END_MARKER}`);
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
