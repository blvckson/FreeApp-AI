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
const clearConversationButton = document.getElementById("clear-conversation-button");
const conversationNote = document.getElementById("conversation-note");
const HISTORY_KEY = "freeapp_ai_conversation_v1";
const MEMORY_KEY = "freeapp_ai_memory_summary_v1";
const MEMORY_TURN_COUNT_KEY = "freeapp_ai_memory_turn_count_v1";
let persistentMemory = loadPersistentMemory();

let selectedImages = [];
let autoNarration = false;
let conversationHistory = loadConversationHistory();

if (clearConversationButton) {
  clearConversationButton.addEventListener("click", () => {
    conversationHistory = [];
    try { localStorage.removeItem(HISTORY_KEY); localStorage.removeItem(MEMORY_KEY); localStorage.removeItem(MEMORY_TURN_COUNT_KEY); } catch (_) {}
    persistentMemory = "";
    if (conversationNote) conversationNote.textContent = "Conversation context and saved memory cleared. Your next question starts fresh.";
    statusBox.textContent = "New conversation started.";
  });
}
if (conversationNote) {
  conversationNote.textContent = conversationHistory.length
    ? "Continuing with " + Math.ceil(conversationHistory.length / 2) + " recent conversation message(s). Context is stored on this device."
    : "Ask follow-up questions without repeating the whole topic. Conversation context and a concise memory summary can be stored on this device.";
}

const narratorSettingsButton = document.getElementById("narrator-settings-button");
const narratorModal = document.getElementById("narrator-modal");
const builtinNarratorButton = document.getElementById("builtin-narrator-button");
const builtinNarratorModal = document.getElementById("builtin-narrator-modal");
const builtinNarratorClose = document.getElementById("builtin-narrator-close");
const builtinSpeakButton = document.getElementById("builtin-speak-button");
const builtinStopButton = document.getElementById("builtin-stop-button");
const builtinAutoButton = document.getElementById("builtin-auto-button");
if (builtinNarratorButton) builtinNarratorButton.addEventListener("click", () => builtinNarratorModal.hidden = false);
if (builtinNarratorClose) builtinNarratorClose.addEventListener("click", () => builtinNarratorModal.hidden = true);
if (builtinSpeakButton) builtinSpeakButton.addEventListener("click", () => speakText(resultBox.textContent || "There is no AI answer to read yet."));
if (builtinStopButton) builtinStopButton.addEventListener("click", stopNarrator);
if (builtinAutoButton) builtinAutoButton.addEventListener("change", () => { autoNarration = builtinAutoButton.checked; });
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

const websiteUrlInput = document.getElementById("website-url");
const websiteTaskInput = document.getElementById("website-task");
const websiteRunButton = document.getElementById("website-run-button");
const websiteStatus = document.getElementById("website-status");
const websiteResult = document.getElementById("website-result");


if (websiteRunButton) websiteRunButton.addEventListener("click", runWebsiteTask);

const phoneTaskInput = document.getElementById("phone-task");
const phoneEnableButton = document.getElementById("phone-enable-button");
const phoneGmailButton = document.getElementById("phone-gmail-button");
const phoneSettingsButton = document.getElementById("phone-settings-button");
const phoneUpdatesButton = document.getElementById("phone-updates-button");
const phoneRunButton = document.getElementById("phone-run-button");
const phoneStopButton = document.getElementById("phone-stop-button");
const phoneStatus = document.getElementById("phone-status");
const nativePhone = window.FreeAppNativePhone;
let phoneActionsCancelled = false;

function phoneControlAvailable() {
  if (!nativePhone || typeof nativePhone.openAccessibilitySettings !== "function") {
    if (phoneStatus) phoneStatus.textContent = "Phone control requires the installed Android FreeApp AI APK. It cannot control apps from a normal browser tab.";
    return false;
  }
  return true;
}

if (phoneEnableButton) phoneEnableButton.addEventListener("click", () => {
  if (!phoneControlAvailable()) return;
  phoneStatus.textContent = "Android Accessibility settings opened. Find FreeApp AI Phone Control and switch it on yourself; return here when finished.";
  nativePhone.openAccessibilitySettings();
});
if (phoneGmailButton) phoneGmailButton.addEventListener("click", () => {
  if (!phoneControlAvailable()) return;
  nativePhone.openApp("gmail");
  phoneStatus.textContent = "Requested Gmail to open. If it is not installed, install it or choose another supported app.";
});
if (phoneSettingsButton) phoneSettingsButton.addEventListener("click", () => {
  if (!phoneControlAvailable()) return;
  nativePhone.openApp("settings");
  phoneStatus.textContent = "Requested Android Settings to open.";
});
if (phoneUpdatesButton) phoneUpdatesButton.addEventListener("click", () => {
  if (!phoneControlAvailable()) return;
  nativePhone.openSystemUpdates();
  phoneStatus.textContent = "Opened the Android system-update screen if supported. Review and confirm any update yourself.";
});
if (phoneStopButton) phoneStopButton.addEventListener("click", () => {
  if (!phoneControlAvailable()) return;
  phoneActionsCancelled = true;
  nativePhone.stopPendingActions();
  phoneStatus.textContent = "Pending FreeApp AI screen actions cancelled. You can still use the phone normally.";
});
if (phoneRunButton) phoneRunButton.addEventListener("click", async () => {
  if (!phoneControlAvailable()) return;
  const raw = phoneTaskInput ? phoneTaskInput.value.trim() : "";
  if (!raw) { phoneStatus.textContent = "Enter one or more phone actions first."; return; }
  if (typeof nativePhone.isEnabled === "function" && !nativePhone.isEnabled()) {
    phoneStatus.textContent = "Phone Control is not enabled yet. Tap Enable Phone Control and turn it on in Android Accessibility settings.";
    return;
  }
  const lines = raw.split(/[\n;]+/).map(x => x.trim()).filter(Boolean);
  if (lines.length > 12) { phoneStatus.textContent = "For safety, run no more than 12 screen actions at once."; return; }
  phoneActionsCancelled = false;
  phoneRunButton.disabled = true;
  try {
    for (let i = 0; i < lines.length; i++) {
      if (phoneActionsCancelled) break;
      const action = parsePhoneAction(lines[i]);
      if (!action) {
        phoneStatus.textContent = "Stopped at unsupported instruction: " + lines[i] + ". Use the listed action formats.";
        break;
      }
      if (action.type === "open") nativePhone.openApp(action.value);
      else if (action.type === "updates") nativePhone.openSystemUpdates();
      else if (action.type === "action") nativePhone.runAction(action.value, action.text || "");
      phoneStatus.textContent = "Sent action " + (i + 1) + " of " + lines.length + ": " + lines[i] + ". Check the phone screen before continuing.";
      if (i < lines.length - 1) await new Promise(resolve => setTimeout(resolve, 1100));
    }
  } catch (_) {
    phoneStatus.textContent = "Phone action could not be sent. Check that the accessibility service is enabled.";
  } finally {
    phoneRunButton.disabled = false;
  }
});

function parsePhoneAction(line) {
  const s = line.trim();
  const lower = s.toLowerCase();
  if (/^(open|launch|start)\s+(gmail|email|settings|phone settings|chrome|browser|play store|playstore|files|file manager)$/.test(lower)) {
    return {type:"open", value:lower.replace(/^(open|launch|start)\s+/, "")};
  }
  if (/(check|open|show).*(system|software|phone|android).*(update|updates)|^(check|open)\s+(system )?updates?$/.test(lower)) return {type:"updates"};
  // Launch any installed app by its visible launcher name, not only a fixed shortlist.
  const genericOpen = s.match(/^(?:open|launch|start)\s+(?:app\s*:\s*)?(.+)$/i);
  if (genericOpen && genericOpen[1].trim()) {
    return {type:"open", value:genericOpen[1].trim().replace(/^["']|["']$/g,"")};
  }
  if (/^(scroll down|swipe up)$/.test(lower)) return {type:"action",value:"scroll_down"};
  if (/^(scroll up|swipe down)$/.test(lower)) return {type:"action",value:"scroll_up"};
  if (/^(back|go back)$/.test(lower)) return {type:"action",value:"back"};
  if (/^(home|go home)$/.test(lower)) return {type:"action",value:"home"};
  const tap = s.match(/^(?:tap|click|press)(?:\s+text)?\s*:\s*(.+)$/i) || s.match(/^(?:tap|click|press)\s+(.+)$/i);
  if (tap && tap[1]) {
    const label = tap[1].replace(/^["']|["']$/g,"").trim();
    if (/^(?:send(?:\s+.+)?|delete(?:\s+.+)?|pay(?:\s+.+)?|purchase(?:\s+.+)?|buy(?:\s+.+)?|transfer(?:\s+.+)?|install(?:\s+.+)?|allow(?:\s+.+)?|confirm(?:\s+.+)?|submit(?:\s+.+)?|grant(?:\s+.+)?|update now|accept(?:\s+.+)?)$/i.test(label)) {
      if (!window.confirm("This may submit a request, change settings, delete data, send a message, or install an update. Review the phone screen first. Continue with this tap?")) return null;
    }
    return {type:"action",value:"tap",text:label};
  }
  const type = s.match(/^(?:type|enter text|write)\s*:\s*(.*)$/i);
  if (type && type[1]) {
    const value = type[1];
    if (/(password|passcode|\botp\b|one-time code|verification code|security code|\bcvv\b|card number)/i.test(value)) return null;
    return {type:"action",value:"type",text:value};
  }
  return null;
}


async function runWebsiteTask() {
  const url = websiteUrlInput.value.trim();
  const task = websiteTaskInput.value.trim();
  if (!url || !task) {
    websiteStatus.textContent = "Enter a website address and describe the task.";
    return;
  }

  let parsed;
  try { parsed = new URL(url); } catch (_) {
    websiteStatus.textContent = "Enter a valid website address beginning with https://.";
    return;
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    websiteStatus.textContent = "Only public HTTP or HTTPS websites are supported.";
    return;
  }

  let ownerKey = localStorage.getItem("freeapp_ai_owner_key") || "";
  if (!ownerKey) {
    ownerKey = window.prompt("Enter your FreeApp AI owner key to authorize website actions:");
    if (ownerKey) localStorage.setItem("freeapp_ai_owner_key", ownerKey);
  }
  if (!ownerKey) {
    websiteStatus.textContent = "Website access was not authorized.";
    return;
  }

  websiteRunButton.disabled = true;
  websiteStatus.textContent = "Opening the website in a temporary cloud browser...";
  websiteResult.textContent = "";
  try {
    const response = await fetch(API_BASE + "/api/browser-task", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-FreeApp-Admin-Key": ownerKey
      },
      body: JSON.stringify({ url: parsed.href, task })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((data.error || "Website task failed.") + (data.detail ? " " + data.detail : ""));

    const lines = [
      data.summary || "Website task finished.",
      data.needsHuman ? ("Human assistance required: " + (data.verification || "verification")) : "",
      "Page: " + (data.title || "(untitled)"),
      "URL: " + (data.url || parsed.href),
      "",
      "Actions performed:"
    ];
    if (Array.isArray(data.actions) && data.actions.length) {
      for (const item of data.actions) lines.push("- " + item.action + (item.selector ? " on " + item.selector : "") + (item.result ? " — " + item.result : ""));
    } else {
      lines.push("- Read-only inspection; no interaction was needed.");
    }
    lines.push("", "Visible page content:", data.pageText || "(No readable page text was returned.)", "", data.note || "");
    websiteResult.replaceChildren();
    websiteResult.textContent = lines.filter(Boolean).join("\n");
    if (data.screenshot) {
      const preview = document.createElement("img");
      preview.className = "website-screenshot";
      preview.alt = "Screenshot of the website after FreeApp AI's task";
      preview.src = data.screenshot;
      websiteResult.appendChild(document.createElement("br"));
      websiteResult.appendChild(preview);
    }
    websiteStatus.textContent = data.needsHuman
      ? "Paused: the website requires human verification or login. FreeApp AI did not bypass it."
      : "Website task finished. Check the page content, screenshot, and action log above.";
  } catch (error) {
    websiteStatus.textContent = "Website task failed.";
    websiteResult.textContent = error && error.message ? error.message : "The website task failed.";
  } finally {
    websiteRunButton.disabled = false;
  }
}

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
      body: JSON.stringify({ prompt, images, history: conversationHistory.slice(-12), memorySummary: persistentMemory })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data.detail ? " " + data.detail : "";
      throw new Error((data.error || "The AI service returned an error.") + detail);
    }

    const answer = data.result || "No response was returned.";
    resultBox.textContent = answer;

    if (prompt) {
      conversationHistory.push({ role: "user", content: prompt });
      conversationHistory.push({ role: "assistant", content: answer });
      conversationHistory = conversationHistory.slice(-16).map(message => ({
        role: message.role,
        content: String(message.content || "").slice(0, 5000)
      }));
      saveConversationHistory();
      if (conversationNote) conversationNote.textContent =
        "Recent conversation context is saved on this device. A separate concise memory summary preserves useful project details and preferences; clear both any time.";
      updatePersistentMemory(prompt);
    }

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
  const action = /\b(make|add|change|modify|update|upgrade|improve|fix|repair|remove|delete|replace|rewrite|redesign|build|create|implement|enable|disable)\b/.test(lower);
  const target = /\b(app|application|project|code|source|feature|functionality|interface|ui|button|screen|narrator|voice|voice clone|self|freeapp|freeapp ai|personality|emotional intelligence|emotions|consciousness|memory|topic continuity|conversation history|reasoning|answer depth|detailed answers)\b/.test(lower);
  const explicitSelf = /\b(modify yourself|upgrade yourself|fix yourself|change yourself|improve yourself|add yourself|update yourself)\b/.test(lower);
  return explicitSelf || (action && target);
}

function loadPersistentMemory() {
  try { return String(localStorage.getItem(MEMORY_KEY) || "").slice(0, 3500); }
  catch (_) { return ""; }
}

async function updatePersistentMemory(prompt) {
  let turnCount = 0;
  try {
    turnCount = Number(localStorage.getItem(MEMORY_TURN_COUNT_KEY) || "0") + 1;
    localStorage.setItem(MEMORY_TURN_COUNT_KEY, String(turnCount));
  } catch (_) {}
  const explicit = /\b(remember|save this|keep in mind|don't forget|do not forget|store this)\b/i.test(prompt || "");
  if (!explicit && turnCount % 4 !== 0) return;
  try {
    const response = await fetch(API_BASE + "/api/memory-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        history: conversationHistory.slice(-16),
        previousSummary: persistentMemory
      })
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.updated && typeof data.summary === "string" && data.summary.trim()) {
      persistentMemory = data.summary.trim().slice(0, 3500);
      try { localStorage.setItem(MEMORY_KEY, persistentMemory); } catch (_) {}
      if (conversationNote) conversationNote.textContent =
        "Conversation context and useful project/preferences memory are saved on this device. Clear both any time.";
    }
  } catch (_) {
    // Memory is an enhancement, not a dependency: chat continues if summarisation is unavailable.
  }
}

function loadConversationHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved.slice(-16).filter(item =>
      item && ["user", "assistant"].includes(item.role) && typeof item.content === "string"
    ).map(item => ({ role: item.role, content: item.content.slice(0, 5000) }));
  } catch (_) {
    return [];
  }
}

function saveConversationHistory() {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(conversationHistory)); } catch (_) {
    if (conversationNote) conversationNote.textContent = "This device could not save conversation context. Follow-ups may need a reminder of earlier details.";
  }
}

function stopNarrator() { if (window.FreeAppNativeVoice?.stop) window.FreeAppNativeVoice.stop(); if ("speechSynthesis" in window) window.speechSynthesis.cancel(); }

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
