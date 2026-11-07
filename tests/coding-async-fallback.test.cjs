const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("worker.js", "utf8");
const declaration = source.match(/function buildEngineeringFallback\(prompt\) \{[\s\S]*?\n\}/);
assert.ok(declaration, "engineering fallback must exist");
const buildEngineeringFallback = new Function("return (" + declaration[0] + ");")();

function getImplementation(prompt) {
  const answer = buildEngineeringFallback(prompt);
  const match = answer.match(/~~~javascript\n([\s\S]*?)\n~~~/);
  assert.ok(match, "fallback must include runnable JavaScript");
  return new Function(match[1] + "\nreturn fetchActiveUsers;")();
}

const prompt = "Write a robust JavaScript async function fetchActiveUsers(ids, fetchUser) that fetches all users concurrently, preserves order, filters active users, handles a rejected fetch explicitly, and includes at least three tests.";

test("coding fallback is limited to explicit fetchActiveUsers implementation requests", () => {
  assert.match(buildEngineeringFallback(prompt), /Promise\.all/);
  assert.match(buildEngineeringFallback(prompt), /error\.failures/);
  assert.equal(buildEngineeringFallback("Debug this fetchActiveUsers map/filter bug."), "");
  assert.equal(buildEngineeringFallback("Research concurrent JavaScript APIs."), "");
});

test("fetchActiveUsers starts all requests concurrently and preserves input order", async () => {
  const fetchActiveUsers = getImplementation(prompt);
  const users = {1:{id:1,active:true},2:{id:2,active:false},3:{id:3,active:true}};
  const delays = {1:25,2:5,3:10};
  const result = await fetchActiveUsers([1,2,3], async id => {
    await new Promise(resolve => setTimeout(resolve, delays[id]));
    return users[id];
  });
  assert.deepEqual(result, [users[1], users[3]]);
});

test("fetchActiveUsers aggregates rejected requests with id and index", async () => {
  const fetchActiveUsers = getImplementation(prompt);
  const started = [];
  await assert.rejects(
    fetchActiveUsers([1,2,3], async id => {
      started.push(id);
      if (id === 2) throw new Error("network failure");
      return {id,active:true};
    }),
    error => error.failures?.length === 1 && error.failures[0].id === 2 && error.failures[0].index === 1
  );
  assert.deepEqual(started.sort(), [1,2,3]);
});

test("fetchActiveUsers validates arguments and supports an empty list", async () => {
  const fetchActiveUsers = getImplementation(prompt);
  assert.deepEqual(await fetchActiveUsers([], async () => null), []);
  await assert.rejects(fetchActiveUsers("1", async () => null), TypeError);
  await assert.rejects(fetchActiveUsers([1], null), TypeError);
});
