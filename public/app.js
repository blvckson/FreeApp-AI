const promptBox = document.getElementById("prompt");
const imageInput = document.getElementById("image-input");
const fileStatus = document.getElementById("file-status");
const preview = document.getElementById("preview");
const resultBox = document.getElementById("result");
const mediaBox = document.getElementById("media");
const statusBox = document.getElementById("status");
const sourcesBox = document.getElementById("sources");
const sourceList = document.getElementById("source-list");
const buildButton = document.getElementById("build-button");

let selectedImages = [];
let autoNarration = false;

const narratorSettingsButton = document.getElementById("narrator-settings-button");
const narratorModal = document.getElementById("narrator-modal");
const narratorClose = document.getElementById("narrator-close");
if (narratorSettingsButton && narratorModal) {
  narratorSettingsButton.addEventListener("click", () => { narratorModal.hidden = false; });
}
if (narratorClose && narratorModal) {
  narratorClose.addEventListener("click", () => { narratorModal.hidden = true; });
}

const API_BASE = "https://freeapp-ai.lovesongmelodies.workers.dev";

imageInput.addEventListener("change", () => {
  selectedImages = Array.from(imageInput.files || []).slice(0, 4);
  preview.replaceChildren();
  fileStatus.textContent = selectedImages.length
    ? selectedImages.length + " image(s) selected"
    : "No image selected";

  for (const file of selectedImages) {
    const img = document.createElement("img");
    img.alt = "Selected screenshot";
    img.className = "preview-image";
    img.src = URL.createObjectURL(file);
    preview.appendChild(img);
  }
});

buildButton.addEventListener("click", askAI);

async function askAI() {
  const prompt = promptBox.value.trim();
  if (!prompt && !selectedImages.length) {
    statusBox.textContent = "Enter a question or attach an image first.";
    return;
  }

  buildButton.disabled = true;
  statusBox.textContent = "FreeApp AI is processing your request...";
  resultBox.textContent = "";
  mediaBox.replaceChildren();
  sourceList.replaceChildren();
  sourcesBox.hidden = true;

  try {
    const images = [];
    for (const file of selectedImages) {
      images.push(await toDataUrl(file));
    }

    const lower = prompt.toLowerCase();
    // Route explicit app/code change requests to the owner-authorized
    // self-modification pipeline even when the command is not phrased as
    // "modify yourself".
    const selfModify = isSelfModificationCommand(lower);

    if (selfModify) {
      let ownerKey = localStorage.getItem("freeapp_ai_owner_key") || "";
      if (!ownerKey) {
        ownerKey = window.prompt("Enter your FreeApp AI owner key:");
        if (ownerKey) localStorage.setItem("freeapp_ai_owner_key", ownerKey);
      }
      if (!ownerKey) throw new Error("Owner key is required for self-modification.");

      statusBox.textContent = "Owner command accepted — preparing the code change...";
      const response = await fetch(API_BASE + "/api/self-modify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-FreeApp-Admin-Key": ownerKey
        },
        body: JSON.stringify({ command: prompt })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Self-modification failed.");

      resultBox.textContent =
        (data.summary || "Self-modification completed.") +
        (Array.isArray(data.files) && data.files.length
          ? "\n\nChanged: " + data.files.map(f => f.path).join(", ")
          : "") +
        (Array.isArray(data.notes) && data.notes.length
          ? "\n\nNotes:\n- " + data.notes.join("\n- ")
          : "");

      statusBox.textContent = data.changed
        ? "Change committed to GitHub. The build/deploy workflow can now run."
        : "No code change was necessary.";
      return;
    }

    const response = await fetch(API_BASE + "/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, images })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data.detail ? " " + data.detail : "";
      throw new Error((data.error || "The AI service returned an error.") + detail);
    }

    const answer = data.result || "No response was returned.";
    resultBox.textContent = answer;

    renderMedia(data.media);
    renderSources(data.sources);

    if (autoNarration) {
      speakText(answer);
    }

    statusBox.textContent = data.researched
      ? "Done — live research was used."
      : "Done.";
  } catch (error) {
    statusBox.textContent = "Request failed.";
    resultBox.textContent = error && error.message
      ? error.message
      : "The AI request failed.";
  } finally {
    buildButton.disabled = false;
  }
}

function renderSources(sources) {
  if (!Array.isArray(sources)) return;
  for (const source of sources) {
    if (!source?.url) continue;
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

function renderMedia(media) {
  if (!Array.isArray(media)) return;
  for (const item of media) {
    if (!item?.url) continue;
    const wrap = document.createElement("div");
    wrap.className = "media-card";

    if (item.type === "image") {
      const img = document.createElement("img");
      img.src = item.url;
      img.alt = item.title || "Relevant image";
      img.loading = "lazy";
      wrap.appendChild(img);
    } else if (item.type === "video") {
      const link = document.createElement("a");
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "▶ " + (item.title || "Watch relevant video");
      wrap.appendChild(link);
    }

    if (item.title) {
      const caption = document.createElement("div");
      caption.textContent = item.title;
      wrap.appendChild(caption);
    }
    mediaBox.appendChild(wrap);
  }
}

function isSelfModificationCommand(lower) {
  const action = /\b(add|change|modify|update|upgrade|improve|fix|repair|remove|delete|replace|rewrite|redesign|build|create|implement|enable|disable)\b/.test(lower);
  const target = /\b(app|application|project|code|source|feature|functionality|interface|ui|button|screen|narrator|voice|voice clone|self|freeapp|freeapp ai)\b/.test(lower);
  const explicitSelf = /\b(modify yourself|upgrade yourself|fix yourself|change yourself|improve yourself|add yourself|update yourself)\b/.test(lower);
  return explicitSelf || (action && target);
}

function speakText(text) {
  // Prefer the app's native, device-local narrator when running inside the
  // Android build. It requires no cloud voice API and works independently of
  // browser voice availability.
  if (window.FreeAppNativeVoice && typeof window.FreeAppNativeVoice.speak === "function") {
    try {
      window.FreeAppNativeVoice.speak(String(text).slice(0, 12000));
      return;
    } catch (_) {}
  }

  // Web Speech is the browser fallback for the web/PWA version.
  if (!("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => /^en(-UG|-GB)?$/i.test(v.lang))
      || voices.find(v => /^en/i.test(v.lang))
      || null;
    const utterance = new SpeechSynthesisUtterance(text);
    if (preferred) utterance.voice = preferred;
    utterance.rate = 1.0;
    utterance.pitch = 0.95;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch (_) {}
}

function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
