const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "worker.js"), "utf8");

test("programming requests prioritize configured Gemini before anonymous providers", () => {
  const programming = source.indexOf("programming: isProgrammingGenerationRequest(messages)");
  const priority = source.indexOf("if (settings.programming && env.GEMINI_API_KEY)");
  const anonymous = source.indexOf("const kiloAttempts", priority);
  assert.ok(programming >= 0);
  assert.ok(priority > programming);
  assert.ok(anonymous > priority);
  assert.match(source, /if \(env\.GEMINI_API_KEY && !geminiAttempted\)/);
});

test("configured Kilo and LLM7 credentials are actually sent as Bearer tokens", () => {
  assert.match(source, /const kiloHeaders = env\.KILO_API_KEY\s*\?\s*\{ Authorization: "Bearer " \+ String\(env\.KILO_API_KEY\)\.trim\(\) \}/);
  assert.match(source, /headers: env\.LLM7_API_KEY\s*\?\s*\{ Authorization: "Bearer " \+ String\(env\.LLM7_API_KEY\)\.trim\(\) \}/);
  assert.match(source, /\.\.\.\(provider\.headers \|\| \{\}\)/);
});

test("programming requests receive a larger output cap while other requests stay unchanged", () => {
  assert.match(source, /settings\.programming \? 7000 : 4096/);
});

test("provider failure for programming returns a diagnostic instead of unrelated research text", () => {
  assert.match(source, /if \(codeTask \|\| buildMode\) \{[\s\S]{0,700}buildProgrammingProviderFailure\(prompt, modelError\)/);
  assert.match(source, /function buildProgrammingProviderFailure\(prompt, modelError\)/);
  assert.match(source, /No program was generated, compiled, or tested in this request/);
});
