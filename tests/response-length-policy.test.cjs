const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const worker = fs.readFileSync(new URL("../worker.js", `file://${__filename}`), "utf8");

test("response policy balances completeness and brevity", () => {
  assert.match(worker, /Match answer length to the actual task/);
  assert.match(worker, /Do not use a fixed word count/);
  assert.match(worker, /completeness takes priority over brevity/);
  assert.match(worker, /Avoid filler, generic introductions/);
});

test("response guidance has separate simple, research, and engineering depth levels", () => {
  assert.match(worker, /RESPONSE SIZE: Full deliverable/);
  assert.match(worker, /RESPONSE SIZE: Substantive explanation/);
  assert.match(worker, /RESPONSE SIZE: Focused conversational answer/);
  assert.match(worker, /buildMode \|\| codeTask/);
  assert.match(worker, /researchMode \|\| complexity\.complex/);
});

test("final user instruction reinforces task-calibrated readable answers", () => {
  assert.match(worker, /provide enough clear explanation to fully answer and solve it/);
  assert.match(worker, /concise direct answer for simple questions/);
  assert.match(worker, /complete, well-organised deliverable for complex tasks/);
});
