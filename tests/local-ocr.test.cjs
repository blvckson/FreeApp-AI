const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("public/index.html", "utf8");
const app = fs.readFileSync("public/app.js", "utf8");

test("FreeApp loads the open-source local OCR engine before app logic", () => {
  assert.match(html, /tesseract\.js@5\/dist\/tesseract\.min\.js/);
  assert.ok(html.indexOf("tesseract.js") < html.indexOf('src="app.js"'));
});

test("image OCR runs locally with confidence reporting and safe preprocessing", () => {
  assert.match(app, /async function extractLocalOcr\(files\)/);
  assert.match(app, /Tesseract\.createWorker\("eng"/);
  assert.match(app, /getImageData/);
  assert.match(app, /contrast/);
  assert.match(app, /confidence/);
  assert.match(app, /\[LOW CONFIDENCE/);
  assert.match(app, /worker\.terminate\(\)/);
});

test("local OCR transcript is sent with the selected images", () => {
  assert.match(app, /ocrText = await extractLocalOcr\(selectedImages\)/);
  assert.match(app, /JSON\.stringify\(\{ prompt, images, ocrText,/);
});
