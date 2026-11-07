const fs = require("node:fs");
const path = require("node:path");
const { createWorker } = require("tesseract.js");

const expected = ["QX48291", "MARAKATO", "UGX184750"];
const fixtureSets = [
  { name: "clear", files: ["clear.png"] },
  { name: "faint", files: ["faint.png", "faint-enhanced.png"] },
  { name: "rotated", files: ["rotated.png", "rotated-candidate-90.png", "rotated-candidate-270.png"] },
  { name: "blurred", files: ["blurred.png", "blurred-enhanced.png"] }
];

function normalize(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

(async () => {
  const worker = await createWorker("eng", 1, {
    logger: message => {
      if (message.status === "recognizing text") {
        process.stdout.write("\rOCR " + Math.round((message.progress || 0) * 100) + "%");
      }
    }
  });
  const results = [];
  try {
    for (const fixture of fixtureSets) {
      let best = { text: "", confidence: -1, candidate: "" };
      for (const filename of fixture.files) {
        const file = path.join("ocr-fixtures", filename);
        if (!fs.existsSync(file)) continue;
        const result = await worker.recognize(file);
        const text = String(result?.data?.text || "").trim();
        const confidence = Number(result?.data?.confidence || 0);
        if (confidence > best.confidence || text.length > best.text.length + 8) {
          best = { text, confidence, candidate: filename };
        }
      }
      const normalized = normalize(best.text);
      const checks = Object.fromEntries(expected.map(token => [token, normalized.includes(token)]));
      results.push({
        fixture: fixture.name,
        selected_candidate: best.candidate,
        confidence: Math.round(best.confidence),
        checks,
        score: Math.round(100 * Object.values(checks).filter(Boolean).length / expected.length),
        text_excerpt: best.text.slice(0, 1200)
      });
    }
  } finally {
    await worker.terminate();
  }
  const passed = results.reduce((sum, row) => sum + Object.values(row.checks).filter(Boolean).length, 0);
  const total = results.length * expected.length;
  const report = {
    benchmark: "On-device Tesseract.js OCR synthetic-document benchmark",
    engine: "Tesseract.js 5.1.1 / English traineddata",
    method: "Four synthetic fixtures: clean print, faint print, 90-degree rotation and blur. Contrast-enhanced and rotation candidates are tested. Synthetic results do not guarantee accuracy on every real document.",
    overall_percent: Math.round(100 * passed / total),
    passed_fields: passed,
    total_fields: total,
    results
  };
  fs.mkdirSync("ocr-benchmark-results", { recursive: true });
  fs.writeFileSync("ocr-benchmark-results/local-ocr.json", JSON.stringify(report, null, 2));
  console.log("\n" + JSON.stringify(report, null, 2));
  if (report.overall_percent < 100) {
    console.error("OCR target not yet met: synthetic text fields remain unread.");
    process.exitCode = 1;
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
