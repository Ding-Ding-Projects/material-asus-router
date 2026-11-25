// The pure half of the JSON editor: lenient parsing with error positions,
// JSONPath, schema validation, immutable tree edits, undo history, a table
// view and regex find. No browser-only calls, so it is tested from Node.

// ---- parsing ---------------------------------------------------------------------

function lineColumn(text, position) {
  const before = text.slice(0, position);
  const line = before.split("\n").length;
  return { line, column: position - before.lastIndexOf("\n") };
}

// Strict first. Then, because pasted JSON often has them, comments, trailing
// commas and single-quoted strings are accepted, and each is reported as a
// warning so nothing is changed silently.
export function parseLenient(text) {
  try {
    return { value: JSON.parse(text), warnings: [], error: null };
  } catch (strict) {
    const warnings = [];
    let out = "";
    let i = 0;
    while (i < text.length) {
      const c = text[i];
      if (c === '"' || c === "'") {
        let j = i + 1;
        let body = "";
        while (j < text.length && text[j] !== c) {
          if (text[j] === "\\") { body += text.slice(j, j + 2); j += 2; } else { body += text[j]; j += 1; }
        }
        if (c === "'") {
          warnings.push({ message: "Single-quoted string read as a normal string.", ...lineColumn(text, i) });
          out += JSON.stringify(body.replaceAll("\\'", "'"));
        } else out += text.slice(i, j + 1);
        i = j + 1;
      } else if (c === "/" && text[i + 1] === "/") {
        warnings.push({ message: "Line comment ignored.", ...lineColumn(text, i) });
        while (i < text.length && text[i] !== "\n") i += 1;
      } else if (c === "/" && text[i + 1] === "*") {
        warnings.push({ message: "Block comment ignored.", ...lineColumn(text, i) });
        const end = text.indexOf("*/", i + 2);
        i = end < 0 ? text.length : end + 2;
      } else {
        out += c;
        i += 1;
      }
    }
    const fixed = out.replace(/,(\s*[}\]])/g, (m, tail, at) => {
      warnings.push({ message: "Trailing comma ignored.", line: 0, column: 0 });
      return tail;
    });
    try {
      return { value: JSON.parse(fixed), warnings, error: null };
    } catch {
      const m = /position (\d+)/.exec(strict.message);
      const where = m ? lineColumn(text, Number(m[1])) : { line: 1, column: 1 };
      return { value: undefined, warnings: [], error: { message: strict.message, ...where } };
    }
  }
}

export const stringify = (value, indent = 2) => JSON.stringify(value, null, indent);

// ---- JSONPath (the common subset) ------------------------------------------------

export function jsonPath(root, expression) {
  const text = expression.trim();
  if (!text.startsWith("$")) throw new Error('A JSONPath starts with "$".');
  let results = [{ path: "$", value: root }];
  let i = 1;
  const isObj = (v) => v !== null && typeof v === "object";
  const children = (node) => (Array.isArray(node.value) ? node.value.map((v, n) => ({ path: `${node.path}[${n}]`, value: v })) : isObj(node.value) ? Object.entries(node.value).map(([k, v]) => ({ path: `${node.path}.${k}`, value: v })) : []);
  const descendants = (node) => [node, ...children(node).flatMap(descendants)];
  while (i < text.length) {
    if (text.startsWith("..", i)) {
      i += 2;
      const m = /^([A-Za-z_$][\w$-]*|\*)/.exec(text.slice(i));
      if (!m) throw new Error(`Expected a name after ".." at position ${i}.`);
      i += m[0].length;
      results = results.flatMap(descendants).flatMap(children).filter((n) => m[0] === "*" || n.path.endsWith(`.${m[0]}`) || n.path.endsWith(`['${m[0]}']`));
    } else if (text[i] === ".") {
      i += 1;
      const m = /^([A-Za-z_$][\w$-]*|\*)/.exec(text.slice(i));
      if (!m) throw new Error(`Expected a name after "." at position ${i}.`);
      i += m[0].length;
      results = results.flatMap((n) => (m[0] === "*" ? children(n) : isObj(n.value) && !Array.isArray(n.value) && m[0] in n.value ? [{ path: `${n.path}.${m[0]}`, value: n.value[m[0]] }] : []));
    } else if (text[i] === "[") {
      const end = text.indexOf("]", i);
      if (end < 0) throw new Error(`The "[" at position ${i} is never closed.`);
      const inner = text.slice(i + 1, end).trim();
      i = end + 1;
      if (inner === "*") results = results.flatMap(children);
      else if (/^(['"]).*\1$/.test(inner)) {
        const key = inner.slice(1, -1);
        results = results.flatMap((n) => (isObj(n.value) && !Array.isArray(n.value) && key in n.value ? [{ path: `${n.path}['${key}']`, value: n.value[key] }] : []));
      } else if (/^-?\d+$/.test(inner)) {
        results = results.flatMap((n) => {
          if (!Array.isArray(n.value)) return [];
          const at = Number(inner) < 0 ? n.value.length + Number(inner) : Number(inner);
          return at >= 0 && at < n.value.length ? [{ path: `${n.path}[${at}]`, value: n.value[at] }] : [];
        });
      } else if (/^-?\d*:-?\d*$/.test(inner)) {
        const [a, b] = inner.split(":").map((x) => (x === "" ? undefined : Number(x)));
        results = results.flatMap((n) => (Array.isArray(n.value) ? n.value.slice(a, b).map((v, k) => ({ path: `${n.path}[${(a ?? 0) < 0 ? n.value.length + a + k : (a ?? 0) + k}]`, value: v })) : []));
      } else throw new Error(`Unsupported selector [${inner}]. Names, indexes, slices and * are supported.`);
    } else throw new Error(`Unexpected "${text[i]}" at position ${i}.`);
  }
  return results;
}

// ---- JSON Schema validation (the practical subset) -------------------------------

const typeOf = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : Number.isInteger(v) ? "integer" : typeof v);
const matches = (v, type) => (type === "number" ? typeof v === "number" : type === "integer" ? Number.isInteger(v) : typeOf(v) === type);

export function validateSchema(value, schema, root = schema, path = "$", errors = []) {
  const fail = (message) => errors.push({ path, message });
  if (schema === true || schema === undefined) return errors;
  if (schema === false) return fail("No value is allowed here."), errors;
  if (schema.$ref) {
    const target = String(schema.$ref).startsWith("#/") ? String(schema.$ref).slice(2).split("/").reduce((o, k) => o?.[k], root) : undefined;
    if (!target) fail(`Cannot resolve ${schema.$ref}.`);
    else validateSchema(value, target, root, path, errors);
    return errors;
  }
  if (schema.type !== undefined) {
    const types = [].concat(schema.type);
    if (!types.some((t) => matches(value, t))) { fail(`Expected ${types.join(" or ")}, found ${typeOf(value)}.`); return errors; }
  }
  if (schema.enum && !schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(value))) fail(`Must be one of ${schema.enum.map((e) => JSON.stringify(e)).join(", ")}.`);
  if (schema.const !== undefined && JSON.stringify(schema.const) !== JSON.stringify(value)) fail(`Must equal ${JSON.stringify(schema.const)}.`);
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) fail(`Must be at least ${schema.minimum}.`);
    if (schema.maximum !== undefined && value > schema.maximum) fail(`Must be at most ${schema.maximum}.`);
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) fail(`Must be greater than ${schema.exclusiveMinimum}.`);
    if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) fail(`Must be less than ${schema.exclusiveMaximum}.`);
    if (schema.multipleOf && value % schema.multipleOf !== 0) fail(`Must be a multiple of ${schema.multipleOf}.`);
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) fail(`Must have at least ${schema.minLength} characters.`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) fail(`Must have at most ${schema.maxLength} characters.`);
    if (schema.pattern) {
      try {
        if (!new RegExp(schema.pattern).test(value)) fail(`Must match ${schema.pattern}.`);
      } catch {
        fail(`The schema's pattern ${schema.pattern} is not a valid expression.`);
      }
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) fail(`Needs at least ${schema.minItems} items.`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) fail(`Allows at most ${schema.maxItems} items.`);
    if (schema.uniqueItems && new Set(value.map((v) => JSON.stringify(v))).size !== value.length) fail("Items must be unique.");
    if (schema.items) value.forEach((item, n) => validateSchema(item, schema.items, root, `${path}[${n}]`, errors));
  } else if (value !== null && typeof value === "object") {
    for (const key of schema.required ?? []) if (!(key in value)) errors.push({ path: `${path}.${key}`, message: "This property is required." });
    for (const [key, sub] of Object.entries(schema.properties ?? {})) if (key in value) validateSchema(value[key], sub, root, `${path}.${key}`, errors);
    if (schema.additionalProperties === false) for (const key of Object.keys(value)) if (!(key in (schema.properties ?? {}))) errors.push({ path: `${path}.${key}`, message: "This property is not allowed." });
  }
  for (const [word, all] of [["allOf", true], ["anyOf", false], ["oneOf", false]]) {
    if (!schema[word]) continue;
    const results = schema[word].map((s) => validateSchema(value, s, root, path, []));
    const passing = results.filter((r) => !r.length).length;
    if (all && passing !== results.length) results.forEach((r) => errors.push(...r));
    else if (word === "anyOf" && !passing) fail("Matches none of the allowed shapes.");
    else if (word === "oneOf" && passing !== 1) fail(passing ? "Matches more than one of the allowed shapes." : "Matches none of the allowed shapes.");
  }
  return errors;
}

// ---- immutable tree edits -----------------------------------------------------------

const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

// path is a list of keys and indexes from the root.
export function getAt(root, path) {
  return path.reduce((node, key) => node?.[key], root);
}

export function setAt(root, path, value) {
  if (!path.length) return clone(value);
  const next = clone(root);
  const parent = getAt(next, path.slice(0, -1));
  if (parent === null || typeof parent !== "object") throw new Error("That position does not exist.");
  parent[path.at(-1)] = clone(value);
  return next;
}

export function removeAt(root, path) {
  if (!path.length) throw new Error("The root cannot be removed.");
  const next = clone(root);
  const parent = getAt(next, path.slice(0, -1));
  if (Array.isArray(parent)) parent.splice(path.at(-1), 1);
  else delete parent[path.at(-1)];
  return next;
}

export function renameKey(root, path, newKey) {
  const next = clone(root);
  const parent = getAt(next, path.slice(0, -1));
  const old = path.at(-1);
  if (Array.isArray(parent)) throw new Error("List items have positions, not names.");
  if (newKey === old) return next;
  if (newKey in parent) throw new Error(`"${newKey}" is already used in this object.`);
  const entries = Object.entries(parent).map(([k, v]) => [k === old ? newKey : k, v]);
  for (const k of Object.keys(parent)) delete parent[k];
  for (const [k, v] of entries) parent[k] = v;
  return next;
}

export function addChild(root, path, key, value) {
  const next = clone(root);
  const parent = path.length ? getAt(next, path) : next;
  if (Array.isArray(parent)) parent.push(clone(value));
  else if (parent !== null && typeof parent === "object") {
    if (key in parent) throw new Error(`"${key}" is already used in this object.`);
    parent[key] = clone(value);
  } else throw new Error("Only objects and lists can hold children.");
  return next;
}

// Converts what a person typed into a JSON value: JSON when it parses,
// otherwise the text itself as a string.
export function parseInlineValue(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const pathToText = (path) => path.reduce((out, key) => (typeof key === "number" ? `${out}[${key}]` : /^[A-Za-z_$][\w$]*$/.test(key) ? `${out}.${key}` : `${out}['${key}']`), "$");

// ---- undo and redo --------------------------------------------------------------------

export class EditHistory {
  constructor(initial, limit = 200) {
    this.limit = limit;
    this.past = [];
    this.future = [];
    this.current = JSON.stringify(initial ?? null);
  }

  get value() { return JSON.parse(this.current); }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  push(value) {
    const next = JSON.stringify(value);
    if (next === this.current) return false;
    this.past.push(this.current);
    if (this.past.length > this.limit) this.past.shift();
    this.current = next;
    this.future = [];
    return true;
  }
  undo() { if (this.canUndo) { this.future.push(this.current); this.current = this.past.pop(); } return this.value; }
  redo() { if (this.canRedo) { this.past.push(this.current); this.current = this.future.pop(); } return this.value; }
}

// ---- table view and find ----------------------------------------------------------------

export function toTable(value) {
  const rows = Array.isArray(value) ? value : value !== null && typeof value === "object" ? Object.entries(value).map(([key, v]) => ({ key, value: v })) : [{ value }];
  const columns = [];
  for (const row of rows) for (const k of row !== null && typeof row === "object" && !Array.isArray(row) ? Object.keys(row) : ["value"]) if (!columns.includes(k)) columns.push(k);
  const cell = (v) => (v !== null && typeof v === "object" ? JSON.stringify(v) : v === undefined ? "" : String(v));
  return { columns, rows: rows.map((row) => columns.map((c) => (row !== null && typeof row === "object" && !Array.isArray(row) ? cell(row[c]) : c === "value" ? cell(row) : ""))) };
}

// Finds keys and/or values that match a plain text or regular expression.
export function findAll(root, query, { regex = false, flags = "i", keys = true, values = true } = {}) {
  if (!query) return { hits: [], error: null };
  let test;
  if (regex) {
    if (query.length > 200) return { hits: [], error: "The pattern is longer than 200 characters." };
    try {
      const re = new RegExp(query, flags.replace(/[^imsu]/g, ""));
      test = (s) => re.test(s);
    } catch (error) {
      return { hits: [], error: error.message };
    }
  } else test = (s) => s.toLowerCase().includes(query.toLowerCase());
  const hits = [];
  const walk = (node, path) => {
    if (hits.length >= 500) return;
    if (node !== null && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        const here = [...path, Array.isArray(node) ? Number(k) : k];
        if (keys && !Array.isArray(node) && test(k)) hits.push({ path: here, where: "key" });
        walk(v, here);
      }
    } else if (values && test(String(node))) hits.push({ path, where: "value" });
  };
  walk(root, []);
  return { hits, error: null };
}
