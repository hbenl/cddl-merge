import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { MergeError, merge } from "../dist/merge.js";

/** Merge and return only the modified main part of the result. */
function mergeMain(main, extension) {
  const merged = merge(main, extension);
  return merged.slice(0, merged.length - extension.replace(/^\s*/, "").length).replace(/\s*$/, "");
}

function problems(main, extension, options) {
  try {
    merge(main, extension, options);
  } catch (error) {
    assert.ok(error instanceof MergeError, `expected a MergeError, got ${error}`);
    return error.problems;
  }
  assert.fail("expected merge to throw");
}

test("adds the extension group to a map", () => {
  assert.equal(
    mergeMain("Foo = {\n  a: int,\n}\n", "FooExtension = (\n  b: int,\n)\n"),
    "Foo = {\n  a: int,\n  FooExtension\n}",
  );
});

test("adds the extension group to a group", () => {
  assert.equal(
    mergeMain("Foo = (\n  a: int,\n)\n", "FooExtension = (\n  b: int,\n)\n"),
    "Foo = (\n  a: int,\n  FooExtension\n)",
  );
});

test("adds a separator when the last entry has none", () => {
  assert.equal(
    mergeMain("Foo = {\n  a: int\n}\n", "FooExtension = (\n  b: int,\n)\n"),
    "Foo = {\n  a: int,\n  FooExtension\n}",
  );
});

test("keeps the indentation of the extended rule", () => {
  assert.equal(
    mergeMain("Foo = {\n    a: int,\n}\n", "FooExtension = (b: int)\n"),
    "Foo = {\n    a: int,\n    FooExtension\n}",
  );
});

test("stays on one line for a single line rule", () => {
  assert.equal(mergeMain("Foo = {a: int}\n", "FooExtension = (b: int)\n"), "Foo = {a: int, FooExtension}");
});

test("extends an empty map", () => {
  assert.equal(mergeMain("Foo = {}\n", "FooExtension = (b: int)\n"), "Foo = { FooExtension}");
});

test("preserves comments and extends several rules", () => {
  const main = "; a comment\nFoo = {\n  a: int, ; trailing\n}\n\nBar = (\n  b: int,\n)\n";
  const extension = "FooExtension = (c: int)\n\nBarExtension = (d: int)\n";
  assert.equal(
    mergeMain(main, extension),
    "; a comment\nFoo = {\n  a: int, ; trailing\n  FooExtension\n}\n\nBar = (\n  b: int,\n  BarExtension\n)",
  );
});

test("appends the extension file unmodified", () => {
  const extension = "FooExtension = (\n  ? b: int, ; a comment\n)\n";
  const merged = merge("Foo = {a: int}\n", extension);
  assert.ok(merged.endsWith(`\n\n${extension}`), merged);
});

test("rejects an extension rule without the Extension suffix", () => {
  assert.deepEqual(problems("Foo = {a: int}", "Bar = (b: int)"), [
    'extension file defines "Bar", but it may only define groups whose name ends with "Extension"',
  ]);
});

test("rejects an extension rule that is not a group", () => {
  assert.deepEqual(problems("Foo = {a: int}", "FooExtension = {b: int}"), [
    '"FooExtension" in extension file must be a group, i.e. its definition must be wrapped in parentheses',
  ]);
});

test("rejects an extension rule without a corresponding rule", () => {
  assert.deepEqual(problems("Foo = {a: int}", "BarExtension = (b: int)"), [
    '"BarExtension" in extension file has no corresponding group or type "Bar" in main file',
  ]);
});

test("rejects an extension rule the main file already defines", () => {
  assert.deepEqual(problems("Foo = {a: int}\nFooExtension = (c: int)", "FooExtension = (b: int)"), [
    'main file already defines "FooExtension"',
  ]);
});

test("rejects a duplicate extension rule", () => {
  assert.deepEqual(problems("Foo = {a: int}", "FooExtension = (b: int)\nFooExtension = (c: int)"), [
    'extension file defines "FooExtension" more than once',
  ]);
});

test("rejects rules that cannot hold a group", () => {
  assert.deepEqual(
    problems("Foo = int\nBar = [*int]\nBaz = (int / text)\nQux = (a: int // b: int)", [
      "FooExtension = (c: int)",
      "BarExtension = (c: int)",
      "BazExtension = (c: int)",
      "QuxExtension = (c: int)",
    ].join("\n")),
    [
      '"Foo" in main file cannot be extended: it does not define a map or a group',
      '"Bar" in main file cannot be extended: it defines an array, where an added group would change the array\'s contents',
      '"Baz" in main file cannot be extended: it is a type choice, which cannot hold a group',
      '"Qux" in main file cannot be extended: it is a choice between 2 groups, so an extension cannot be added unambiguously',
    ],
  );
});

test("reports all problems at once", () => {
  assert.equal(problems("Foo = {a: int}", "Bar = (b: int)\nBazExtension = (c: int)").length, 2);
});

test("reports a parse error", () => {
  assert.match(problems("Foo = {", "FooExtension = (b: int)")[0], /^failed to parse main file: /);
});

test("uses the given file names in messages", () => {
  const [problem] = problems("Foo = {a: int}", "Bar = (b: int)", {
    mainName: "m.cddl",
    extensionName: "e.cddl",
  });
  assert.match(problem, /^e\.cddl defines "Bar"/);
});

test("merges the example files into parsable CDDL", () => {
  const main = readFileSync(new URL("../example/main.cddl", import.meta.url), "utf8");
  const extension = readFileSync(new URL("../example/extension.cddl", import.meta.url), "utf8");
  const merged = merge(main, extension);
  for (const name of [
    "browsingContext.InfoExtension",
    "session.CapabilityRequestExtension",
    "webExtension.InstallParametersExtension",
    "browsingContext.GetTreeParametersExtension",
  ]) {
    // Once as the added entry, once as the definition in the appended file.
    assert.equal(merged.split(new RegExp(`\\b${name.replace(".", "\\.")}\\b`)).length - 1, 2, name);
  }
});
