const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "worker.js"), "utf8");

test("programming provider failure is reported honestly without invented code", () => {
  const declaration = source.match(/function buildProgrammingProviderFailure\(prompt, error\) \{[\s\S]*?\n\}/);
  assert.ok(declaration, "programming provider failure formatter must exist");
  const build = new Function("return (" + declaration[0] + ");")();
  const message = build("Write a Python function that reverses a string.", new Error("HTTP 429 from https://provider.example/v1"));
  assert.match(message, /couldn't generate the requested code/i);
  assert.match(message, /HTTP 429/);
  assert.doesNotMatch(message, /https:\/\/provider\.example/);
  assert.match(message, /No code was generated, executed, compiled, or tested/);
  assert.doesNotMatch(message, /def reverse|function reverse/);
});

test("programming provider failure does not get replaced by unrelated research evidence", () => {
  assert.match(source, /else if \(isProgrammingGenerationRequest\(messages\)\) \{\s*responseText = buildProgrammingProviderFailure\(prompt, modelError\);\s*programmingProviderUnavailable = true;/);
  assert.match(source, /if \(sources\.length && !programmingProviderUnavailable\)/);
  assert.match(source, /responseMode: programmingProviderUnavailable \? "provider-unavailable"/);
  assert.match(source, /generationUnavailable: programmingProviderUnavailable/);
});

test("non-programming fallback and existing provider timeout classification remain intact", () => {
  assert.match(source, /responseText = buildResearchOnlyFallback\(prompt, evidenceBrief, modelError\)/);
  assert.match(source, /providerTimeoutMs: isProgrammingGenerationRequest\(messages\) \? 22000 : 10000/);
  assert.match(source, /retryNetworkTimeouts: !isProgrammingGenerationRequest\(messages\)/);
});
