'use strict';

const START_MARKER = '<!-- ai-engineering-standard:start -->';
const END_MARKER = '<!-- ai-engineering-standard:end -->';
const INSTRUCTION_TEXT = [
  'Before executing any task or command, inspect the project-level Skills available in the current workspace.',
  '',
  'When a project Skill is relevant to the requested task, apply it together with the base Skills explicitly required by the command.',
  '',
  'Project-level Skills extend the global engineering foundation; they do not replace it.',
  '',
  'Do not use unrelated project Skills. Select them only when their scope and description match the current task.',
].join('\n');
const BLOCK = `${START_MARKER}\n${INSTRUCTION_TEXT}\n${END_MARKER}`;

function markerPattern(marker) {
  return marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function managedBlockPattern() {
  return new RegExp(`${markerPattern(START_MARKER)}[\\s\\S]*?${markerPattern(END_MARKER)}`, 'g');
}

function mergeProjectInstructions(content, createPrefix = '') {
  const source = content || '';
  const matches = source.match(managedBlockPattern());
  if (matches?.length) return { content: source.replace(managedBlockPattern(), BLOCK), changed: source !== source.replace(managedBlockPattern(), BLOCK) };
  if (!source) return { content: `${createPrefix}${BLOCK}\n`, changed: true };
  const separator = source.endsWith('\n') ? '\n' : '\n\n';
  return { content: `${source}${separator}${BLOCK}\n`, changed: true };
}

function removeProjectInstructions(content) {
  const source = content || '';
  const withoutBlock = source.replace(managedBlockPattern(), '');
  if (withoutBlock === source) return { content: source, changed: false };
  const cleaned = withoutBlock.replace(/\n{3,}/g, '\n\n');
  return { content: cleaned.trim() ? cleaned : '', changed: true };
}

module.exports = {
  BLOCK,
  END_MARKER,
  INSTRUCTION_TEXT,
  START_MARKER,
  mergeProjectInstructions,
  removeProjectInstructions,
};
