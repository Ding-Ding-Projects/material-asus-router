// quicktype-studio runs in the browser; this drives the type generator and the
// JSON tools from Node and checks the module is well formed and served.
import assert from "node:assert/strict";
import { test } from "node:test";
import { LANGUAGES, SOURCES, describeType, generate, inferSamples, pascal, schemaToType, snake, unify } from "../../public/js/features/quicktype-studio/generate.js";
import { EditHistory, addChild, findAll, jsonPath, parseInlineValue, parseLenient, pathToText, removeAt, renameKey, setAt, toTable, validateSchema } from "../../public/js/features/quicktype-studio/json-tools.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/quicktype-studio/index.js";
import { startApp } from "../helpers.mjs";

const sample = JSON.stringify({ id: 1, "user-name": "Pat", tags: ["a", "b"], owner: { name: "Alex", since: "2026-11-25" }, score: 4.5, nickname: null, items: [{ sku: "x", qty: 2 }, { sku: "y", qty: 3, note: "gift" }] });

test("names follow each language's style", () => {
  assert.equal(pascal("user-name"), "UserName");
  assert.equal(snake("userName"), "user_name");
});

test("inference merges samples: optional fields, nullable fields, numbers and mixed types", () => {
  const type = inferSamples([{ a: 1, b: "x" }, { a: 2.5, c: true }, { a: null, b: "y" }]);
  assert.equal(describeType(type), "{\n  a: float?\n  b?: string\n  c?: bool\n}");
  assert.equal(describeType(unify({ k: "prim", name: "int" }, { k: "prim", name: "string" })), "any");
  assert.equal(describeType(inferSamples([[1, 2], [3]])), "int[]");
  assert.equal(describeType(inferSamples([[]])), "any[]");
});

test("every language writes every field with the right type", () => {
  const out = Object.fromEntries(LANGUAGES.map(([id]) => [id, generate(sample, id, { inferDates: true }).code]));
  assert.match(out.typescript, /export interface Root \{\n {2}id: number;\n {2}"user-name": string;\n {2}tags: string\[\];\n {2}owner: Owner;/);
  assert.match(out.typescript, /nickname: null;/);
  assert.match(out.typescript, /export interface Item \{\n {2}sku: string;\n {2}qty: number;\n {2}note\?: string;/);
  assert.match(out.typescript, /since: Date;/);
  assert.match(out.csharp, /\[JsonPropertyName\("user-name"\)\]\n {4}public string UserName \{ get; set; \}/);
  assert.match(out.csharp, /public List<Item> Items/);
  assert.match(out.csharp, /public string\? Note/);
  assert.match(out.csharp, /DateTimeOffset Since/);
  assert.match(out.go, /type Root struct \{/);
  assert.match(out.go, /UserName\s+string\s+`json:"user-name"`/);
  assert.match(out.go, /Note\s+\*string\s+`json:"note,omitempty"`/);
  assert.match(out.go, /import "time"/);
  assert.match(out.python, /@dataclass\nclass Root:/);
  assert.match(out.python, /user_name: str/);
  assert.match(out.python, /note: Optional\[str\] = None/);
  assert.match(out.python, /items=\[Item\.from_dict\(x\) for x in data\["items"\]\]/);
  assert.match(out.rust, /#\[serde\(rename = "user-name"\)\]\n {4}pub user_name: String,/);
  assert.match(out.rust, /pub tags: Vec<String>,/);
  assert.match(out.rust, /#\[serde\(default, skip_serializing_if = "Option::is_none"\)\]\n {4}pub note: Option<String>,/);
  assert.match(out.java, /public record Root\(/);
  assert.match(out.java, /@JsonProperty\("user-name"\) String userName/);
  assert.match(out.java, /List<Item> items/);
  assert.match(out.java, /record Item\(/);
});

test("shapes that repeat share one class; reserved words are escaped", () => {
  const code = generate('{"a": {"x": 1}, "b": {"x": 2}, "type": 1}', "typescript").code;
  assert.equal((code.match(/export interface/g) ?? []).length, 2, "A and B share one shape");
  assert.match(generate('{"type": 1, "match": 2}', "rust").code, /pub r#type: i64/);
  assert.match(generate('{"class": "x"}', "csharp").code, /public string Class\b/);
});

test("many samples and everything-optional change the output", () => {
  const list = JSON.stringify([{ a: 1, b: 2 }, { a: 3 }]);
  assert.match(generate(list, "typescript", { samplesAreList: true }).code, /b\?: number;/);
  assert.match(generate('{"a": 1}', "typescript", { allOptional: true }).code, /a\?: number;/);
  assert.match(generate('{"a": 1}', "typescript", { rootName: "My Thing" }).code, /interface MyThing/);
  assert.match(generate("[1,2]", "typescript").code, /export type Root = number\[\];/);
});

test("JSON Schema is a working source, with references, required and nullable types", () => {
  const schema = { $defs: { Owner: { type: "object", required: ["name"], properties: { name: { type: "string" } } } }, type: "object", required: ["id"], properties: { id: { type: "integer" }, owner: { $ref: "#/$defs/Owner" }, when: { type: "string", format: "date-time" }, kind: { enum: ["a", "b"] }, maybe: { type: ["string", "null"] } } };
  const code = generate(JSON.stringify(schema), "typescript", { source: "schema" }).code;
  assert.match(code, /id: number;/);
  assert.match(code, /owner\?: Owner;/);
  assert.match(code, /when\?: Date;/);
  assert.match(code, /kind\?: string;/);
  assert.match(code, /maybe\?: string \| null;/);
  assert.throws(() => schemaToType({ $ref: "other.json#/x" }), /outside this document/);
  assert.throws(() => generate("{", "typescript"), /JSON/);
  assert.throws(() => generate("{}", "cobol"), /no cobol writer/);
  assert.equal(SOURCES.filter(([, , ok]) => !ok).map((s) => s[0]).join(), "typescript,graphql", "the unbuilt sources are shown, disabled, with a reason");
});

test("lenient parsing tolerates comments, trailing commas and single quotes, and reports where it fails", () => {
  const ok = parseLenient("{ // c\n 'a': [1, 2,], /* x */ \"b\": \"it's\", }");
  assert.deepEqual(ok.value, { a: [1, 2], b: "it's" });
  assert.ok(ok.warnings.length >= 3);
  const bad = parseLenient('{\n  "a": 1\n  "b": 2\n}');
  assert.equal(bad.value, undefined);
  assert.equal(bad.error.line >= 1, true);
  assert.deepEqual(parseLenient("[1]").warnings, []);
});

test("JSONPath selects by name, index, slice, wildcard and recursive descent", () => {
  const doc = { store: { book: [{ title: "A", price: 5 }, { title: "B", price: 9 }, { title: "C", price: 1 }], bike: { price: 20 } } };
  const paths = (e) => jsonPath(doc, e).map((x) => x.path);
  assert.deepEqual(paths("$.store.bike.price"), ["$.store.bike.price"]);
  assert.deepEqual(paths("$.store.book[1].title"), ["$.store.book[1].title"]);
  assert.deepEqual(paths("$.store.book[-1].title"), ["$.store.book[2].title"]);
  assert.deepEqual(paths("$.store.book[0:2].title"), ["$.store.book[0].title", "$.store.book[1].title"]);
  assert.equal(jsonPath(doc, "$.store.book[*].price").map((x) => x.value).join(), "5,9,1");
  assert.equal(jsonPath(doc, "$..price").length, 4);
  assert.equal(jsonPath(doc, "$['store']['bike']").length, 1);
  assert.deepEqual(paths("$.nothing"), []);
  assert.throws(() => jsonPath(doc, "store"), /starts with/);
  assert.throws(() => jsonPath(doc, "$.store.book[?(@.price>1)]"), /Unsupported/);
});

test("schema validation reports each problem with its path", () => {
  const schema = { type: "object", required: ["id", "name"], additionalProperties: false, properties: { id: { type: "integer", minimum: 1 }, name: { type: "string", minLength: 2, pattern: "^[A-Z]" }, tags: { type: "array", items: { type: "string" }, maxItems: 2, uniqueItems: true }, kind: { enum: ["a", "b"] } } };
  assert.deepEqual(validateSchema({ id: 1, name: "Pat" }, schema), []);
  const errors = validateSchema({ id: 0, name: "p", tags: ["x", "x", 3], kind: "z", extra: 1 }, schema);
  const text = errors.map((e) => `${e.path}: ${e.message}`).join("\n");
  assert.match(text, /\$\.id: Must be at least 1/);
  assert.match(text, /\$\.name: Must have at least 2 characters/);
  assert.match(text, /\$\.name: Must match \^\[A-Z\]/);
  assert.match(text, /\$\.tags: Allows at most 2 items/);
  assert.match(text, /\$\.tags: Items must be unique/);
  assert.match(text, /\$\.tags\[2\]: Expected string, found integer/);
  assert.match(text, /\$\.kind: Must be one of/);
  assert.match(text, /\$\.extra: This property is not allowed/);
  assert.match(validateSchema({}, schema).map((e) => e.path).join(), /\$\.id,\$\.name/);
  assert.equal(validateSchema(1, { anyOf: [{ type: "string" }, { type: "boolean" }] })[0].message, "Matches none of the allowed shapes.");
  assert.equal(validateSchema("x", { $ref: "#/missing" })[0].message, "Cannot resolve #/missing.");
});

test("tree edits never change the original, and undo and redo walk the history", () => {
  const doc = { a: 1, list: [1, 2], nested: { b: 2 } };
  const set = setAt(doc, ["nested", "b"], { x: 1 });
  assert.deepEqual(set.nested.b, { x: 1 });
  assert.equal(doc.nested.b, 2, "the original is untouched");
  assert.deepEqual(removeAt(doc, ["list", 0]).list, [2]);
  assert.deepEqual(Object.keys(renameKey(doc, ["a"], "z")), ["z", "list", "nested"], "renaming keeps the order");
  assert.throws(() => renameKey(doc, ["a"], "list"), /already used/);
  assert.deepEqual(addChild(doc, ["list"], null, 3).list, [1, 2, 3]);
  assert.throws(() => addChild(doc, [], "a", 1), /already used/);
  assert.throws(() => removeAt(doc, []), /root/);
  assert.equal(pathToText(["a", 0, "b c"]), "$.a[0]['b c']");
  assert.equal(parseInlineValue("12"), 12);
  assert.equal(parseInlineValue("hello"), "hello");
  const history = new EditHistory({ n: 0 });
  assert.equal(history.push({ n: 1 }), true);
  assert.equal(history.push({ n: 1 }), false, "no change, no history entry");
  history.push({ n: 2 });
  assert.deepEqual([history.undo(), history.undo(), history.undo()], [{ n: 1 }, { n: 0 }, { n: 0 }]);
  assert.deepEqual(history.redo(), { n: 1 });
  history.push({ n: 9 });
  assert.equal(history.canRedo, false, "a new edit clears the redo list");
});

test("the table view and find (plain and regular expression) work", () => {
  const table = toTable([{ a: 1, b: { c: 2 } }, { a: 3, d: "x" }]);
  assert.deepEqual(table.columns, ["a", "b", "d"]);
  assert.deepEqual(table.rows, [["1", '{"c":2}', ""], ["3", "", "x"]]);
  const doc = { name: "Pat", pets: [{ kind: "one" }, { kind: "emu" }], note: "pastry" };
  assert.deepEqual(findAll(doc, "KIND").hits.map((h) => pathToText(h.path)), ["$.pets[0].kind", "$.pets[1].kind"]);
  assert.deepEqual(findAll(doc, "^e", { regex: true, keys: false }).hits.map((h) => pathToText(h.path)), ["$.pets[1].kind"]);
  assert.match(findAll(doc, "(", { regex: true }).error, /./);
  assert.equal(findAll(doc, "").hits.length, 0);
});

test("the module is well formed, listed in the manifest and served", async () => {
  assert.equal(checkFeatureModule(feature, "quicktype-studio"), null);
  const t = await startApp();
  try {
    assert.ok((await t.owner.get("/api/features/manifest")).data.modules.includes("/js/features/quicktype-studio/index.js"));
    for (const file of ["generate.js", "json-tools.js"]) assert.equal((await fetch(`${t.base}/js/features/quicktype-studio/${file}`)).status, 200);
  } finally {
    await t.stop();
  }
});
