const promptBox = document.getElementById("prompt");
const resultBox = document.getElementById("result");
const statusBox = document.getElementById("status");
const sourcesBox = document.getElementById("sources");
const sourceList = document.getElementById("source-list");
const buildButton = document.getElementById("build-button");

buildButton.addEventListener("click", askAI);

promptBox.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") askAI();
});

async function askAI() {
  const prompt = promptBox.value.trim();
  if (!prompt) {
    statusBox.textContent = "Enter a question or instruction first.";
    return;
  }

  buildButton.disabled = true;
  statusBox.textContent = "Researching the web and reasoning through your question...";
  resultBox.textContent = "";
  sourceList.replaceChildren();
  sourcesBox.hidden = true;

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "The AI service returned an error.");

    resultBox.textContent = data.result || "No response was returned.";

    if (Array.isArray(data.sources) && data.sources.length) {
      for (const source of data.sources) {
        if (!source || !source.url) continue;
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = source.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = source.title || source.url;
        li.appendChild(a);
        sourceList.appendChild(li);
      }
      sourcesBox.hidden = sourceList.children.length === 0;
    }

    statusBox.textContent = data.researched
      ? "Done — live web research was used."
      : "Done — web research was unavailable for this request.";
  } catch (error) {
    statusBox.textContent = "Request failed.";
    resultBox.textContent = error.message;
  } finally {
    buildButton.disabled = false;
  }
}
