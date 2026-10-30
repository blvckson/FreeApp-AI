const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("programming generation gets the extended timeout classifier only", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "worker.js"), "utf8");
  const declaration = source.match(/function isProgrammingGenerationRequest\(messages\) \{[\s\S]*?\n\}/);
  assert.ok(declaration, "programming request classifier must exist");
  const classify = new Function("return (" + declaration[0] + ");")();

  assert.equal(classify([{ role: "user", content: "Write a Python function and include unit tests." }]), true);
  assert.equal(classify([{ role: "user", content: "Implement the algorithm in JavaScript." }]), true);
  assert.equal(classify([{ role: "user", content: "Explain the causes of inflation." }]), false);
  assert.equal(classify([{ role: "user", content: "Compare two historical events." }]), false);

  assert.match(source, /providerTimeoutMs: isProgrammingGenerationRequest\(messages\) \? 22000 : 10000/);
  assert.match(source, /Number\(settings\.providerTimeoutMs \|\| provider\.timeoutMs\)/);
});
