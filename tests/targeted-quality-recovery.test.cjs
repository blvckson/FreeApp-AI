const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");

const worker = fs.readFileSync(new URL("../worker.js", `file://${__filename}`), "utf8");
const fallbackStart = worker.indexOf("function buildEngineeringFallback(prompt) {");
const gateStart = worker.indexOf("function targetedEngineeringFallbackNeeded(prompt, response) {", fallbackStart);
const researchStart = worker.indexOf("function buildResearchOnlyFallback(prompt, brief, modelError) {", gateStart);
assert.ok(fallbackStart >= 0 && gateStart > fallbackStart && researchStart > gateStart);
const buildEngineeringFallback = vm.runInNewContext("(" + worker.slice(fallbackStart, gateStart).trim() + ")");
const targetedEngineeringFallbackNeeded = vm.runInNewContext("(" + worker.slice(gateStart, researchStart).trim() + ")");

const pythonPrompt = "Write a complete Python function stable_topological_sort(nodes, edges) that preserves input order for ties, validates BOTH source and target of every edge against nodes, detects cycles with ValueError, uses an efficient queue/priority structure rather than repeated list pop(0), and includes at least four runnable unit tests. Explain complexity.";
const htmlPrompt = "Create a complete runnable single-file HTML task manager with add, complete, delete, All/Active/Completed filters, localStorage persistence, an explicit <label for> or aria-label for EVERY input and button, and an empty state. It must have no external script or stylesheet dependencies.";

test("stable_topological_sort fallback validates both endpoints and uses a stable heap", () => {
  const answer = buildEngineeringFallback(pythonPrompt);
  for (const pattern of [/def stable_topological_sort/, /edge\[0\] not in node_set/, /edge\[1\] not in node_set/, /heapq/, /cycle detected/, /O\(\(V \+ E\) log V\)/, /def test_/]) {
    assert.match(answer, pattern);
  }
  assert.ok((answer.match(/def test_/g) || []).length >= 4);
  assert.equal(targetedEngineeringFallbackNeeded(pythonPrompt, answer), false);
  assert.equal(targetedEngineeringFallbackNeeded(pythonPrompt, "def stable_topological_sort(nodes, edges): pass"), true);
});

test("generated Python implementation and five unit tests execute successfully", () => {
  const answer = buildEngineeringFallback(pythonPrompt);
  const blocks = [...answer.matchAll(/```python\n([\s\S]*?)\n```/g)].map(match => match[1]);
  assert.equal(blocks.length, 2, "implementation and test blocks must both be present");
  const runnable = blocks.join("\n\n").replace("unittest.main()", "unittest.main(stream=__import__('sys').stdout)");
  const output = execFileSync("python3", ["-c", runnable], { encoding: "utf8", timeout: 10000 });
  assert.match(output, /OK/);
});

test("generic task-manager fallback labels every input and button and preserves requested features", () => {
  const answer = buildEngineeringFallback(htmlPrompt);
  assert.match(answer, /<!doctype html/i);
  assert.match(answer, /localStorage/);
  assert.match(answer, /addEventListener/);
  assert.match(answer, /completed/);
  assert.match(answer, /data-filter=/);
  assert.match(answer, /No tasks yet/);
  const buttons = [...answer.matchAll(/<button\b([^>]*)>/gi)];
  assert.ok(buttons.length >= 4);
  assert.ok(buttons.every(match => /aria-label\s*=/.test(match[1])), "every button must have an accessible name");
  const inputs = [...answer.matchAll(/<input\b([^>]*)>/gi)];
  assert.ok(inputs.length >= 2);
  assert.ok(inputs.every(match => /aria-label\s*=/.test(match[1]) || /id\s*=/.test(match[1])), "every input must have an accessible name");
  assert.equal(targetedEngineeringFallbackNeeded(htmlPrompt, answer), false);
});

test("Android research has three direct official-source fallbacks", () => {
  assert.match(worker, /https:\/\/developer\.android\.com\/media\/grow\/media-projection/);
  assert.match(worker, /https:\/\/developer\.android\.com\/reference\/android\/media\/projection\/MediaProjectionManager/);
  assert.match(worker, /https:\/\/developer\.android\.com\/develop\/background-work\/services\/fgs\/service-types#media-projection/);
  assert.match(worker, /fallbackResearchCandidates\(query/);
});

test("recovery is scoped and does not change reasoning or debugging classifiers", () => {
  assert.match(worker, /if \(targetedEngineeringFallbackNeeded\(prompt, responseText\)\)/);
  assert.match(worker, /function isResearchFirstRequest\(prompt\)/);
  assert.match(worker, /function buildEngineeringFallback\(prompt\)/);
  assert.equal(buildEngineeringFallback("Write Python code for an unrelated parser."), "");
  assert.equal(buildEngineeringFallback("Build an unrelated compiler."), "");
});
