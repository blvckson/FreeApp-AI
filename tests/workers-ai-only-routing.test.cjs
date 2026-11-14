const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const worker = fs.readFileSync("worker.js", "utf8");

test("strict Workers AI policy is limited to App Builder requests", () => {
  assert.match(worker, /const workersAiOnlyMode = appBuilderMode && body\.providerPolicy === "workers-ai-only"/);
  assert.match(worker, /body\.providerPolicy === "workers-ai-only" && !appBuilderMode/);
  assert.match(worker, /workersAiOnly: workersAiOnlyMode/);
});

test("strict route invokes only the configured primary Workers AI model", () => {
  const start = worker.indexOf("if (settings.workersAiOnly) {");
  const end = worker.indexOf("// The dedicated Ask.Me App Builder", start);
  assert.ok(start >= 0 && end > start, "strict route must be a distinct early-return branch");
  const strictRoute = worker.slice(start, end);
  assert.match(strictRoute, /env\.AI\.run\(model, settings\)/);
  assert.match(strictRoute, /provider: "Cloudflare Workers AI", model/);
  assert.doesNotMatch(strictRoute, /FALLBACK_MODEL|runGeminiModel|runAnonymousOpenAIProvider|runPollinationsAnonymous|fetch\s*\(/);
});

test("strict failures cannot fall through to deterministic or secondary generation", () => {
  assert.match(worker, /if \(workersAiOnlyMode\) throw modelError/);
  assert.match(worker, /if \(!workersAiOnlyMode && responseText && !modelIndependentFallback/);
  assert.match(worker, /if \(!workersAiOnlyMode && !modelIndependentFallback/);
  assert.match(worker, /if \(!workersAiOnlyMode && targetedEngineeringFallbackNeeded/);
});

test("normal App Builder and non-builder provider fallbacks remain available without strict policy", () => {
  assert.match(worker, /if \(settings\.appBuilderMode && env\.AI\)/);
  assert.match(worker, /runGeminiModel\(env, settings/);
  assert.match(worker, /runAnonymousOpenAIProvider\(provider, settings\)/);
  assert.match(worker, /runPollinationsAnonymous\(settings\)/);
});
