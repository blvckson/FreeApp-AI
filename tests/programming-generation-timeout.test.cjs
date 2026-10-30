const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("programming generation gets the extended timeout classifier only", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "worker.js"), "utf8");
  const declaration = source.match(/function isProgrammingGenerationRequest\(messages\) \{[\s\S]*?\n\}/);
  assert.ok(declaration, "programming request classifier must exist");
  const classify = new Function("return (" + declaration[0] + ");")();

  assert.equal(classify([{ role: "user", content: "Write a Python function and include unit tests." }]), true);
  assert.equal(classify([{ role: "user", content: "Implement the algorithm in JavaScript." }]), true);
  assert.equal(classify([{ role: "user", content: "Explain the causes of inflation." }]), false);
  assert.equal(classify([{ role: "user", content: "Compare two historical events." }]), false);

  assert.match(source, /providerTimeoutMs: isProgrammingGenerationRequest\(messages\) \? 22000 : 10000/);
  assert.match(source, /Number\(settings\.providerTimeoutMs \|\| provider\.timeoutMs\)/);
});

test("programming requests prioritize a configured Gemini provider", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "worker.js"), "utf8");
  const settings = source.indexOf("programming: isProgrammingGenerationRequest(messages)");
  const priority = source.indexOf("if (settings.programming && env.GEMINI_API_KEY)");
  const anonymous = source.indexOf("const kiloAttempts", priority);
  assert.ok(settings >= 0, "programming mode must be explicit in provider settings");
  assert.ok(priority > settings, "configured Gemini must be attempted for programming requests");
  assert.ok(anonymous > priority, "programming Gemini priority must precede anonymous provider probing");
  assert.match(source, /if \(env\.GEMINI_API_KEY && !geminiAttempted\)/);
});

test("programming output budget is larger without changing non-programming budget", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "worker.js"), "utf8");
  assert.match(source, /settings\.programming \? 7000 : 4096/);
});

test("provider failure does not turn unrelated research evidence into a programming answer", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "worker.js"), "utf8");
  assert.match(source, /else if \(codeTask\) \{[\s\S]{0,300}buildProgrammingProviderFailure\(prompt, modelError\)/);
  assert.match(source, /function buildProgrammingProviderFailure\(prompt, modelError\)/);
  assert.match(source, /No program was generated, compiled, or tested in this request/);
});

test("focused programming requests skip the separate engineering planner", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "worker.js"), "utf8");
  const declaration = source.match(/function shouldUseEngineeringPlanner\(prompt, buildMode = false\) \{[\s\S]*?\n\}/);
  assert.ok(declaration, "planner gate must exist");
  const shouldUseEngineeringPlanner = new Function("return (" + declaration[0] + ");")();
  assert.equal(shouldUseEngineeringPlanner("Write a Python function first_non_repeating(s)."), false);
  assert.equal(shouldUseEngineeringPlanner("Debug this JavaScript function."), false);
  assert.equal(shouldUseEngineeringPlanner("Build a full application with several modules."), true);
  assert.equal(shouldUseEngineeringPlanner("Inspect the whole repository and implement the deployment pipeline."), true);
  assert.equal(shouldUseEngineeringPlanner("Write a small function.", true), true);
});
