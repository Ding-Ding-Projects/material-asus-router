// A small type generator in the spirit of quicktype: it infers one type model
// from one or many JSON samples (or a JSON Schema) and writes it as
// TypeScript, C#, Go, Python, Rust or Java. It runs locally with no network.
// No browser-only calls, so it is tested from Node.

// ---- the type model -----------------------------------------------------------
// { k: "prim", name: "string"|"int"|"float"|"bool"|"date"|"null"|"any" }
// { k: "array", item }   { k: "nullable", of }   { k: "object", props: Map }

const prim = (name) => ({ k: "prim", name });
const NULL = prim("null");
const ANY = prim("any");
const DATE_TIME = /^\d{4}-\d{2}-\d{2}([Tt ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?([Zz]|[+-]\d{2}:?\d{2})?)?$/;

export function inferValue(value, { inferDates = false } = {}) {
  if (value === null) return NULL;
  if (Array.isArray(value)) return { k: "array", item: value.map((v) => inferValue(v, { inferDates })).reduce((a, b) => unify(a, b), null) ?? ANY };
  switch (typeof value) {
    case "string": return prim(inferDates && DATE_TIME.test(value) ? "date" : "string");
    case "boolean": return prim("bool");
    case "number": return prim(Number.isInteger(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER ? "int" : "float");
    case "object": {
      const props = new Map();
      for (const [key, v] of Object.entries(value)) props.set(key, { type: inferValue(v, { inferDates }), optional: false });
      return { k: "object", props };
    }
    default: return ANY;
  }
}

const same = (a, b) => a.k === b.k && (a.k !== "prim" || a.name === b.name);
const isNull = (t) => t.k === "prim" && t.name === "null";

const strip = (t) => (t.k === "nullable" ? t.of : t);
const nullish = (t) => t.k === "nullable" || isNull(t);

function unifyCore(a, b) {
  if (a.k === "prim" && b.k === "prim") {
    if (a.name === b.name) return a;
    const pair = [a.name, b.name].sort().join("|");
    if (pair === "float|int") return prim("float");
    if (pair === "date|string") return prim("string");
    return ANY;
  }
  if (!same(a, b)) return ANY;
  if (a.k === "array") return { k: "array", item: unify(a.item, b.item) };
  const props = new Map();
  for (const [key, p] of a.props) props.set(key, b.props.has(key) ? { type: unify(p.type, b.props.get(key).type), optional: p.optional || b.props.get(key).optional } : { type: p.type, optional: true });
  for (const [key, p] of b.props) if (!a.props.has(key)) props.set(key, { type: p.type, optional: true });
  return { k: "object", props };
}

export function unify(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (isNull(a) && isNull(b)) return a;
  const x = isNull(a) ? null : strip(a);
  const y = isNull(b) ? null : strip(b);
  const core = x && y ? unifyCore(x, y) : x ?? y;
  return nullish(a) || nullish(b) ? { k: "nullable", of: core } : core;
}

// One type for every sample. samples: a list of already-parsed JSON values.
export function inferSamples(samples, options = {}) {
  return samples.map((s) => inferValue(s, options)).reduce((a, b) => unify(a, b), null) ?? ANY;
}

// ---- JSON Schema as a source ----------------------------------------------------

export function schemaToType(schema, root = schema, seen = new Set()) {
  if (schema === true || schema === undefined) return ANY;
  if (schema.$ref) {
    const target = String(schema.$ref).startsWith("#/") ? String(schema.$ref).slice(2).split("/").reduce((o, k) => o?.[k.replaceAll("~1", "/").replaceAll("~0", "~")], root) : null;
    if (!target) throw new Error(`The schema reference ${schema.$ref} points outside this document, which is not fetched.`);
    if (seen.has(schema.$ref)) return ANY;
    return schemaToType(target, root, new Set([...seen, schema.$ref]));
  }
  const options = schema.oneOf ?? schema.anyOf;
  if (options) return options.map((s) => schemaToType(s, root, seen)).reduce((a, b) => unify(a, b), null) ?? ANY;
  if (schema.enum) return prim("string");
  const type = Array.isArray(schema.type) ? schema.type : [schema.type];
  const parts = type.map((one) => {
    switch (one) {
      case "string": return prim(/date/.test(schema.format ?? "") ? "date" : "string");
      case "integer": return prim("int");
      case "number": return prim("float");
      case "boolean": return prim("bool");
      case "null": return NULL;
      case "array": return { k: "array", item: schema.items ? schemaToType(schema.items, root, seen) : ANY };
      case "object": case undefined: {
        if (!schema.properties) return one === "object" ? { k: "object", props: new Map() } : ANY;
        const required = new Set(schema.required ?? []);
        const props = new Map();
        for (const [key, sub] of Object.entries(schema.properties)) props.set(key, { type: schemaToType(sub, root, seen), optional: !required.has(key) });
        return { k: "object", props };
      }
      default: return ANY;
    }
  });
  return parts.reduce((a, b) => unify(a, b), null) ?? ANY;
}

// ---- names ----------------------------------------------------------------------

const words = (s) => String(s).replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/[^A-Za-z0-9]+/).filter(Boolean);
export const pascal = (s) => words(s).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join("") || "Item";
export const camel = (s) => { const p = pascal(s); return p[0].toLowerCase() + p.slice(1); };
export const snake = (s) => words(s).map((w) => w.toLowerCase()).join("_") || "field";
const singular = (s) => (/ies$/i.test(s) ? s.replace(/ies$/i, "y") : /(ss|us)$/i.test(s) ? s : /s$/i.test(s) ? s.slice(0, -1) : s);
const safeStart = (name) => (/^[0-9]/.test(name) ? `_${name}` : name);

// Walks the type, giving every object type a unique class name. Objects that
// have exactly the same shape share one class.
function nameClasses(type, rootName) {
  const classes = [];
  const bySignature = new Map();
  const used = new Set();
  const signature = (t) => (t.k === "prim" ? t.name : t.k === "array" ? `[${signature(t.item)}]` : t.k === "nullable" ? `?${signature(t.of)}` : `{${[...t.props].map(([k, p]) => `${k}${p.optional ? "?" : ""}:${signature(p.type)}`).join(",")}}`);
  function visit(t, hint) {
    if (t.k === "array") return { ...t, item: visit(t.item, singular(hint)) };
    if (t.k === "nullable") return { ...t, of: visit(t.of, hint) };
    if (t.k !== "object") return t;
    const props = new Map();
    for (const [key, p] of t.props) props.set(key, { ...p, type: visit(p.type, key) });
    const resolved = { k: "object", props };
    const sig = signature(resolved);
    if (bySignature.has(sig)) return { ...resolved, className: bySignature.get(sig) };
    let name = safeStart(pascal(hint));
    for (let n = 2; used.has(name); n += 1) name = `${safeStart(pascal(hint))}${n}`;
    used.add(name);
    bySignature.set(sig, name);
    classes.push({ name, props });
    return { ...resolved, className: name };
  }
  const top = visit(type, rootName);
  // Parents are written before their children is not required; roots first is nicer.
  const order = top.k === "object" ? [top.className, ...classes.map((c) => c.name).filter((n) => n !== top.className)] : classes.map((c) => c.name);
  return { top, classes: order.map((n) => classes.find((c) => c.name === n)) };
}

// ---- writers --------------------------------------------------------------------

const RESERVED = {
  typescript: new Set(["break", "case", "class", "const", "default", "delete", "enum", "export", "function", "if", "import", "in", "new", "return", "switch", "this", "type", "var", "void", "with"]),
  csharp: new Set(["class", "namespace", "object", "string", "int", "long", "bool", "event", "base", "default", "params", "ref", "out", "in", "is", "as", "new", "this", "lock", "operator"]),
  rust: new Set(["as", "break", "const", "continue", "crate", "else", "enum", "extern", "fn", "for", "if", "impl", "in", "let", "loop", "match", "mod", "move", "mut", "pub", "ref", "return", "self", "static", "struct", "super", "trait", "type", "unsafe", "use", "where", "while", "async", "await", "dyn"]),
  python: new Set(["and", "as", "assert", "class", "def", "del", "elif", "else", "except", "for", "from", "global", "if", "import", "in", "is", "lambda", "not", "or", "pass", "raise", "return", "try", "while", "with", "yield", "None", "True", "False"]),
  java: new Set(["class", "new", "int", "long", "double", "boolean", "default", "package", "public", "private", "static", "final", "void", "this", "super", "interface", "enum", "switch", "case", "return", "import", "extends"]),
};
const ident = (lang, name, transform) => {
  let out = safeStart(transform(name));
  if (RESERVED[lang]?.has(out)) out = lang === "rust" ? `r#${out}` : `${out}_`;
  return out;
};

function typescript(model, o) {
  const T = (t) => {
    if (t.k === "prim") return { string: "string", int: "number", float: "number", bool: "boolean", date: o.dateAsString ? "string" : "Date", null: "null", any: "unknown" }[t.name];
    if (t.k === "array") { const i = T(t.item); return /[|]/.test(i) ? `(${i})[]` : `${i}[]`; }
    if (t.k === "nullable") return `${T(t.of)} | null`;
    return t.className;
  };
  const key = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k));
  const body = model.classes.map((c) => `export interface ${c.name} {\n${[...c.props].map(([k, p]) => `  ${key(k)}${p.optional || o.allOptional ? "?" : ""}: ${T(p.type)};`).join("\n")}\n}`);
  if (model.top.k !== "object") body.unshift(`export type ${pascal(o.rootName)} = ${T(model.top)};`);
  return `${body.join("\n\n")}\n`;
}

function csharp(model, o) {
  const T = (t, nullable = false) => {
    const q = nullable ? "?" : "";
    if (t.k === "prim") return { string: "string", int: "long", float: "double", bool: "bool", date: "DateTimeOffset", null: "object", any: "object" }[t.name] + q;
    if (t.k === "array") return `List<${T(t.item)}>${q}`;
    if (t.k === "nullable") return T(t.of, true);
    return t.className + q;
  };
  const classes = model.classes.map((c) => `public class ${c.name}\n{\n${[...c.props].map(([k, p]) => `    [JsonPropertyName(${JSON.stringify(k)})]\n    public ${T(p.type, p.optional || o.allOptional)} ${ident("csharp", k, pascal)} { get; set; }`).join("\n\n")}\n}`);
  return `using System;\nusing System.Collections.Generic;\nusing System.Text.Json.Serialization;\n\n${classes.join("\n\n")}\n${model.top.k !== "object" ? `\n// The top-level value is ${T(model.top)}.\n` : ""}`;
}

function go(model, o) {
  let needsTime = false;
  const T = (t) => {
    if (t.k === "prim") { if (t.name === "date") needsTime = true; return { string: "string", int: "int64", float: "float64", bool: "bool", date: "time.Time", null: "interface{}", any: "interface{}" }[t.name]; }
    if (t.k === "array") return `[]${T(t.item)}`;
    if (t.k === "nullable") { const i = T(t.of); return /^(\[\]|interface)/.test(i) ? i : `*${i}`; }
    return t.className;
  };
  const classes = model.classes.map((c) => {
    const rows = [...c.props].map(([k, p]) => [ident("go", k, pascal), p.optional || o.allOptional ? (/^(\[\]|\*|interface)/.test(T(p.type)) ? T(p.type) : `*${T(p.type)}`) : T(p.type), `\`json:"${k}${p.optional || o.allOptional ? ",omitempty" : ""}"\``]);
    const w0 = Math.max(...rows.map((r) => r[0].length), 0);
    const w1 = Math.max(...rows.map((r) => r[1].length), 0);
    return `type ${c.name} struct {\n${rows.map((r) => `\t${r[0].padEnd(w0)} ${r[1].padEnd(w1)} ${r[2]}`).join("\n")}\n}`;
  });
  return `package ${o.packageName ?? "model"}\n\n${needsTime ? 'import "time"\n\n' : ""}${classes.join("\n\n")}\n`;
}

function python(model, o) {
  const T = (t) => {
    if (t.k === "prim") return { string: "str", int: "int", float: "float", bool: "bool", date: "datetime", null: "None", any: "Any" }[t.name];
    if (t.k === "array") return `List[${T(t.item)}]`;
    if (t.k === "nullable") return `Optional[${T(t.of)}]`;
    return t.className;
  };
  const classes = model.classes.map((c) => {
    const required = [...c.props].filter(([, p]) => !(p.optional || o.allOptional));
    const optional = [...c.props].filter(([, p]) => p.optional || o.allOptional);
    const fields = [...required, ...optional].map(([k, p]) => `    ${ident("python", k, snake)}: ${p.optional || o.allOptional ? `Optional[${T(p.type)}]` : T(p.type)}${p.optional || o.allOptional ? " = None" : ""}`);
    const conv = (t, expr) => (t.k === "object" ? `${t.className}.from_dict(${expr})` : t.k === "array" && (t.item.k === "object") ? `[${t.item.className}.from_dict(x) for x in ${expr}]` : t.k === "nullable" && t.of.k === "object" ? `${t.of.className}.from_dict(${expr}) if ${expr} is not None else None` : expr);
    const args = [...c.props].map(([k, p]) => `${ident("python", k, snake)}=${p.optional || o.allOptional ? `${conv(p.type, `data.get(${JSON.stringify(k)})`)}` : conv(p.type, `data[${JSON.stringify(k)}]`)}`);
    return `@dataclass\nclass ${c.name}:\n${fields.join("\n") || "    pass"}\n\n    @staticmethod\n    def from_dict(data: dict) -> "${c.name}":\n        return ${c.name}(${args.join(", ")})`;
  });
  return `from dataclasses import dataclass\nfrom datetime import datetime\nfrom typing import Any, List, Optional\n\n\n${classes.join("\n\n\n")}\n`;
}

function rust(model, o) {
  const T = (t) => {
    if (t.k === "prim") return { string: "String", int: "i64", float: "f64", bool: "bool", date: "String", null: "serde_json::Value", any: "serde_json::Value" }[t.name];
    if (t.k === "array") return `Vec<${T(t.item)}>`;
    if (t.k === "nullable") return `Option<${T(t.of)}>`;
    return t.className;
  };
  const classes = model.classes.map((c) => `#[derive(Serialize, Deserialize, Debug, Clone)]\npub struct ${c.name} {\n${[...c.props].map(([k, p]) => {
    const name = ident("rust", k, snake);
    const optional = p.optional || o.allOptional;
    const attrs = [name.replace(/^r#/, "") !== k ? `rename = ${JSON.stringify(k)}` : null, optional ? 'default, skip_serializing_if = "Option::is_none"' : null].filter(Boolean);
    return `${attrs.length ? `    #[serde(${attrs.join(", ")})]\n` : ""}    pub ${name}: ${optional && !T(p.type).startsWith("Option<") ? `Option<${T(p.type)}>` : T(p.type)},`;
  }).join("\n")}\n}`);
  return `use serde::{Deserialize, Serialize};\n\n${classes.join("\n\n")}\n`;
}

function java(model, o) {
  const T = (t, boxed = false) => {
    if (t.k === "prim") return { string: "String", int: boxed ? "Long" : "long", float: boxed ? "Double" : "double", bool: boxed ? "Boolean" : "boolean", date: "OffsetDateTime", null: "Object", any: "Object" }[t.name];
    if (t.k === "array") return `List<${T(t.item, true)}>`;
    if (t.k === "nullable") return T(t.of, true);
    return t.className;
  };
  const records = model.classes.map((c, i) => `${i === 0 ? "public " : ""}record ${c.name}(\n${[...c.props].map(([k, p]) => `    @JsonProperty(${JSON.stringify(k)}) ${T(p.type, p.optional || o.allOptional || p.type.k === "nullable")} ${ident("java", k, camel)}`).join(",\n")}\n) {}`);
  return `import com.fasterxml.jackson.annotation.JsonProperty;\nimport java.time.OffsetDateTime;\nimport java.util.List;\n\n${records.join("\n\n")}\n`;
}

export const LANGUAGES = [
  ["typescript", "TypeScript", "ts", typescript],
  ["csharp", "C#", "cs", csharp],
  ["go", "Go", "go", go],
  ["python", "Python", "py", python],
  ["rust", "Rust", "rs", rust],
  ["java", "Java", "java", java],
];

// source: "json" (one value, or a list treated as many samples when
// samplesAreList) or "schema". Returns { code, extension, model, classes }.
export function generate(text, language, options = {}) {
  const o = { rootName: "Root", allOptional: false, inferDates: false, samplesAreList: false, dateAsString: false, source: "json", ...options };
  const writer = LANGUAGES.find(([id]) => id === language);
  if (!writer) throw new Error(`There is no ${language} writer.`);
  let type;
  if (o.source === "schema") type = schemaToType(JSON.parse(text));
  else {
    const value = JSON.parse(text);
    type = o.samplesAreList && Array.isArray(value) ? inferSamples(value, o) : inferValue(value, o);
  }
  const model = nameClasses(type, o.rootName);
  return { code: writer[3](model, o), extension: writer[2], model, type };
}

// A readable outline of the inferred types, for the inspector.
export function describeType(t, depth = 0) {
  if (t.k === "prim") return t.name;
  if (t.k === "array") return `${describeType(t.item, depth)}[]`;
  if (t.k === "nullable") return `${describeType(t.of, depth)}?`;
  const pad = "  ".repeat(depth + 1);
  return `{\n${[...t.props].map(([k, p]) => `${pad}${k}${p.optional ? "?" : ""}: ${describeType(p.type, depth + 1)}`).join("\n")}\n${"  ".repeat(depth)}}`;
}

export const SOURCES = [
  ["json", "JSON samples", true],
  ["schema", "JSON Schema", true],
  ["typescript", "TypeScript", false, "Reading TypeScript needs a TypeScript parser, which is not bundled yet."],
  ["graphql", "GraphQL", false, "Reading GraphQL needs a GraphQL parser, which is not bundled yet."],
];
