'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GENERATED_SKILL_MODE = 'generated-skills';

function parseCanonicalCommand(source, id = path.basename(source, path.extname(source)), sourceLabel) {
  const content = fs.readFileSync(source, 'utf8');
  const descriptionMatch = content.match(/^description\s*=\s*"((?:[^"\\]|\\.)*)"/m);
  const promptMatch = content.match(/^prompt\s*=\s*"""\r?\n([\s\S]*?)\r?\n"""/m);
  if (!descriptionMatch || !promptMatch) throw new Error(`malformed canonical command: ${source}`);
  if (!SAFE_ID.test(id)) throw new Error(`unsafe command Skill name: ${id}`);
  return {
    id,
    source,
    sourceLabel: sourceLabel || path.basename(source),
    description: JSON.parse(`"${descriptionMatch[1]}"`),
    prompt: promptMatch[1],
  };
}

function resolveCommandDependencies(commandId, assets) {
  const ordered = [];
  const visiting = new Set();
  const visited = new Set();

  function visit(id, chain = []) {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`dependency cycle: ${[...chain, id].join(' -> ')}`);
    const asset = assets.get(id);
    if (!asset) throw new Error(`missing asset dependency: ${id}`);
    if (asset.enabled === false) throw new Error(`disabled asset dependency: ${id}`);
    visiting.add(id);
    for (const dependency of asset.requires || []) visit(dependency, [...chain, id]);
    visiting.delete(id);
    visited.add(id);
    if (id !== commandId) ordered.push(asset);
  }

  visit(commandId);
  return ordered;
}

function validateFallback(fallback) {
  if (!fallback || fallback.mode !== GENERATED_SKILL_MODE) return false;
  if (typeof fallback.nameTemplate !== 'string' || fallback.nameTemplate !== '<command-id>') {
    throw new Error('generated command Skill fallback requires nameTemplate "<command-id>"');
  }
  if (typeof fallback.syntax !== 'string' || fallback.syntax !== '$<command-id>') {
    throw new Error('generated command Skill fallback requires syntax "$<command-id>"');
  }
  return true;
}

function generatedSkillId(commandId, fallback) {
  if (!SAFE_ID.test(commandId)) throw new Error(`unsafe command Skill name: ${commandId}`);
  validateFallback(fallback);
  return fallback.nameTemplate.replace('<command-id>', commandId);
}

function generateCommandSkill({ command, dependencies = [], syntax = `$${command.id}` }) {
  const skillId = command.id;
  if (!SAFE_ID.test(skillId)) throw new Error(`unsafe command Skill name: ${skillId}`);
  const description = `Use when invoking ${syntax}. ${command.description}`;
  const dependencyLines = dependencies.length
    ? dependencies.map((dependency) => `- \`${dependency.id}\` (${dependency.type})`).join('\n')
    : '- None.';
  return `---
name: ${skillId}
description: ${JSON.stringify(description)}
metadata:
  generated: command-adapter
  source: ${JSON.stringify(command.sourceLabel)}
---

# ${skillId} Command Adapter

This generated Skill is invoked explicitly with \`${syntax}\`. Text after the
invocation is interpreted according to the canonical Command modes below. The
canonical Command remains the single source of truth; this file preserves its
complete prompt for Codex.

## Overview

Adapt the canonical \`${skillId}\` Command for a host that discovers Skills
instead of native Commands.

## When to Use

Use this Skill when the user invokes ${syntax} and follow the canonical
instructions without replacing, shortening, or simulating them.

## Canonical Command Instructions

${command.prompt}

## Resolved Dependencies

${dependencyLines}

Dependencies retain their declared type. Agents and References are resources
for the canonical workflow, not additional \`$\`-invocable Skills.

## Common Rationalizations

Do not summarize or replace the canonical workflow with a shorter fallback.
Keep its approvals, validation, testing, stopping conditions, and recovery
rules intact.

## Red Flags

Stop when a required dependency is unavailable, an approval is missing, or the
canonical Command instructs the agent to stop. Do not claim an Agent result,
test result, or external operation that was not actually executed.

## Verification

Apply the verification steps and completion conditions in the canonical Command
above. The generated adapter is valid only when those instructions are followed.
`;
}

module.exports = {
  GENERATED_SKILL_MODE,
  generateCommandSkill,
  generatedSkillId,
  parseCanonicalCommand,
  resolveCommandDependencies,
  validateFallback,
};
