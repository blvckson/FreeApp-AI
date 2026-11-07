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
const DRAFT_KEY = "freeapp_ai_unsent_draft_v1";
let draftSaveTimer = null;
function saveUnsentDraft() {
  if (!promptBox) return;
  try {
    const value = String(promptBox.value || "");
    if (value) localStorage.setItem(DRAFT_KEY, value.slice(0, 120000));
    else localStorage.removeItem(DRAFT_KEY);
  } catch (_) {
    if (conversationNote) conversationNote.textContent = "Draft backup is unavailable on this device. Keep long messages copied until sent.";
  }
}
function restoreUnsentDraft() {
  try {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved && promptBox && !promptBox.value) {
      promptBox.value = saved;
      if (conversationNote) conversationNote.textContent = "Recovered your unsent draft after the app restarted.";
    }
  } catch (_) {}
}
if (promptBox) {
  restoreUnsentDraft();
  promptBox.addEventListener("input", () => {
    if (draftSaveTimer) clearTimeout(draftSaveTimer);
    draftSaveTimer = setTimeout(saveUnsentDraft, 750);
  });
  window.addEventListener("pagehide", saveUnsentDraft);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveUnsentDraft();
  });
}
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

// Keep the chat composer and answer visible; put every secondary control in
// one compact, scrollable three-dot menu.
const functionMenu = document.getElementById("function-menu");
const functionMenuContent = document.getElementById("function-menu-content");
const menuToggle = document.getElementById("menu-toggle");
const menuClose = document.getElementById("menu-close");
const narratorStatus = document.getElementById("narrator-status");
window.FreeAppNarratorStatus = function(message) { if (narratorStatus) narratorStatus.textContent = String(message || ""); };

if (functionMenu && functionMenuContent) {
  const moveIntoMenu = (element) => { if (element) functionMenuContent.appendChild(element); };
  
  moveIntoMenu(clearConversationButton);
  moveIntoMenu(conversationNote);
  moveIntoMenu(document.querySelector(".website-card"));
  moveIntoMenu(document.querySelector(".phone-control-card"));
}
function setFunctionMenu(open) {
  if (!functionMenu || !menuToggle) return;
  functionMenu.hidden = !open;
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Close all functions" : "Open all functions");
}
if (menuToggle) menuToggle.addEventListener("click", () => setFunctionMenu(functionMenu ? functionMenu.hidden : false));
if (menuClose) menuClose.addEventListener("click", () => setFunctionMenu(false));
document.addEventListener("keydown", event => { if (event.key === "Escape") setFunctionMenu(false); });
document.addEventListener("click", event => {
  if (functionMenu && !functionMenu.hidden && !functionMenu.contains(event.target) && event.target !== menuToggle) setFunctionMenu(false);
});

if (builtinNarratorButton) builtinNarratorButton.addEventListener("click", () => { builtinNarratorModal.hidden = false; if (narratorStatus) narratorStatus.textContent = "Ready. Tap Read Latest Answer to begin."; });
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

const attachButton = document.getElementById("attach-button");
if (attachButton) attachButton.addEventListener("click", () => imageInput.click());

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
  if (lines.some(line => !isPhoneActionSyntax(line))) {
    phoneRunButton.disabled = true;
    phoneStatus.textContent = "Turning your request into a reviewable phone-action plan...";
    try {
      const response = await fetch(API_BASE + "/api/phone-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: raw })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not plan this phone task.");
      if (!Array.isArray(data.actions) || !data.actions.length) throw new Error("No usable actions were planned. Add the exact visible button labels or break the task into smaller steps.");
      phoneTaskInput.value = data.actions.join("\\n");
      phoneStatus.textContent = (data.summary || "Phone plan prepared.") + " Review the commands shown above. Nothing has been executed yet. Tap Run Phone Actions again to run the reviewed steps; consequential actions still require confirmation.";
    } catch (error) {
      phoneStatus.textContent = error?.message || "Phone task planning failed.";
    } finally {
      phoneRunButton.disabled = false;
    }
    return;
  }
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

function isPhoneActionSyntax(line) {
  const s = String(line || "").trim();
  return /^(?:open|launch|start)\\s+.+$/i.test(s)
    || /^(?:check|open|show).*(?:system|software|phone|android).*(?:update|updates)|^(?:check|open)\\s+(?:system )?updates?$/i.test(s)
    || /^(?:scroll down|swipe up|scroll up|swipe down|back|go back|home|go home)$/i.test(s)
    || /^(?:tap|click|press)(?:\\s+text)?\\s*:.+$/i.test(s)
    || /^(?:tap|click|press)\\s+.+$/i.test(s)
    || /^(?:type|enter text|write)\\s*:.+$/i.test(s);
}

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

  // Instant local handling for greetings: never wait for a remote model just
  // to answer "hi", "hello", or "hey". Keep this path offline-capable.
  if (prompt && !selectedImages.length && /^(hi|hello|hey|hiya|good morning|good afternoon|good evening)[!.?\s]*$/i.test(prompt)) {
    const answer = "Hi! I'm FreeApp AI. I'm here and ready to help. What would you like to work on?";
    resultBox.textContent = answer;
    mediaBox.replaceChildren();
    sourceList.replaceChildren();
    sourcesBox.hidden = true;
    conversationHistory.push({ role: "user", content: prompt });
    conversationHistory.push({ role: "assistant", content: answer });
    conversationHistory = conversationHistory.slice(-16);
    saveConversationHistory();
    statusBox.textContent = "Ready — instant reply (no network request).";
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
          ? "\n\nChanged: " + data.files.map(f => (f.operation === "delete" ? "DELETE " : "WRITE ") + f.path).join(", ")
          : "") +
        (Array.isArray(data.notes) && data.notes.length
          ? "\n\nNotes:\n- " + data.notes.join("\n- ")
          : "");

      statusBox.textContent = data.changed
        ? "Change committed to GitHub. The build/deploy workflow can now run."
        : "No code change was necessary.";
      return;
    }

    let ocrText = "";
    if (selectedImages.length) {
      statusBox.textContent = "Reading image text on this device...";
      ocrText = await extractLocalOcr(selectedImages);
      if (ocrText) statusBox.textContent = "Local OCR complete — sending the text and image for analysis...";
      else statusBox.textContent = "Local OCR is unavailable or found no readable text; trying image analysis...";
    }

    // Bound the wait so a stalled backend cannot leave the user waiting forever.
    const requestController = new AbortController();
    const requestTimeout = setTimeout(() => requestController.abort(), 90000);
    let response;
    try {
      response = await fetch(API_BASE + "/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, images, ocrText, history: conversationHistory.slice(-12), memorySummary: persistentMemory }),
        signal: requestController.signal
      });
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw new Error("The AI service took longer than 90 seconds. Please retry; your draft is saved so you can continue without retyping it.");
      }
      throw error;
    } finally {
      clearTimeout(requestTimeout);
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data.detail ? " " + data.detail : "";
      throw new Error((data.error || "The AI service returned an error.") + detail);
    }

    const answer = data.result || "No response was returned.";
    resultBox.textContent = answer;
    try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
    if (promptBox && promptBox.value.trim() === prompt) promptBox.value = "";

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

function stopNarrator() {
  if (window.FreeAppNativeVoice?.stop) {
    try { window.FreeAppNativeVoice.stop(); } catch (_) {}
  }
  if ("speechSynthesis" in window) {
    try { window.speechSynthesis.cancel(); } catch (_) {}
  }
  if (narratorStatus) narratorStatus.textContent = "Narration stopped.";
}

function speakText(text) {
  const plainText = String(text || "").replace(/\s+/g, " ").trim();
  if (!plainText) {
    if (narratorStatus) narratorStatus.textContent = "There is no answer text to read yet.";
    return;
  }
  // Native Android TTS is preferred, but queue the whole answer so long
  // responses can be split into safe utterance chunks on the Android side.
  if (window.FreeAppNativeVoice && typeof window.FreeAppNativeVoice.speak === "function") {
    try {
      window.FreeAppNativeVoice.speak(plainText.slice(0, 12000));
      if (narratorStatus) narratorStatus.textContent = "Reading the answer aloud. Tap Stop to cancel.";
      return;
    } catch (_) {
      if (narratorStatus) narratorStatus.textContent = "Device narrator failed; trying browser speech instead.";
    }
  }

  if (!("speechSynthesis" in window)) {
    if (narratorStatus) narratorStatus.textContent = "Narration is unavailable. Check that a Text-to-Speech engine is installed and enabled.";
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => /^en(-UG|-GB)?$/i.test(v.lang))
      || voices.find(v => /^en/i.test(v.lang))
      || null;
    const chunks = plainText.match(/[\s\S]{1,2500}(?:\s|$)/g) || [plainText];
    let index = 0;
    const speakNext = () => {
      if (index >= chunks.length) {
        if (narratorStatus) narratorStatus.textContent = "Finished reading the answer.";
        return;
      }
      const utterance = new SpeechSynthesisUtterance(chunks[index++].trim());
      if (preferred) utterance.voice = preferred;
      utterance.rate = 1.0;
      utterance.pitch = 0.98;
      utterance.volume = 1.0;
      utterance.onend = speakNext;
      utterance.onerror = () => {
        if (narratorStatus) narratorStatus.textContent = "Browser narration stopped or failed. Try again or check your device TTS settings.";
      };
      window.speechSynthesis.speak(utterance);
    };
    if (narratorStatus) narratorStatus.textContent = "Reading the answer aloud. Tap Stop to cancel.";
    speakNext();
  } catch (_) {
    if (narratorStatus) narratorStatus.textContent = "Narration failed. Check your device Text-to-Speech settings.";
  }
}


async function preprocessImageForOcr(file, rotation = 0) {
  const source = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = URL.createObjectURL(file);
  });
  const scale = Math.min(2, 1800 / Math.max(source.naturalWidth, source.naturalHeight));
  const width = Math.max(1, Math.round(source.naturalWidth * scale));
  const height = Math.max(1, Math.round(source.naturalHeight * scale));
  const sideways = rotation % 180 !== 0;
  const canvas = document.createElement("canvas");
  canvas.width = sideways ? height : width;
  canvas.height = sideways ? width : height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(rotation * Math.PI / 180);
  context.drawImage(source, -width / 2, -height / 2, width, height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const gray = 0.299 * pixels.data[index] + 0.587 * pixels.data[index + 1] + 0.114 * pixels.data[index + 2];
    const contrast = Math.max(0, Math.min(255, (gray - 128) * 1.65 + 128));
    pixels.data[index] = pixels.data[index + 1] = pixels.data[index + 2] = contrast;
    pixels.data[index + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  URL.revokeObjectURL(source.src);
  return canvas;
}

async function extractLocalOcr(files) {
  if (!files?.length || !window.Tesseract?.createWorker) return "";
  let worker;
  let ocrTimeout;
  try {
    worker = await window.Tesseract.createWorker("eng", 1, {
      logger: message => {
        if (message.status === "recognizing text") {
          statusBox.textContent = "Reading image text locally: " + Math.round((message.progress || 0) * 100) + "%";
        }
      }
    });
    ocrTimeout = setTimeout(() => { if (worker) worker.terminate().catch(() => {}); }, 45000);
    const transcripts = [];
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      let best = { text: "", confidence: 0 };
      for (const rotation of [0, 90, 270]) {
        if (rotation && best.confidence >= 55 && best.text.length >= 12) break;
        const canvas = await preprocessImageForOcr(file, rotation);
        const result = await worker.recognize(canvas);
        const candidate = {
          text: String(result?.data?.text || "").trim(),
          confidence: Number(result?.data?.confidence || 0)
        };
        if (candidate.confidence > best.confidence || candidate.text.length > best.text.length + 8) best = candidate;
      }
      if (best.text) {
        const confidenceNote = best.confidence < 55 ? " [LOW CONFIDENCE — verify against the original image]" : "";
        transcripts.push("IMAGE " + (index + 1) + " (" + Math.round(best.confidence) + "% confidence)" + confidenceNote + ":\n" + best.text);
      }
    }
    return transcripts.join("\n\n").slice(0, 12000);
  } catch (error) {
    console.warn("Local OCR unavailable:", error?.message || error);
    return "";
  } finally {
    clearTimeout(ocrTimeout);
    if (worker) {
      try { await worker.terminate(); } catch (_) {}
    }
  }
}

function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


// Prompt-driven GitHub coding agent. GitHub credentials stay in this page and
// are sent only to api.github.com; the AI receives source code, never the token.
(() => {
  const repoInput = document.getElementById("github-repo");
  const tokenInput = document.getElementById("github-token");
  const taskInput = document.getElementById("github-coding-task");
  const runButton = document.getElementById("github-coding-run");
  const clearButton = document.getElementById("github-coding-clear");
  const status = document.getElementById("github-coding-status");
  const result = document.getElementById("github-coding-result");
  if (!repoInput || !tokenInput || !taskInput || !runButton || !status || !result) return;

  const ghHeaders = token => ({
    "Accept": "application/vnd.github+json",
    "Authorization": "Bearer " + token,
    "X-GitHub-Api-Version": "2022-11-28"
  });
  async function gh(token, path, options = {}) {
    const response = await fetch("https://api.github.com" + path, {
      ...options,
      headers: { ...ghHeaders(token), ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.message || ("GitHub API returned HTTP " + response.status);
      if (response.status === 401) throw new Error("GitHub token is invalid or expired. Create a fine-grained token with repository Contents and Pull requests read/write permissions.");
      if (response.status === 403) throw new Error("GitHub denied access. Check token permissions and repository access. " + message);
      throw new Error(message);
    }
    return data;
  }
  function decodeBase64Utf8(value) {
    const binary = atob(String(value || "").replace(/\n/g, ""));
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  }
  function encodeBase64Utf8(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  }
  function safePath(path) {
    return typeof path === "string" && path.length > 0 && !path.startsWith("/") &&
      !path.split("/").includes("..") && !path.includes("\\") &&
      !/(^|\/)(\.git|secrets?|\.env)(\/|$)/i.test(path) && !/\.(pem|key|p12|keystore)$/i.test(path);
  }
  function relevantFiles(tree, task) {
    const words = [...new Set((task.toLowerCase().match(/[a-z0-9_./-]{3,}/g) || [])
      .filter(w => !["the","and","for","with","that","this","from","into","fix","add","make","please","code","file"].includes(w)))];
    const sourceExt = /\.(js|mjs|ts|tsx|jsx|html|css|kt|java|gradle|kts|xml|json|py|go|rs|swift|dart|yml|yaml|md)$/i;
    const files = tree.filter(x => x.type === "blob" && safePath(x.path) && sourceExt.test(x.path) &&
      !/(^|\/)(build|node_modules|\.gradle|\.git|dist|vendor|\.idea)(\/|$)/i.test(x.path) &&
      !/lock\.(json|yaml|yml)$|\.min\.js$|\.wasm$|\.png$|\.jpg$|\.jpeg$|\.onnx$/i.test(x.path));
    return files.map(file => {
      const path = file.path.toLowerCase();
      let score = 0;
      for (const word of words) if (path.includes(word)) score += 4;
      if (/(readme|package\.json|build\.gradle|settings\.gradle|manifest|app\.js|worker\.js|index\.html)$/i.test(path)) score += 1;
      if (path.split("/").length <= 2) score += 1;
      return { ...file, score };
    }).sort((a,b) => b.score-a.score || a.path.localeCompare(b.path)).slice(0, 60);
  }
  async function getFile(token, repo, path, ref) {
    const data = await gh(token, "/repos/" + repo + "/contents/" + path.split("/").map(encodeURIComponent).join("/") + "?ref=" + encodeURIComponent(ref));
    if (Array.isArray(data) || data.type !== "file" || !data.content) return null;
    return { path, sha: data.sha, content: decodeBase64Utf8(data.content) };
  }
  function extractJson(text) {
    const raw = String(text || "").trim().replace(/^\x60{3}(?:json)?\s*/i, "").replace(/\s*\x60{3}$/i, "");
    const first = raw.indexOf("{"), last = raw.lastIndexOf("}");
    if (first < 0 || last <= first) throw new Error("The AI did not return a valid JSON code-change proposal. No files were changed.");
    try { return JSON.parse(raw.slice(first, last + 1)); }
    catch { throw new Error("The AI code proposal was not valid JSON. No files were changed."); }
  }
  async function askForPatch(prompt, files, treePaths) {
    const source = files.map(f => "\n--- FILE: " + f.path + " ---\n" + f.content).join("\n").slice(0, 36000);
    const instruction = [
      "You are FreeApp AI acting as a careful software engineer modifying an existing GitHub repository.",
      "Return ONLY valid JSON with this schema: {\"summary\":\"short summary\",\"files\":[{\"path\":\"existing/path or new/path\",\"content\":\"complete UTF-8 file contents\"}],\"tests\":[\"test or build command\"],\"notes\":[\"important limitations\"]}. For a deletion, use {\"path\":\"existing/path\",\"operation\":\"delete\"} with no content field.\n" + treePaths.slice(0, 80).join("\n"),
      "CURRENT SOURCE FILES:\n" + source,
      "USER'S REQUEST:\n" + prompt
    ].join("\n\n");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    let response;
    try {
      response = await fetch(API_BASE + "/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: instruction, images: [], history: [], memorySummary: "" }),
        signal: controller.signal
      });
    } catch (error) {
      if (error && error.name === "AbortError") throw new Error("Code generation exceeded 90 seconds. No repository files were changed; your task remains available for retry.");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((data.error || "FreeApp AI could not prepare a code change.") + (data.detail ? " " + data.detail : ""));
    return extractJson(data.result);
  }
  async function createBranch(token, repo, branchName, baseSha) {
    await gh(token, "/repos/" + repo + "/git/refs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: "refs/heads/" + branchName, sha: baseSha })
    });
  }
  async function commitFilesAtomically(token, repo, branch, parentSha, files) {
    const parent = await gh(token, "/repos/" + repo + "/git/commits/" + parentSha);
    const entries = await Promise.all(files.map(async file => {
      if (file.operation === "delete") {
        return { path: file.path, mode: "100644", type: "blob", sha: null };
      }
      const blob = await gh(token, "/repos/" + repo + "/git/blobs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: file.content, encoding: "utf-8" })
      });
      return { path: file.path, mode: "100644", type: "blob", sha: blob.sha };
    }));
    const tree = await gh(token, "/repos/" + repo + "/git/trees", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base_tree: parent.tree.sha, tree: entries })
    });
    const commit = await gh(token, "/repos/" + repo + "/git/commits", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "FreeApp AI: implement requested changes", tree: tree.sha, parents: [parentSha] })
    });
    await gh(token, "/repos/" + repo + "/git/refs/heads/" + branch.split("/").map(encodeURIComponent).join("/"), {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sha: commit.sha, force: false })
    });
    return commit.sha;
  }
  async function monitorPullRequestChecks(token, repo, branch, pullRequestNumber, commitSha) {
    // GitHub may omit pull_requests metadata for workflow_dispatch and some push-triggered
    // runs. Match the exact branch AND commit SHA instead, then evaluate every run.
    const deadline = Date.now() + 600000;
    let latestRuns = [];
    let lastError = null;
    while (Date.now() < deadline) {
      try {
        const query = "/repos/" + repo + "/actions/runs?head_sha=" +
          encodeURIComponent(commitSha) + "&per_page=100";
        const runs = await gh(token, query);
        latestRuns = (runs.workflow_runs || []).filter(run =>
          run.head_sha === commitSha && run.head_branch === branch
        );
        if (latestRuns.length && latestRuns.every(run => run.status === "completed")) break;
      } catch (error) {
        lastError = error;
      }
      await new Promise(resolve => setTimeout(resolve, 15000));
    }
    if (!latestRuns.length) {
      return {
        state: "not-detected",
        message: lastError
          ? "Could not retrieve PR checks: " + lastError.message
          : "No PR-triggered Actions runs were found for this exact commit. No passing result is claimed."
      };
    }
    const pending = latestRuns.filter(run => run.status !== "completed");
    if (pending.length) {
      return {
        state: "in-progress",
        url: pending[0].html_url,
        run_ids: latestRuns.map(run => run.id),
        message: "The verification deadline elapsed while one or more workflows were still running. No passing result is claimed."
      };
    }

    const runDetails = await Promise.all(latestRuns.map(async run => {
      const [jobData, artifactData] = await Promise.all([
        gh(token, "/repos/" + repo + "/actions/runs/" + run.id + "/jobs?per_page=100").catch(() => ({jobs:[]})),
        gh(token, "/repos/" + repo + "/actions/runs/" + run.id + "/artifacts?per_page=100").catch(() => ({artifacts:[]}))
      ]);
      const failed = (jobData.jobs || []).filter(job => job.conclusion === "failure");
      const logReports = await Promise.all(failed.slice(0, 3).map(async job => {
        try {
          const response = await fetch("https://api.github.com/repos/" + repo + "/actions/jobs/" + job.id + "/logs", {
            headers: ghHeaders(token), redirect: "follow"
          });
          const raw = await response.text();
          return { job: job.name, excerpt: raw.slice(-5000) };
        } catch (error) {
          return { job: job.name, excerpt: "Could not retrieve logs: " + error.message };
        }
      }));
      return {
        id: run.id,
        name: run.name,
        conclusion: run.conclusion || "unknown",
        url: run.html_url,
        jobs: (jobData.jobs || []).map(job => ({name:job.name,status:job.status,conclusion:job.conclusion})),
        failed_jobs: failed.map(job => job.name),
        failure_log_excerpts: logReports,
        artifacts: (artifactData.artifacts || []).filter(item => !item.expired)
          .map(item => ({name:item.name,size_in_bytes:item.size_in_bytes,download_url:item.archive_download_url}))
      };
    }));
    const failures = runDetails.filter(run => run.conclusion !== "success");
    return {
      state: failures.length ? "failure" : "success",
      url: runDetails[0]?.url,
      run_ids: runDetails.map(run => run.id),
      workflows: runDetails,
      failed_jobs: runDetails.flatMap(run => run.failed_jobs),
      artifacts: runDetails.flatMap(run => run.artifacts),
      message: failures.length
        ? "One or more PR workflows did not succeed. Review the per-workflow jobs and logs below."
        : "Every detected PR-triggered workflow for this exact commit completed successfully."
    };
  }
  const workflowSelect = document.getElementById("github-coding-workflow");
  const buildActionButton = document.getElementById("github-coding-build");
  const checkActionButton = document.getElementById("github-coding-check");
  const repairActionButton = document.getElementById("github-coding-repair");
  const deployActionButton = document.getElementById("github-coding-deploy");
  let lastPR = null, lastBranch = "", lastCommitSha = "", lastTask = "", lastChecks = null;
  try {
    const saved = JSON.parse(sessionStorage.getItem("freeapp_last_engineering_pr") || "null");
    if (saved && Number.isInteger(saved.number) && typeof saved.repo === "string") {
      lastPR = saved;
      lastBranch = saved.branch || "";
      lastCommitSha = saved.sha || "";
      if (repoInput && !repoInput.value) repoInput.value = saved.repo;
      lastTask = saved.task || "";
      checkActionButton.disabled = false;
      buildActionButton.disabled = false;
    }
  } catch (_) {}

  async function loadBuildWorkflows(token, repo, base) {
    if (!workflowSelect) return;
    workflowSelect.replaceChildren(new Option("Loading build workflows…", ""));
    try {
      const data = await gh(token, "/repos/" + repo + "/actions/workflows?per_page=100");
      const candidates = (data.workflows || []).filter(w => w.state === "active" &&
        /build|test|ci|validate|apk|android/i.test((w.name || "") + " " + (w.path || "")) &&
        !/deploy|release|publish/i.test((w.name || "") + " " + (w.path || "")));
      const supported = [];
      for (const workflow of candidates.slice(0, 25)) {
        try {
          const file = await getFile(token, repo, workflow.path, base);
          if (file && /^\s*workflow_dispatch\s*:/m.test(file.content)) supported.push(workflow);
        } catch (_) {}
      }
      workflowSelect.replaceChildren(new Option(
        supported.length ? "Choose build/test workflow" : "No manual build workflow found",
        ""
      ));
      for (const workflow of supported) {
        const option = new Option(workflow.name + " (" + workflow.path.split("/").pop() + ")", String(workflow.id));
        workflowSelect.appendChild(option);
      }
      if (buildActionButton) buildActionButton.disabled = !lastPR || !supported.length;
    } catch (error) {
      workflowSelect.replaceChildren(new Option("Could not load workflows — check Actions permission", ""));
      if (buildActionButton) buildActionButton.disabled = true;
    }
  }

  async function dispatchBuildWorkflow() {
    const repo = repoInput.value.trim(), token = tokenInput.value.trim();
    if (!lastPR || !lastBranch) throw new Error("Create a pull request first.");
    const workflowId = workflowSelect?.value;
    if (!workflowId) throw new Error("Select a build/test workflow first.");
    buildActionButton.disabled = true;
    status.textContent = "Dispatching the selected build workflow on " + lastBranch + "…";
    try {
      await gh(token, "/repos/" + repo + "/actions/workflows/" + encodeURIComponent(workflowId) + "/dispatches", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: lastBranch })
      });
      let run = null;
      for (let attempt = 0; attempt < 8 && !run; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const data = await gh(token, "/repos/" + repo + "/actions/runs?branch=" + encodeURIComponent(lastBranch) + "&event=workflow_dispatch&per_page=20");
        run = (data.workflow_runs || []).find(item =>
          Number(item.workflow_id) === Number(workflowId) && item.head_branch === lastBranch
        ) || null;
      }
      result.textContent = "Build workflow dispatched for branch " + lastBranch +
        (run ? "\nRun: " + run.html_url + "\nStatus: " + run.status : "\nGitHub accepted the dispatch. Open the repository Actions tab to follow the run.");
      status.textContent = "Build started. No build success is claimed until the workflow completes successfully.";
    } finally {
      buildActionButton.disabled = !lastPR || !workflowSelect?.value;
    }
  }

  async function refreshLatestPullRequestChecks() {
    const repo = repoInput.value.trim(), token = tokenInput.value.trim();
    if (!lastPR?.number) throw new Error("No pull request is recorded in this page session.");
    checkActionButton.disabled = true;
    status.textContent = "Reading the latest pull request commit and checking all GitHub Actions runs…";
    try {
      const pr = await gh(token, "/repos/" + repo + "/pulls/" + lastPR.number);
      await loadBuildWorkflows(token, repo, pr.base.ref);
      lastBranch = pr.head.ref;
      lastCommitSha = pr.head.sha;
      const checks = await monitorPullRequestChecks(token, repo, lastBranch, pr.number, lastCommitSha);
      lastChecks = checks;
      lastPR = { repo, number: pr.number, html_url: pr.html_url, branch: lastBranch, sha: lastCommitSha, merged: !!pr.merged_at, task: lastTask };
      sessionStorage.setItem("freeapp_last_engineering_pr", JSON.stringify(lastPR));
      repairActionButton.disabled = checks.state !== "failure";
      result.textContent = "Pull request: " + pr.html_url + "\nBranch: " + lastBranch + "\nCommit: " + lastCommitSha +
        "\n\nVerification: " + checks.state + " — " + checks.message +
        (checks.url ? "\nRun: " + checks.url : "") +
        (checks.failed_jobs?.length ? "\nFailed jobs: " + checks.failed_jobs.join(", ") : "") +
        (checks.workflows || []).flatMap(w => w.failure_log_excerpts || []).map(log =>
          "\n\n--- Failure log: " + log.job + " ---\n" + log.excerpt
        ).join("") +
        ((checks.artifacts || []).length ? "\n\nArtifacts: " + checks.artifacts.map(a => a.name).join(", ") : "");
      status.textContent = checks.state === "success" ? "All detected checks passed." :
        checks.state === "failure" ? "Checks failed. Review the logs or run Repair Failed Checks." :
        "Checks are pending or unavailable; no passing result is claimed.";
      return checks;
    } finally {
      checkActionButton.disabled = !lastPR;
    }
  }

  async function repairFailedPullRequest() {
    const repo = repoInput.value.trim(), token = tokenInput.value.trim();
    if (!lastPR?.number || !lastChecks || lastChecks.state !== "failure") throw new Error("Run Check PR & Debug first and wait for failed check logs.");
    const pr = await gh(token, "/repos/" + repo + "/pulls/" + lastPR.number);
    if (pr.head.repo?.full_name !== repo) throw new Error("This repair flow can push only to a pull request branch in the selected repository, not a fork.");
    const logs = (lastChecks.workflows || []).flatMap(w => w.failure_log_excerpts || [])
      .map(item => "FAILED JOB: " + item.job + "\n" + item.excerpt).join("\n\n").slice(0, 12000);
    if (!logs.trim()) throw new Error("GitHub did not provide failure logs. No repair commit was created.");
    const repairTask = "Debug and repair the failing GitHub Actions checks for this pull request. Preserve the requested feature and all working behavior. Use the actual failure logs below to identify root causes, make the smallest complete fix, and add or update tests where appropriate. Do not weaken tests or workflows to hide failures.\n\nOriginal task: " + lastTask + "\n\nFailure logs:\n" + logs;
    const treeData = await gh(token, "/repos/" + repo + "/git/trees/" + pr.head.sha + "?recursive=1");
    if (treeData.truncated) throw new Error("The PR branch tree is too large to inspect safely.");
    const candidates = relevantFiles(treeData.tree || [], repairTask);
    const loaded = [];
    let chars = 0;
    for (const file of candidates) {
      try {
        const source = await getFile(token, repo, file.path, pr.head.ref);
        if (!source || source.content.length > 14000 || chars + source.content.length > 36000) continue;
        loaded.push(source); chars += source.content.length;
        if (loaded.length >= 20) break;
      } catch (_) {}
    }
    if (!loaded.length) throw new Error("Could not read source files from the failed PR branch.");
    status.textContent = "Using failure logs to prepare a targeted repair…";
    const proposal = await askForPatch(repairTask, loaded, candidates.map(x => x.path));
    const validation = window.FreeAppCodingGuard.validateProposal(proposal, loaded.map(file => file.path), {
      allowWorkflowChanges: /\b(workflow|github actions|ci\/cd|deployment workflow|deploy workflow)\b/i.test(repairTask)
    });
    if (!validation.ok) throw new Error(validation.message);
    status.textContent = "Committing the repair to the existing PR branch…";
    const commitSha = await commitFilesAtomically(token, repo, pr.head.ref, pr.head.sha, validation.files);
    lastBranch = pr.head.ref;
    lastCommitSha = commitSha;
    lastTask = repairTask;
    lastPR = { repo, number: pr.number, html_url: pr.html_url, branch: lastBranch, sha: lastCommitSha, merged: false, task: lastTask };
    sessionStorage.setItem("freeapp_last_engineering_pr", JSON.stringify(lastPR));
    status.textContent = "Repair committed. Monitoring the new checks…";
    lastChecks = await monitorPullRequestChecks(token, repo, lastBranch, pr.number, commitSha);
    repairActionButton.disabled = lastChecks.state !== "failure";
    result.textContent = "Repair commit: " + commitSha + "\nPull request: " + pr.html_url +
      "\nFiles: " + validation.files.map(f => f.path + (f.operation === "delete" ? " (deleted)" : "")).join(", ") +
      "\nVerification: " + lastChecks.state + " — " + lastChecks.message +
      (lastChecks.url ? "\nRun: " + lastChecks.url : "");
    status.textContent = lastChecks.state === "success" ? "Repair checks passed." : "Repair committed; verification still needs attention.";
  }

  async function deployVerifiedMain() {
    const repo = repoInput.value.trim(), token = tokenInput.value.trim();
    if (!lastPR?.number) throw new Error("Create a pull request in this session, then merge it after review before deploying.");
    const pr = await gh(token, "/repos/" + repo + "/pulls/" + lastPR.number);
    if (!pr.merged_at) throw new Error("Deployment is blocked: the recorded pull request has not been merged.");
    const repository = await gh(token, "/repos/" + repo);
    const base = repository.default_branch || "main";
    if (pr.base.ref !== base) throw new Error("Deployment is limited to the repository's default branch.");
    const ref = await gh(token, "/repos/" + repo + "/git/ref/heads/" + encodeURIComponent(base));
    const headSha = ref.object.sha;
    const checkData = await gh(token, "/repos/" + repo + "/commits/" + headSha + "/check-runs?per_page=100");
    const checkRuns = (checkData.check_runs || []).filter(check => !/deploy/i.test(check.name || ""));
    if (!checkRuns.length || checkRuns.some(check => check.status !== "completed" || check.conclusion !== "success")) {
      throw new Error("Deployment is blocked: the latest default-branch commit does not have a complete set of successful check runs.");
    }
    const workflowData = await gh(token, "/repos/" + repo + "/actions/workflows?per_page=100");
    const deployment = (workflowData.workflows || []).find(w => w.state === "active" && /deploy/i.test((w.name || "") + " " + (w.path || "")));
    if (!deployment) throw new Error("No active deployment workflow was found.");
    const workflowFile = await getFile(token, repo, deployment.path, base);
    if (!workflowFile || !/^\s*workflow_dispatch\s*:/m.test(workflowFile.content)) {
      throw new Error("The deployment workflow does not support a manual workflow_dispatch event.");
    }
    if (!window.confirm("Deploy the VERIFIED default branch " + base + " at " + headSha.slice(0, 12) + " to production? This does not merge any pull request.")) return;
    deployActionButton.disabled = true;
    status.textContent = "Dispatching the production deployment from verified " + base + "…";
    try {
      await gh(token, "/repos/" + repo + "/actions/workflows/" + encodeURIComponent(deployment.id) + "/dispatches", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: base })
      });
      result.textContent = "Production deployment workflow dispatched.\nWorkflow: " + deployment.name +
        "\nBranch: " + base + "\nCommit: " + headSha +
        "\nOpen the repository Actions tab to confirm the final deployment result.";
      status.textContent = "Deployment started; production success is not claimed until the workflow completes.";
    } finally {
      deployActionButton.disabled = false;
    }
  }

  if (buildActionButton) buildActionButton.addEventListener("click", async () => {
    try { await dispatchBuildWorkflow(); }
    catch (error) { status.textContent = "Build dispatch failed."; result.textContent = error.message; }
  });
  if (checkActionButton) checkActionButton.addEventListener("click", async () => {
    try { await refreshLatestPullRequestChecks(); }
    catch (error) { status.textContent = "PR check failed."; result.textContent = error.message; }
  });
  if (repairActionButton) repairActionButton.addEventListener("click", async () => {
    repairActionButton.disabled = true;
    try { await repairFailedPullRequest(); }
    catch (error) { status.textContent = "Repair failed."; result.textContent = error.message; }
    finally { repairActionButton.disabled = !lastChecks || lastChecks.state !== "failure"; }
  });
  if (deployActionButton) deployActionButton.addEventListener("click", async () => {
    try { await deployVerifiedMain(); }
    catch (error) { status.textContent = "Deployment blocked or failed."; result.textContent = error.message; }
  });

  clearButton.addEventListener("click", () => { tokenInput.value = ""; status.textContent = "Token cleared from the input. It was not saved by FreeApp AI."; });
  runButton.addEventListener("click", async () => {
    const repo = repoInput.value.trim();
    const token = tokenInput.value.trim();
    const task = taskInput.value.trim();
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) { status.textContent = "Enter the repository as owner/name."; return; }
    if (!token) { status.textContent = "Paste a fine-grained GitHub token for this repository."; return; }
    if (!task) { status.textContent = "Describe the code change you want."; return; }
    runButton.disabled = true;
    result.textContent = "";
    let createdBranch = "";
    let pullRequestOpened = false;
    try {
      status.textContent = "Checking GitHub access and inspecting the repository...";
      const repository = await gh(token, "/repos/" + repo);
      if (!repository.permissions?.push) throw new Error("The GitHub token has no write access to this repository.");
      const base = repository.default_branch || "main";
      await loadBuildWorkflows(token, repo, base);
      const ref = await gh(token, "/repos/" + repo + "/git/ref/heads/" + encodeURIComponent(base));
      const treeData = await gh(token, "/repos/" + repo + "/git/trees/" + ref.object.sha + "?recursive=1");
      if (treeData.truncated) throw new Error("Repository is too large for a complete tree listing. Narrow the task or use a smaller repository.");
      const candidates = relevantFiles(treeData.tree || [], task);
      if (!candidates.length) throw new Error("No suitable source files were found in this repository.");
      const loaded = [];
      let chars = 0;
      for (const file of candidates) {
        try {
          const source = await getFile(token, repo, file.path, base);
          if (!source || source.content.length > 14000 || chars + source.content.length > 36000) continue;
          loaded.push(source); chars += source.content.length;
          if (loaded.length >= 20) break;
        } catch (_) {}
      }
      if (!loaded.length) throw new Error("Could not read usable source files. Check the token's Contents: read permission.");
      status.textContent = "Preparing a code change from " + loaded.length + " source file(s)...";
      const proposal = await askForPatch(task, loaded, candidates.map(x => x.path));
      lastTask = task;
      const validation = window.FreeAppCodingGuard.validateProposal(proposal, loaded.map(file => file.path), {
        allowWorkflowChanges: /\b(workflow|github actions|ci\/cd|deployment workflow|deploy workflow)\b/i.test(task)
      });
      if (!validation.ok) {
        if (validation.noChanges) {
          result.textContent = validation.message;
          status.textContent = "No repository files changed.";
          return;
        }
        throw new Error(validation.message);
      }
      const files = validation.files;
      status.textContent = "Creating a separate branch and committing " + files.length + " file(s)...";
      const branch = "freeapp-ai/" + new Date().toISOString().replace(/[^0-9TZ]/g, "-").replace(/-+$/,"").toLowerCase() + "-" + window.FreeAppCodingGuard.randomSuffix();
      await createBranch(token, repo, branch, ref.object.sha);
      createdBranch = branch;
      const commitSha = await commitFilesAtomically(token, repo, branch, ref.object.sha, files);
      lastBranch = branch;
      lastCommitSha = commitSha;
      status.textContent = "Opening a review pull request...";
      const body = [
        "## FreeApp AI coding proposal",
        "",
        "**Request:** " + task,
        "",
        "**AI summary:** " + (proposal.summary || "Code changes proposed."),
        "",
        "### Suggested tests",
        (proposal.tests || []).map(x => "- " + x).join("\n") || "- Run the repository's existing test/build workflow.",
        "",
        "### Notes",
        (proposal.notes || []).map(x => "- " + x).join("\n") || "- Review the code and run the project's tests before merging.",
        "",
        "Generated by FreeApp AI. This pull request was not auto-merged."
      ].join("\n").slice(0, 6000);
      const pr = await gh(token, "/repos/" + repo + "/pulls", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "FreeApp AI: " + (proposal.summary || task).slice(0, 180), head: branch, base, body })
      });
      pullRequestOpened = true;
      lastPR = { repo, number: pr.number, html_url: pr.html_url, branch, sha: commitSha, merged: false, task: lastTask };
      sessionStorage.setItem("freeapp_last_engineering_pr", JSON.stringify(lastPR));
      checkActionButton.disabled = false;
      buildActionButton.disabled = !workflowSelect?.value;
      status.textContent = "Pull request opened. Monitoring automated checks...";
      const checks = await monitorPullRequestChecks(token, repo, branch, pr.number, commitSha).catch(error => ({state:"unknown",message:error.message}));
      lastChecks = checks;
      repairActionButton.disabled = checks.state !== "failure";
      result.textContent = "Pull request created: " + pr.html_url + "\n\nBranch: " + branch + "\nAtomic commit: " + commitSha + "\nFiles changed: " + files.map(f => f.path).join(", ") +
        "\n\nSummary: " + (proposal.summary || "Code changes proposed.") +
        "\n\nSuggested tests: " + ((proposal.tests || []).join("; ") || "Repository Actions checks.") +
        "\n\nAutomated verification: " + checks.state + " — " + checks.message + (checks.url ? "\nRun: " + checks.url : "") +
        (checks.failed_jobs?.length ? "\nFailed jobs: " + checks.failed_jobs.join(", ") : "") +
        "\n\nThe agent creates reviewable changes and monitors CI. It does not merge or deploy without explicit authorization.";
      status.textContent = checks.state === "success" ? "Code committed; automated checks passed." : "Code committed; verification needs attention.";
    } catch (error) {
      if (createdBranch && !pullRequestOpened) {
        const refPath = "/repos/" + repo + "/git/refs/heads/" + createdBranch.split("/").map(encodeURIComponent).join("/");
        await gh(token, refPath, { method: "DELETE" }).catch(() => {});
      }
      status.textContent = "GitHub coding task failed.";
      result.textContent = String(error && error.message || error);
    } finally {
      runButton.disabled = false;
    }
  });
})();
