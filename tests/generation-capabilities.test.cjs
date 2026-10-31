const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "worker.js"), "utf8");
const focused = source.match(/function isFocusedCodeGenerationRequest\\(messages\\) \\{[\\s\\S]*?\\n\\}/);
const declaration = source.match(/function isProgrammingGenerationRequest\\(messages\\) \\{[\\s\\S]*?\\n\\}/);
assert.ok(focused && declaration, "both generation classifiers must exist");
const classify = new Function(focused[0] + "\\n" + declaration[0] + "\\nreturn isProgrammingGenerationRequest;")();

test("engineering generation budget covers direct code generation", () => {
  assert.equal(classify([{ role: "user", content: "Write a Python function and include unit tests." }]), true);
});

test("engineering generation budget covers app building, debugging and repository implementation", () => {
  for (const prompt of [
    "Build a complete Android application with local database and tests.",
    "Debug this Kotlin crash and repair the implementation.",
    "Inspect the GitHub repository and implement the requested feature.",
    "Refactor the JavaScript backend and run its test suite."
  ]) assert.equal(classify([{ role: "user", content: prompt }]), true, prompt);
});

test("research-only questions about software do not enter engineering generation routing", () => {
  for (const prompt of [
    "Research the latest Android APIs and compare their capabilities.",
    "Explain how GitHub Actions works.",
    "What are the current differences between Python and Java?"
  ]) assert.equal(classify([{ role: "user", content: prompt }]), false, prompt);
});

test("generation budgets support detailed responses and larger engineering deliverables", () => {
  assert.match(source, /providerTimeoutMs: isProgrammingGenerationRequest\\(messages\\) \\? 26000 : \\(Number\\(options\\.max_tokens \\|\\| 0\\) >= 5000 \\? 18000 : 14000\\)/);
  assert.match(source, /max_tokens: Math\\.min\\(settings\\.max_tokens \\|\\| 6000, settings\\.programming \\? 9000 : 6000\\)/);
});
