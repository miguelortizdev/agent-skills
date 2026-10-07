'use strict';

function matchingSignals(context, rule) {
  const matchesPath = (actual, expected) => {
    if (rule.match === 'basename') return actual.split('/').pop() === expected.split('/').pop();
    if (rule.match === 'suffix') return actual === expected || actual.endsWith(`/${expected}`);
    return actual === expected;
  };
  return context.signals.filter((signal) => {
    if (rule.type === 'dependency') return signal.type === 'dependency' && rule.names.includes(signal.name) && (!rule.file || matchesPath(signal.file, rule.file));
    if (rule.type === 'file') return signal.type === 'file' && rule.paths.some((file) => matchesPath(signal.path, file));
    if (rule.type === 'text') return signal.type === 'text' && rule.files.some((file) => matchesPath(signal.file, file)) && rule.patterns.includes(signal.pattern);
    return false;
  });
}

function resolveContextualSkills(context, registry) {
  return (registry.assets || [])
    .filter((asset) => asset.type === 'skill' && asset.contextual && asset.enabled !== false)
    .flatMap((asset) => {
      const rules = asset.appliesWhen?.any || [];
      const matched = rules.flatMap((rule) => matchingSignals(context, rule));
      if (!matched.length) return [];
      return [{ id: asset.id, evidence: [...new Set(matched.map((signal) => signal.type === 'dependency' ? `${signal.file} -> dependency "${signal.name}"` : signal.type === 'file' ? signal.path : `${signal.file} -> ${signal.pattern}`))] }];
    });
}

module.exports = { resolveContextualSkills };
