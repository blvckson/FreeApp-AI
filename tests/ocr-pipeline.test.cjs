const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "worker.js"), "utf8");
const start = source.indexOf("async function analyzeImages(env, images, prompt, localOcrText = \"\") {");
const end = source.indexOf("\nfunction buildMedia(", start);
assert.ok(start >= 0 && end > start, "analyzeImages must exist");
const analyzeImages = vm.runInNewContext("(" + source.slice(start, end).replace(/^async function analyzeImages/, "async function") + ")");

const image = "data:image/png;base64,aGVsbG8=";

test("OCR uses the dedicated Moondream model and returns its exact transcription", async () => {
  const calls = [];
  const env = { AI: { run: async (model, input) => {
    calls.push({ model, input });
    if (model.includes("moondream")) return { answer: "INVOICE 1042\nTOTAL: $19.50" };
    return { response: "A photographed invoice on a desk." };
  } } };
  const result = await analyzeImages(env, [image], "Read this invoice");
  assert.match(result, /INVOICE 1042/);
  assert.match(result, /TOTAL: \$19\.50/);
  assert.ok(calls.some(call => call.model === "@cf/moondream/moondream3.1-9B-A2B"));
  assert.ok(calls.some(call => call.model === "@cf/meta/llama-4-scout-17b-16e-instruct"));
  const ocrCall = calls.find(call => call.model.includes("moondream"));
  assert.equal(ocrCall.input.task, "query");
  assert.match(ocrCall.input.question, /\[illegible\]/);
});

test("OCR marks unavailable text extraction honestly and never invents a transcript", async () => {
  const env = { AI: { run: async (model) => {
    if (model.includes("moondream")) throw new Error("model unavailable");
    return { response: "Image shows a paper document." };
  } } };
  const result = await analyzeImages(env, [image], "Read faint text");
  assert.match(result, /Dedicated text extraction was unavailable/);
  assert.match(result, /Diagnostic: model unavailable/);
  assert.match(result, /Verify uncertain text/);
  assert.doesNotMatch(result, /The text says .*\d{3,}/);
});

test("OCR handles multiple images and rejects non-image payloads", async () => {
  let count = 0;
  const env = { AI: { run: async (model) => {
    if (model.includes("moondream")) { count++; return { answer: "Page " + count }; }
    return { response: "" };
  } } };
  const result = await analyzeImages(env, [image, image, "not-an-image"], "Extract text");
  assert.equal(count, 2);
  assert.match(result, /IMAGE 1 OCR/);
  assert.match(result, /IMAGE 2 OCR/);
});

test("local device OCR bypasses the quota-limited hosted OCR model", async () => {
  const calls = [];
  const env = { AI: { run: async (model) => {
    calls.push(model);
    if (model.includes("moondream")) throw new Error("hosted OCR should not run");
    return { response: "A document photograph." };
  } } };
  const transcript = "IMAGE 1 (92% confidence):\\nINVOICE 1042\\nTOTAL: $19.50";
  const result = await analyzeImages(env, [image], "Read this invoice", transcript);
  assert.match(result, /LOCAL DEVICE OCR TRANSCRIPT/);
  assert.match(result, /INVOICE 1042/);
  assert.match(result, /92% confidence/);
  assert.equal(calls.length, 0, "local OCR must not call hosted vision models");
});

test("local OCR remains usable when the hosted AI binding is unavailable", async () => {
  const result = await analyzeImages({}, [image], "Read this invoice", "INVOICE 1042");
  assert.match(result, /INVOICE 1042/);
  assert.match(result, /LOCAL DEVICE OCR TRANSCRIPT/);
});

test("OCR reports unavailable image analysis without throwing when AI binding is absent", async () => {
  assert.match(await analyzeImages({}, [image], "Read"), /unavailable/i);
});
