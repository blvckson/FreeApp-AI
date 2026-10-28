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
  moveIntoMenu(imageInput && imageInput.closest(".controls"));
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

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_KEY_STORAGE = "freeapp_ai_gemini_api_key_v1";
const apiKeyInput = document.getElementById("gemini-api-key");
const apiKeySaveButton = document.getElementById("gemini-key-save");
const apiKeyClearButton = document.getElementById("gemini-key-clear");
const apiKeyStatus = document.getElementById("gemini-key-status");
if (apiKeyInput) apiKeyInput.value = localStorage.getItem(GEMINI_KEY_STORAGE) || "";
if (localStorage.getItem("freeapp_ai_owner_key")) localStorage.removeItem("freeapp_ai_owner_key");
if (apiKeySaveButton) apiKeySaveButton.addEventListener("click", () => {
  const key = String(apiKeyInput?.value || "").trim();
  if (!key) { if (apiKeyStatus) apiKeyStatus.textContent = "Paste your Gemini API key first."; return; }
  localStorage.setItem(GEMINI_KEY_STORAGE, key);
  if (apiKeyStatus) apiKeyStatus.textContent = "Gemini key saved on this device. Requests go directly to Google; the key is not sent to GitHub.";
});
if (apiKeyClearButton) apiKeyClearButton.addEventListener("click", () => {
  localStorage.removeItem(GEMINI_KEY_STORAGE);
  if (apiKeyInput) apiKeyInput.value = "";
  if (apiKeyStatus) apiKeyStatus.textContent = "Gemini key cleared from this device.";
});
function getGeminiKey() {
  const key = String(localStorage.getItem(GEMINI_KEY_STORAGE) || apiKeyInput?.value || "").trim();
  if (!key) throw new Error("Set your Gemini API key in the three-dot menu before using AI features. Cloudflare has been removed.");
  return key;
}
async function callGemini({ contents, systemInstruction, googleSearch = false, maxOutputTokens = 8192, temperature = 0.4, jsonMode = false }) {
  const body = {
    system_instruction: { parts: [{ text: String(systemInstruction || "You are FreeApp AI, a helpful research, reasoning, learning and coding assistant. Be accurate, transparent about uncertainty, and never claim actions you did not perform.") }] },
    contents,
    generationConfig: { temperature, maxOutputTokens }
  };
  if (googleSearch) body.tools = [{ google_search: {} }];
  if (jsonMode) body.generationConfig.responseMimeType = "application/json";
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent?key=" + encodeURIComponent(getGeminiKey()), {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data?.error?.message || ("Google Gemini request failed (HTTP " + response.status + ".")) + (response.status === 400 ? " Check the key, API access, and model availability." : ""));
  const candidate = data?.candidates?.[0];
  const text = (candidate?.content?.parts || []).map(part => part.text || "").join("\n").trim();
  if (!text) throw new Error("Gemini returned no text. Finish reason: " + (candidate?.finishReason || "unknown") + ".");
  const grounding = candidate?.groundingMetadata?.groundingChunks || [];
  const sources = grounding.map(chunk => chunk.web).filter(web => web?.uri).map(web => ({ title: web.title || web.uri, url: web.uri }));
  return { text, sources, researched: sources.length > 0, raw: data };
}
function imagePart(dataUrl) {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(String(dataUrl || ""));
  if (!match) return null;
  return { inline_data: { mime_type: match[1], data: match[2] } };
}
function historyContents(history) {
  return (Array.isArray(history) ? history : []).slice(-12).filter(m => m && typeof m.content === "string" && m.content.trim()).map(m => ({
    role: m.role === "assistant" || m.role === "model" ? "model" : "user",
    parts: [{ text: m.content.slice(0, 5000) }]
  }));
}
function parseJsonObject(text) {
  try { return JSON.parse(String(text || "").trim()); } catch (_) { return null; }
}

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
      const planned = await callGemini({
        systemInstruction: "Convert the user's ordinary phone task into a transparent, reviewable sequence for an Android accessibility helper. Return strict JSON only: {\\"summary\\":\\"...\\",\\"actions\\":[\\"one command per line\\"]}. Maximum 12 actions. Allowed commands: 'open Gmail' or 'open <installed app name>'; 'check system updates'; 'tap: <visible label>'; 'type: <ordinary non-sensitive text>'; 'scroll down'; 'scroll up'; 'back'; 'home'. Never invent labels, recipients, or values. Never type passwords, OTPs, security codes or payment-card details. Do not perform purchases, send messages, delete data, or change security settings without a separate user-confirmed action. This is a plan only.",
        contents: [{ role: "user", parts: [{ text: "PHONE TASK TO PLAN:\\n" + raw }] }],
        maxOutputTokens: 1000, temperature: 0.1, jsonMode: true
      });
      const data = parseJsonObject(planned.text);
      if (!data || !Array.isArray(data.actions) || !data.actions.length) throw new Error("No usable actions were planned. Add exact visible button labels or break the task into smaller steps.");
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
  if (!url || !task) { websiteStatus.textContent = "Enter a public website address and describe what you want researched."; return; }
  let parsed;
  try { parsed = new URL(url); } catch (_) { websiteStatus.textContent = "Enter a valid website address beginning with https://."; return; }
  if (!["http:", "https:"].includes(parsed.protocol)) { websiteStatus.textContent = "Only public HTTP or HTTPS websites are supported."; return; }
  websiteRunButton.disabled = true;
  websiteStatus.textContent = "Researching the website directly with Gemini and Google Search. No cloud browser or website actions are used.";
  websiteResult.textContent = "";
  try {
    const result = await callGemini({
      systemInstruction: "You are FreeApp AI's public website research assistant. Use Google Search grounding when available. Research the supplied URL and user task, cite relevant sources as URLs, and be explicit if the page could not be accessed or verified. This is read-only research: do not claim to click, fill, submit, sign in, or change anything on a website.",
      contents: [{ role: "user", parts: [{ text: "Website: " + parsed.href + "\nTask: " + task + "\nResearch public information about this page and complete the task as a read-only research response." }] }],
      googleSearch: true, maxOutputTokens: 6000
    });
    websiteResult.textContent = result.text + (result.sources.length ? "\n\nSources:\n" + result.sources.map(s => "- " + s.title + ": " + s.url).join("\n") : "\n\nNo grounded web sources were returned.");
    websiteStatus.textContent = result.researched ? "Website research finished with Google Search sources. No website actions were performed." : "Research finished, but Gemini returned no grounded source links.";
  } catch (error) {
    websiteStatus.textContent = "Website research failed.";
    websiteResult.textContent = error?.message || "The website research request failed.";
  } finally { websiteRunButton.disabled = false; }
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

    const contents = historyContents(conversationHistory);
    const userParts = [{ text: prompt + (persistentMemory ? "\n\nRelevant saved context from this device (use only if applicable):\n" + persistentMemory : "") }];
    for (const dataUrl of images) { const part = imagePart(dataUrl); if (part) userParts.push(part); }
    contents.push({ role: "user", parts: userParts });
    const result = await callGemini({
      systemInstruction: "You are FreeApp AI: a highly capable, warm, emotionally intelligent research, reasoning, learning, and software-building assistant. Follow the user's request carefully, preserve topic continuity, explain assumptions and uncertainty, and never claim that code was changed, an app was built, a website was operated, or research was verified unless it happened. For current facts, use Google Search grounding and cite sources. For screenshots, inspect the provided images. Give complete, testable code when requested. Do not modify this app or its source code automatically; explain proposed code changes instead.",
      contents, googleSearch: true, maxOutputTokens: 8192, temperature: 0.4
    });
    const data = { result: result.text, sources: result.sources, researched: result.researched };
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
    const result = await callGemini({
      systemInstruction: "Maintain a concise, user-controlled assistant memory summary. Extract useful stable preferences, ongoing projects, explicit constraints, device/workflow facts, and unresolved next steps. Exclude passwords, API keys, private keys, authentication codes, financial details, highly sensitive personal data, and speculative inferences. Return only the updated memory summary in plain text, maximum 1800 characters.",
      contents: [{ role: "user", parts: [{ text: "PREVIOUS MEMORY SUMMARY:\n" + (persistentMemory || "(none)") + "\n\nRECENT CONVERSATION:\n" + conversationHistory.slice(-16).map(m => m.role.toUpperCase() + ": " + m.content).join("\n\n").slice(0, 12000) }] }],
      maxOutputTokens: 700, temperature: 0.1
    });
    if (result.text.trim()) {
      persistentMemory = result.text.trim().slice(0, 3500);
      try { localStorage.setItem(MEMORY_KEY, persistentMemory); } catch (_) {}
      if (conversationNote) conversationNote.textContent = "Conversation context and useful project/preferences memory are saved on this device. Clear both any time.";
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

function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
