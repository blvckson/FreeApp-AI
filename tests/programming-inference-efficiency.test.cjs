const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "worker.js"), "utf8");

function loadFunction(name) {
  const match = source.match(new RegExp("function " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n\\}"));
  assert.ok(match, name + " must exist");
  return new Function("return (" + match[0] + ");")();
}

test("focused programming requests skip the extra engineering-planner inference", () => {
  const shouldUseEngineeringPlanner = loadFunction("shouldUseEngineeringPlanner");
  assert.equal(shouldUseEngineeringPlanner("Write a Python function first_non_repeating(s)."), false);
  assert.equal(shouldUseEngineeringPlanner("Debug this JavaScript function."), false);
  assert.equal(shouldUseEngineeringPlanner("Build a full application with several modules."), true);
  assert.equal(shouldUseEngineeringPlanner("Inspect the whole repository and implement the deployment pipeline."), true);
  assert.equal(shouldUseEngineeringPlanner("Write a small function.", true), true);
});

test("programming provider failures do not return unrelated research fallback text", () => {
  const buildProgrammingFailureFallback = loadFunction("buildProgrammingFailureFallback");
  const result = buildProgrammingFailureFallback("Write a Python function.", new Error("HTTP 429: quota exhausted"));
  assert.match(result, /Code generation could not be completed/);
  assert.match(result, /HTTP 429: quota exhausted/);
  assert.match(result, /No implementation was generated or executed/);
  assert.doesNotMatch(result, /Latin phrase|Wikipedia|source register/i);
});

test("programming failure branch is selected before research-only fallback", () => {
  const programmingBranch = source.indexOf("} else if (codeTask) {");
  const researchFallback = source.indexOf("responseText = buildResearchOnlyFallback(prompt, evidenceBrief, modelError);", programmingBranch);
  assert.ok(programmingBranch >= 0, "programming-specific failure branch must exist");
  assert.ok(researchFallback > programmingBranch, "research fallback remains only for non-programming requests");
});
