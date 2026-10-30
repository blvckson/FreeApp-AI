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
});

test("configured Kilo and LLM7 credentials are attached only when present", () => {
  assert.match(source, /const kiloHeaders = env\.KILO_API_KEY\s*\? \{ Authorization: "Bearer "/);
  assert.match(source, /headers: env\.LLM7_API_KEY\s*\? \{ Authorization: "Bearer "/);
  assert.match(source, /\.\.\.\(provider\.headers \|\| \{\}\)/);
});
