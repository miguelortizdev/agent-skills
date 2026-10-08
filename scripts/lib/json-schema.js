'use strict';

function typeMatches(value, type) {
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'array') return Array.isArray(value);
  if (type === 'integer') return Number.isInteger(value);
  return typeof value === type;
}

function validate(instance, schema, root = schema, location = '$') {
  if (schema.$ref) {
    const target = schema.$ref.replace('#/$defs/', '').split('.').reduce((value, key) => value?.[key], root.$defs);
    return validate(instance, target, root, location);
  }
  if (schema.allOf) for (const branch of schema.allOf) validate(instance, branch, root, location);
  if (schema.if) {
    let matches = true;
    try { validate(instance, schema.if, root, location); } catch { matches = false; }
    const branch = matches ? schema.then : schema.else;
    if (branch) validate(instance, branch, root, location);
  }
  if (schema.not) {
    try {
      validate(instance, schema.not, root, location);
      throw new Error(`${location} matches a forbidden schema`);
    } catch (error) {
      if (error.message.endsWith('matches a forbidden schema')) throw error;
    }
  }
  if (schema.anyOf && !schema.anyOf.some((branch) => { try { validate(instance, branch, root, location); return true; } catch { return false; } })) {
    throw new Error(`${location} does not match any allowed schema`);
  }
  if (schema.const !== undefined && instance !== schema.const) throw new Error(`${location} must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(instance)) throw new Error(`${location} must be one of ${schema.enum.join(', ')}`);
  if (schema.type && !typeMatches(instance, schema.type)) throw new Error(`${location} must be a ${schema.type}`);
  if (schema.minLength !== undefined && instance.length < schema.minLength) throw new Error(`${location} must not be empty`);
  if (schema.pattern && (typeof instance !== 'string' || !new RegExp(schema.pattern).test(instance))) throw new Error(`${location} has an invalid format`);
  if (schema.required) for (const key of schema.required) if (!Object.hasOwn(instance, key)) throw new Error(`${location}.${key} is required`);
  if (schema.properties && instance && typeof instance === 'object' && !Array.isArray(instance)) {
    for (const [key, child] of Object.entries(schema.properties)) if (Object.hasOwn(instance, key)) validate(instance[key], child, root, `${location}.${key}`);
  }
  if (schema.additionalProperties === false && instance && typeof instance === 'object' && !Array.isArray(instance)) {
    for (const key of Object.keys(instance)) if (!schema.properties || !Object.hasOwn(schema.properties, key)) throw new Error(`${location}.${key} is not allowed`);
  }
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object' && instance && typeof instance === 'object' && !Array.isArray(instance)) {
    for (const [key, value] of Object.entries(instance)) if (!schema.properties || !Object.hasOwn(schema.properties, key)) validate(value, schema.additionalProperties, root, `${location}.${key}`);
  }
  if (schema.items && Array.isArray(instance)) instance.forEach((value, index) => validate(value, schema.items, root, `${location}[${index}]`));
}

module.exports = { validate };
