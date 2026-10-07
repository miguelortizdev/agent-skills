'use strict';

const MAX_RULE_DEPTH = 8;

function matchesPath(actual, expected, mode) {
  if (mode === 'basename') return actual.split('/').pop() === expected.split('/').pop();
  if (mode === 'suffix') return actual === expected || actual.endsWith(`/${expected}`);
  return actual === expected;
}

function evidenceForFile(path) {
  return path;
}

function evaluateMatch(context, rule) {
  const evidence = [];
  if (rule.type === 'file') {
    for (const actual of context.files) {
      for (const expected of rule.paths) {
        if (matchesPath(actual, expected, rule.match)) evidence.push(evidenceForFile(actual));
      }
    }
  } else if (rule.type === 'path') {
    for (const actual of [...context.files, ...context.directories]) {
      for (const expected of rule.paths) {
        if (matchesPath(actual, expected, rule.match)) evidence.push(evidenceForFile(actual));
      }
    }
  } else if (rule.type === 'dependency') {
    for (const dependency of context.dependencies) {
      if (!rule.names.includes(dependency.name)) continue;
      if (rule.file && !matchesPath(dependency.file, rule.file, rule.match)) continue;
      evidence.push(`${dependency.file} -> dependency "${dependency.name}"`);
    }
  } else if (rule.type === 'text') {
    for (const text of context.texts) {
      if (!rule.files.some((file) => matchesPath(text.file, file, rule.match))) continue;
      for (const pattern of rule.patterns) {
        if (text.content.includes(pattern)) evidence.push(`${text.file} -> ${pattern}`);
      }
    }
  }
  return { matched: evidence.length > 0, evidence };
}

function evaluateRule(context, rule, depth = 0) {
  if (!rule || depth > MAX_RULE_DEPTH) return { matched: false, evidence: [] };
  if (rule.type) return evaluateMatch(context, rule);

  const allOf = rule.allOf ? rule.allOf.map((child) => evaluateRule(context, child, depth + 1)) : [];
  const anyOf = rule.anyOf ? rule.anyOf.map((child) => evaluateRule(context, child, depth + 1)) : [];
  const noneOf = rule.noneOf ? rule.noneOf.map((child) => evaluateRule(context, child, depth + 1)) : [];
  const hasAll = !rule.allOf || allOf.every((result) => result.matched);
  const hasAny = !rule.anyOf || anyOf.some((result) => result.matched);
  const hasNone = !rule.noneOf || noneOf.every((result) => !result.matched);
  const evidence = [
    ...allOf.filter((result) => result.matched).flatMap((result) => result.evidence),
    ...anyOf.filter((result) => result.matched).flatMap((result) => result.evidence),
  ];
  return { matched: hasAll && hasAny && hasNone, evidence };
}

function resolveContextualSkills(context, registry) {
  return (registry.assets || [])
    .filter((asset) => asset.type === 'skill' && asset.contextual && asset.enabled !== false)
    .flatMap((asset) => {
      const result = evaluateRule(context, asset.appliesWhen);
      if (!result.matched) return [];
      return [{ id: asset.id, evidence: [...new Set(result.evidence)] }];
    });
}

module.exports = { resolveContextualSkills, evaluateRule };
