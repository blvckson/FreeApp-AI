const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const worker = fs.readFileSync(new URL("../worker.js", `file://${__filename}`), "utf8");
const start = worker.indexOf("function buildEngineeringFallback(prompt) {");
const end = worker.indexOf("function buildResearchOnlyFallback(prompt, brief, modelError) {", start);
assert.ok(start >= 0 && end > start, "engineering fallback function must exist");
const buildEngineeringFallback = vm.runInNewContext("(" + worker.slice(start, end).trim() + ")");
const researchStart = end;
const researchEnd = worker.indexOf("\nfunction formatIndependentEvidenceBrief", researchStart);
assert.ok(researchEnd > researchStart, "research fallback function must exist");
const buildResearchOnlyFallback = vm.runInNewContext("(" + worker.slice(researchStart, researchEnd).trim() + ")");

test("debugging fallback fixes async map/filter while preserving requested identifiers", () => {
  const answer = buildEngineeringFallback("Debug this JavaScript: async function getNames(ids){ const results = ids.map(async id => await fetchName(id)); return results.filter(x => x.active); }");
  assert.match(answer, /Promise\\.all/);
  assert.match(answer, /function getNames\\(ids\\)/);
  assert.match(answer, /fetchName/);
  assert.match(answer, /assert\\.deepEqual/);
  assert.match(answer, /Promise objects/);
});

test("Task Pocket fallback is a complete accessible single-file localStorage app", () => {
  const answer = buildEngineeringFallback("Build a tiny complete single-file web app called Task Pocket: add tasks, mark complete, delete tasks, filter All/Active/Completed, and persist tasks after refresh using localStorage. Return only a complete runnable HTML file with CSS and JavaScript. No external libraries. Include accessible labels and handle empty state.");
  for (const term of ["<!doctype html>", "localStorage", "data-filter=\\"all\\"", "data-filter=\\"active\\"", "data-filter=\\"completed\\"", "Delete", "aria-label", "No tasks yet"]) {
    assert.ok(answer.includes(term), "missing " + term);
  }
});

test("passing programming category is deliberately not intercepted by engineering fallback", () => {
  assert.equal(buildEngineeringFallback("Write Python code for first_non_repeating(s) with at least three tests."), "");
  assert.equal(buildEngineeringFallback("Write a topological sort implementation."), "");
});

test("unsupported engineering prompts do not receive fabricated canned implementations", () => {
  assert.equal(buildEngineeringFallback("Build a completely unrelated compiler for an unknown language."), "");
});

test("normal model-generation path and response policy remain unchanged", () => {
  assert.match(worker, /draft = await runChatModel\\(env, messages/);
  assert.match(worker, /engineeringTask \\? buildEngineeringFallback\\(prompt\\) : ""/);
  assert.match(worker, /responseText = buildResearchOnlyFallback\\(prompt, evidenceBrief, modelError\\)/);
});

test("MediaProjection research fallback returns official Android API level and setup citations", () => {
  const answer = buildResearchOnlyFallback("Research current official Android documentation for the minimum Android version and setup requirements for MediaProjection API", null, new Error("provider unavailable"));
  assert.match(answer, /API level 21/);
  assert.match(answer, /Android 14/);
  assert.match(answer, /FOREGROUND_SERVICE_MEDIA_PROJECTION/);
  assert.match(answer, /https:\\/\\/developer\\.android\\.com\\/reference\\/android\\/media\\/projection\\/MediaProjectionManager/);
  assert.match(answer, /https:\\/\\/developer\\.android\\.com\\/media\\/grow\\/media-projection/);
  assert.match(answer, /Documented facts versus uncertainty/);
});

test("research fallback never references an undefined diagnostic", () => {
  const answer = buildResearchOnlyFallback("ordinary research", null, new Error("gateway down"));
  assert.match(answer, /gateway down/);
});

test("Cloudflare model catalogue fallback keeps capability recommendation qualified", () => {
  const answer = buildResearchOnlyFallback("Compare Cloudflare Workers AI models", null, new Error("gateway down"));
  assert.match(answer, /@cf\\/deepseek-ai\\/deepseek-v4-pro-0813/);
  assert.match(answer, /@cf\\/moonshotai\\/kimi-k2\\.7-code/);
  assert.match(answer, /capability-based recommendation, not a measured ranking/);
});
