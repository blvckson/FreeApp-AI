const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const worker = fs.readFileSync(new URL("../worker.js", `file://${__filename}`), "utf8");
const start = worker.indexOf("function buildEngineeringFallback(prompt) {");
const end = worker.indexOf("function buildResearchOnlyFallback(prompt, brief, modelError) {", start);
assert.ok(start >= 0 && end > start, "engineering fallback function must exist");
const buildEngineeringFallback = vm.runInNewContext("(" + worker.slice(start, end).trim() + ")");

test("stable topological sort fallback includes stable ordering, validation, cycle detection and runnable tests", () => {
  const answer = buildEngineeringFallback("Write complete Python code for stable_topological_sort(nodes, edges), detect cycles and unknown endpoints, include four tests and complexity.");
  assert.match(answer, /def stable_topological_sort/);
  assert.match(answer, /heappush/);
  assert.match(answer, /unknown edge endpoint/);
  assert.match(answer, /cycle detected/);
  assert.match(answer, /test_normal/);
  assert.match(answer, /test_stable_tie/);
  assert.match(answer, /test_unknown_endpoint/);
  assert.match(answer, /test_cycle/);
  assert.match(answer, /O\(\(V \+ E\) log V\)/);
  assert.match(answer, /not model-generated/);
});

test("async map debugging fallback awaits all values before filtering", () => {
  const answer = buildEngineeringFallback("Debug this JavaScript function async function activeUsers(ids) { const users = ids.map(async (id) => await fetchUser(id)); return users.filter((user) => user.active); }");
  assert.match(answer, /Promise\.all/);
  assert.match(answer, /root cause/i);
  assert.match(answer, /assert\.deepEqual/);
  assert.match(answer, /filter/);
});

test("offline Android inventory fallback covers requested delivery areas", () => {
  const answer = buildEngineeringFallback("Design a build-ready MVP for an Android offline-first inventory app with SQLite schema, stock transactions, sync conflicts, acceptance tests and build steps.");
  for (const term of ["architecture and data flow", "CREATE TABLE items", "withTransaction", "outbox", "conflict", "Acceptance test #8", "assembleDebug", "not a compiled project"]) {
    assert.ok(answer.toLowerCase().includes(term.toLowerCase()), "missing " + term);
  }
});

test("unsupported engineering prompts do not receive fabricated canned implementations", () => {
  assert.equal(buildEngineeringFallback("Build a completely unrelated compiler for an unknown language."), "");
});

test("engineering fallbacks are isolated to model-failure handling; ordinary model path remains intact", () => {
  assert.match(worker, /draft = await runChatModel\(env, messages/);
  assert.match(worker, /engineeringTask \? buildEngineeringFallback\(prompt\) : ""/);
  assert.match(worker, /responseText = buildResearchOnlyFallback\(prompt, evidenceBrief, modelError\)/);
});

test("Cloudflare research fallback includes current alternatives and a qualified recommendation", () => {
  assert.match(worker, /@cf\/deepseek-ai\/deepseek-v4-pro-0813/);
  assert.match(worker, /@cf\/moonshotai\/kimi-k2\.7-code/);
  assert.match(worker, /@cf\/zai-org\/glm-5\.2/);
  assert.match(worker, /capability-based recommendation, not a measured ranking/);
  assert.match(worker, /developers\.cloudflare\.com\/workers-ai\/models/);
});
