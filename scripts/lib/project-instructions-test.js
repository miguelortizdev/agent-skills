'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { BLOCK, END_MARKER, START_MARKER, mergeProjectInstructions, removeProjectInstructions } = require('./project-instructions');

test('creates the managed project instruction block without user content', () => {
  const result = mergeProjectInstructions('');
  assert.equal(result.content, `${BLOCK}\n`);
  assert.equal(result.content.split(START_MARKER).length - 1, 1);
  assert.equal(result.content.split(END_MARKER).length - 1, 1);
});

test('preserves user content and replaces one existing managed block', () => {
  const original = `# Project\n\n${BLOCK.replace('Project-level Skills extend the global engineering foundation; they do not replace it.', 'old managed text')}\n\nUser guidance\n`;
  const result = mergeProjectInstructions(original);
  assert.match(result.content, /^# Project/);
  assert.match(result.content, /User guidance/);
  assert.equal(result.content.split(START_MARKER).length - 1, 1);
  assert.equal(result.content.includes('old managed text'), false);
});

test('removes only the managed block and leaves surrounding content', () => {
  const result = removeProjectInstructions(`# Project\n\n${BLOCK}\n\nUser guidance\n`);
  assert.equal(result.content, '# Project\n\nUser guidance\n');
  assert.equal(result.changed, true);
});
