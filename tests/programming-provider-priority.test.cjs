const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "..", "worker.js"), "utf8");

test("programming requests prioritize configured Gemini before anonymous gateways", () => {
  const programming = source.indexOf("programming: isProgrammingGenerationRequest(messages)");
  const priority = source.indexOf("if (settings.programming && env.GEMINI_API_KEY)");
  const anonymous = source.indexOf("const kiloAttempts", priority);
  assert.ok(programming >= 0, "programming mode must be explicit");
  assert.ok(priority > programming, "configured Gemini priority must follow request classification");
  assert.ok(anonymous > priority, "Gemini priority must precede anonymous gateway probing");
  assert.match(source, /if \(env\.GEMINI_API_KEY && !geminiAttempted\)/);
});

test("programming output allowance is larger without changing other request budgets", () => {
  assert.match(source, /settings\.programming \? 7000 : 4096/);
  assert.match(source, /providerTimeoutMs: isProgrammingGenerationRequest\(messages\) \? 22000 : 10000/);
  assert.match(source, /retryNetworkTimeouts: !isProgrammingGenerationRequest\(messages\)/);
});

test("configured Kilo and LLM7 credentials are attached only when present", () => {
  assert.match(source, /const kiloHeaders = env\.KILO_API_KEY\s*\? \{ Authorization: "Bearer "/);
  assert.match(source, /headers: env\.LLM7_API_KEY\s*\? \{ Authorization: "Bearer "/);
  assert.match(source, /\.\.\.\(provider\.headers \|\| \{\}\)/);
});

test("programming provider failure is explicit and sanitizes credential-like values", () => {
  const declaration = source.match(/function buildProgrammingProviderFailure\(prompt, modelError\) \{[\s\S]*?\n\}/);
  assert.ok(declaration, "programming failure formatter must exist");
  const build = new Function("return (" + declaration[0] + ");")();
  const result = build("Write a function.", new Error("authorization: Bearer secret123 HTTP 429 https://provider.example?key=AIza012345678901234567890123"));
  assert.match(result, /temporarily unavailable/);
  assert.match(result, /HTTP 429/);
  assert.doesNotMatch(result, /secret123|AIza012345678901234567890123|provider\.example/);
  assert.match(result, /No program was generated, compiled, or tested/);
});
