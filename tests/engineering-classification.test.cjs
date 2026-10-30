const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const match = source.match(/function isSoftwareEngineeringRequest\\(prompt\\) \\{[\\s\\S]*?\\n\\}/);
assert.ok(match, "engineering request classifier must exist");
const classify = vm.runInNewContext("(" + match[0] + "; isSoftwareEngineeringRequest)");

test("engineering classifier recognises common coding and repository tasks", () => {
  for (const prompt of [
    "Build a complete Android app",
    "Fix this JavaScript bug",
    "Write code for a sorting algorithm",
    "Debug my API backend",
    "Commit changes to GitHub",
    "Create a test suite"
  ]) assert.equal(classify(prompt), true, prompt);
});

test("engineering classifier is case-insensitive and uses word boundaries", () => {
  assert.equal(classify("IMPLEMENT a feature"), true);
  assert.equal(classify("The application needs a workflow"), true);
  assert.equal(classify("I like apples"), false);
  assert.equal(classify("A happy day"), false);
});
