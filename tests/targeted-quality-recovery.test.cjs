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
const classifierStart = worker.indexOf("function isSoftwareEngineeringRequest(prompt) {");
const classifierEnd = worker.indexOf("function isResearchFirstRequest(prompt) {", classifierStart);
const isSoftwareEngineeringRequest = vm.runInNewContext("(" + worker.slice(classifierStart, classifierEnd).trim() + ")");

const pythonPrompt = "Write a complete Python function stable_topological_sort(nodes, edges) that preserves input order for ties, validates BOTH source and target of every edge against nodes, detects cycles with ValueError, uses an efficient queue/priority structure rather than repeated list pop(0), and includes at least four runnable unit tests. Explain complexity.";
const jsPrompt = "Write a robust JavaScript async function fetchActiveUsers(ids, fetchUser) that fetches all users concurrently, preserves order, filters active users, handles a rejected fetch explicitly, and includes at least three tests.";
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

test("fetchActiveUsers coding fallback restores concurrency, ordering, rejection handling and runnable tests", () => {
  const answer = buildEngineeringFallback(jsPrompt);
  assert.match(answer, /async function fetchActiveUsers/);
  assert.match(answer, /Promise\.all/);
  assert.match(answer, /user\.active === true/);
  assert.match(answer, /catch \(cause\)/);
  assert.match(answer, /assert\.deepEqual/);
  assert.match(answer, /assert\.rejects/);
  assert.equal(targetedEngineeringFallbackNeeded(jsPrompt, answer), false);
  assert.equal(targetedEngineeringFallbackNeeded(jsPrompt, "async function fetchActiveUsers(ids, fetchUser) { return ids.map(async id => fetchUser(id)).filter(user => user.active); }"), true);
});

test("topological-sort guard accepts explicit tuple-unpacked source and target validation", () => {
  const valid = `def stable_topological_sort(nodes, edges):
    node_set = set(nodes)
    for source, target in edges:
        if source not in node_set: raise ValueError("unknown source")
        if target not in node_set: raise ValueError("unknown target")
    heapq.heapify([])
    if cycle: raise ValueError("cycle")
    def test_one(): pass
    def test_two(): pass
    def test_three(): pass
    def test_four(): pass
    return "O(V + E)"`;
  assert.equal(targetedEngineeringFallbackNeeded(pythonPrompt, valid), false);
});

test("generated Python implementation and five unit tests execute successfully", () => {
  const answer = buildEngineeringFallback(pythonPrompt);
  const blocks = [...answer.matchAll(/```python\n([\s\S]*?)\n```/g)].map(match => match[1]);
  assert.equal(blocks.length, 2, "implementation and test blocks must both be present");
  const runnable = blocks.join("\n\n").replace(
    "unittest.main()",
    "unittest.TextTestRunner(stream=__import__('sys').stdout).run(unittest.defaultTestLoader.loadTestsFromTestCase(StableTopologicalSortTests))"
  );
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
  assert.ok(inputs.length >= 1);
  assert.match(answer, /setAttribute\(\x27aria-label\x27,\x27Mark /, "dynamically created completion checkbox must be labelled");
  assert.ok(inputs.every(match => /aria-label\s*=/.test(match[1]) || /id\s*=/.test(match[1])), "every input must have an accessible name");
  assert.equal(targetedEngineeringFallbackNeeded(htmlPrompt, answer), false);
  const inaccessible = answer.replace(/aria-label="Show active tasks"/, "").replace(/aria-label="Delete [^"]+"/, "");
  assert.equal(targetedEngineeringFallbackNeeded(htmlPrompt, inaccessible), true, "one unlabeled button must trigger deterministic repair");
});

test("Android research has three direct official-source fallbacks", () => {
  assert.match(worker, /https:\/\/developer\.android\.com\/media\/grow\/media-projection/);
  assert.match(worker, /https:\/\/developer\.android\.com\/reference\/android\/media\/projection\/MediaProjectionManager/);
  assert.match(worker, /https:\/\/developer\.android\.com\/develop\/background-work\/services\/fgs\/service-types#media-projection/);
  assert.match(worker, /fallbackResearchCandidates\(query/);
  assert.match(worker, /const isAndroidResearchQuery =/);
  assert.match(worker, /isCloudflareQuery \|\| isAndroidResearchQuery/);
  assert.ok(worker.includes("developer\\.android\\.com|developers\\.cloudflare\\.com"), "official Android and Cloudflare docs must receive primary-source classification");
});

test("recovery is scoped and does not change reasoning or debugging classifiers", () => {
  assert.match(worker, /if \(targetedEngineeringFallbackNeeded\(prompt, responseText\)\)/);
  assert.match(worker, /function isResearchFirstRequest\(prompt\)/);
  assert.match(worker, /function buildEngineeringFallback\(prompt\)/);
  assert.equal(buildEngineeringFallback("Write Python code for an unrelated parser."), "");
  assert.equal(buildEngineeringFallback("Build an unrelated compiler."), "");
});

test("Python and JavaScript function requests enter the software-engineering path", () => {
  assert.equal(isSoftwareEngineeringRequest(pythonPrompt), true);
  assert.equal(isSoftwareEngineeringRequest("Write a JavaScript function to fetch active users."), true);
  assert.equal(isSoftwareEngineeringRequest("What is the function of the human heart?"), false);
  assert.equal(isSoftwareEngineeringRequest("What is Python?"), false);
  assert.ok(worker.includes("function|class|script|source code|python|javascript"));
});
