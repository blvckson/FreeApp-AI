const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("public/app.js", "utf8");

test("GitHub check aggregation matches every workflow for the exact branch and commit", () => {
  assert.match(source, /run\.head_sha === commitSha && run\.head_branch === branch/);
  assert.doesNotMatch(source, /run\.pull_requests \|\| \[\]\)\.some/);
});

test("GitHub engineering agent still checks all workflows and reports missing checks honestly", () => {
  assert.match(source, /latestRuns\.every\(run => run\.status === "completed"\)/);
  assert.match(source, /No PR-triggered Actions runs were found for this exact commit/);
  assert.match(source, /runDetails\.filter\(run => run\.conclusion !== "success"\)/);
});
