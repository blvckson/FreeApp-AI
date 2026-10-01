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

const narratorSettingsButton = document.getElementById("narrator-settings-button");
const narratorModal = document.getElementById("narrator-modal");
const narratorClose = document.getElementById("narrator-close");
const narratorEnabled = document.getElementById("narrator-enabled");
const narratorVoice = document.getElementById("narrator-voice");
const narratorAudio = document.getElementById("narrator-audio");
const narratorAudioStatus = document.getElementById("narrator-audio-status");
const narratorAuto = document.getElementById("narrator-auto");
const narratorSave = document.getElementById("narrator-save");
const narratorTest = document.getElementById("narrator-test");
const narratorClone = document.getElementById("narrator-clone");
const narratorNote = document.getElementById("narrator-note");

let narratorAudioUrl = localStorage.getItem("freeapp_ai_narrator_audio") || "";
let narratorAudioName = localStorage.getItem("freeapp_ai_narrator_audio_name") || "";
let narratorVoiceId = localStorage.getItem("freeapp_ai_narrator_voice_id") || "";
const narratorDefaults = {
  enabled: localStorage.getItem("freeapp_ai_narrator_enabled") === "true",
  auto: localStorage.getItem("freeapp_ai_narrator_auto") === "true",
  voice: localStorage.getItem("freeapp_ai_narrator_voice") || ""
};

function loadNarratorVoices() {
  const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  narratorVoice.replaceChildren();
  for (const voice of voices) {
    const option = document.createElement("option");
    option.value = voice.name;
    option.textContent = voice.name + (voice.lang ? " (" + voice.lang + ")" : "");
    option.dataset.lang = voice.lang || "en";
    narratorVoice.appendChild(option);
  }
  if (!narratorVoice.children.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Default device voice";
    narratorVoice.appendChild(option);
  }
  if (narratorDefaults.voice && Array.from(narratorVoice.options).some(o => o.value === narratorDefaults.voice)) {
    narratorVoice.value = narratorDefaults.voice;
  }
}

function openNarratorSettings(firstOpen = false) {
  loadNarratorVoices();
  narratorEnabled.checked = narratorDefaults.enabled;
  narratorAuto.checked = narratorDefaults.auto;
  if (narratorAudioName) narratorAudioStatus.textContent = "Custom voice sample saved: " + narratorAudioName;
  if (firstOpen) narratorNote.textContent = "Choose a voice to use for narration. You can also upload your own voice and create an AI clone.";
  narratorModal.hidden = false;
}

function closeNarratorSettings() {
  narratorModal.hidden = true;
}

async function cloneNarratorVoice() {
  const file = narratorAudio.files?.[0];
  if (!file) { narratorNote.textContent = "Choose a voice recording first."; return; }
  if (file.size > 8 * 1024 * 1024) { narratorNote.textContent = "Voice sample is too large. Please choose an audio file under 8 MB."; return; }
  narratorClone.disabled = true;
  narratorNote.textContent = "Uploading the sample and creating the AI voice clone...";
  try {
    const audio = await toDataUrl(file);
    const response = await fetch("/api/voice-clone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio, voiceName: "My FreeApp Narrator" })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Voice cloning failed.");
    narratorVoiceId = data.voiceId || "";
    if (!narratorVoiceId) throw new Error("No cloned voice ID was returned.");
    localStorage.setItem("freeapp_ai_narrator_voice_id", narratorVoiceId);
    narratorNote.textContent = "AI voice cloned successfully. FreeApp AI will now use this voice for server narration.";
    narratorAudioStatus.textContent = "Cloned voice ready: " + (data.voiceName || "My FreeApp Narrator");
  } catch (error) {
    narratorNote.textContent = error.message;
  } finally {
    narratorClone.disabled = false;
  }
}

function saveNarratorSettings() {
  localStorage.setItem("freeapp_ai_narrator_enabled", String(narratorEnabled.checked));
  localStorage.setItem("freeapp_ai_narrator_auto", String(narratorAuto.checked));
  localStorage.setItem("freeapp_ai_narrator_voice", narratorVoice.value || "");
  if (narratorAudio.files?.[0]) {
    const file = narratorAudio.files[0];
    if (file.size > 8 * 1024 * 1024) {
      narratorNote.textContent = "Voice sample is too large. Please choose an audio file under 8 MB.";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        localStorage.setItem("freeapp_ai_narrator_audio", reader.result);
        localStorage.setItem("freeapp_ai_narrator_audio_name", file.name);
        narratorAudioUrl = reader.result;
        narratorAudioName = file.name;
        narratorAudioStatus.textContent = "Custom voice sample saved: " + file.name;
        narratorNote.textContent = narratorVoiceId ? "Narrator settings saved. Your AI-cloned voice is ready." : "Saved on this device. You can create an AI voice clone with the Clone my voice button.";
      } catch {
        narratorNote.textContent = "The sample could not be stored on this device.";
      }
    };
    reader.readAsDataURL(file);
  } else {
    narratorNote.textContent = "Narrator settings saved.";
  }
  narratorDefaults.enabled = narratorEnabled.checked;
  narratorDefaults.auto = narratorAuto.checked;
  narratorDefaults.voice = narratorVoice.value || "";
  if (narratorVoiceId) localStorage.setItem("freeapp_ai_narrator_voice_id", narratorVoiceId);
  closeNarratorSettings();
}

async function playServerNarration(text) {
  try {
    const response = await fetch("/api/narrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: String(text).slice(0, 10000), voiceId: narratorVoiceId })
    });
    if (!response.ok) throw new Error("Server narration failed.");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play();
  } catch {
    speakText(text);
  }
}

function speakText(text) {
  if (!narratorDefaults.enabled || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const clean = String(text).replace(/https?:\/\/\S+/g, "").replace(/\[SOURCE \d+\]/g, "").slice(0, 12000);
  if (!clean.trim()) return;
  const utterance = new SpeechSynthesisUtterance(clean);
  const voice = Array.from(window.speechSynthesis.getVoices()).find(v => v.name === narratorDefaults.voice);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }
  utterance.rate = 1;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

if (narratorSettingsButton) narratorSettingsButton.addEventListener("click", () => openNarratorSettings(false));
if (narratorClose) narratorClose.addEventListener("click", closeNarratorSettings);
if (narratorSave) narratorSave.addEventListener("click", saveNarratorSettings);
if (narratorTest) narratorTest.addEventListener("click", async () => {
  if (narratorVoiceId) await playServerNarration("Hello. I am your FreeApp AI narrator.");
  else speakText("Hello. I am your FreeApp AI narrator.");
});
if (narratorClone) narratorClone.addEventListener("click", cloneNarratorVoice);
if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = loadNarratorVoices;

if (!localStorage.getItem("freeapp_ai_narrator_setup_done")) {
  localStorage.setItem("freeapp_ai_narrator_setup_done", "true");
  setTimeout(() => openNarratorSettings(true), 300);
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

async function askAI() {
  const prompt = promptBox.value.trim();
  if (!prompt && !selectedImages.length) {
    statusBox.textContent = "Enter a question or attach an image first.";
    return;
  }

  buildButton.disabled = true;
  statusBox.textContent = "Analyzing your request and researching relevant sources...";
  resultBox.textContent = "";
  mediaBox.replaceChildren();
  sourceList.replaceChildren();
  sourcesBox.hidden = true;

  try {
    const images = [];
    for (const file of selectedImages) images.push(await toDataUrl(file));

    const selfModify = ["modify yourself", "upgrade yourself", "fix yourself", "change yourself", "improve yourself", "add yourself"].some(prefix => prompt.toLowerCase().startsWith(prefix));
    if (selfModify) {
      let ownerKey = localStorage.getItem("freeapp_ai_owner_key") || "";
      if (!ownerKey) {
        ownerKey = window.prompt("Enter your FreeApp AI owner key:");
        if (ownerKey) localStorage.setItem("freeapp_ai_owner_key", ownerKey);
      }
      if (!ownerKey) throw new Error("Owner key is required for self-modification.");

      statusBox.textContent = "Owner command accepted — inspecting code and preparing the change...";
      const response = await fetch("/api/self-modify", {
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
          ? "\\n\\nChanged: " + data.files.map(f => f.path).join(", ")
          : "") +
        (Array.isArray(data.notes) && data.notes.length
          ? "\\n\\nNotes:\\n- " + data.notes.join("\\n- ")
          : "");

      statusBox.textContent = data.changed
        ? "Self-modification committed to main. GitHub Actions should now build and deploy it."
        : "No code change was necessary.";
      return;
    }

    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, images })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "The AI service returned an error.");

    resultBox.textContent = data.result || "No response was returned.";
    if (narratorDefaults.auto || narratorDefaults.enabled) {
      if (narratorVoiceId) await playServerNarration(data.result || "No response was returned.");
      else speakText(data.result || "No response was returned.");
    }

    renderMedia(data.media);
    renderSources(data.sources);

    statusBox.textContent = data.researched
      ? "Done — live research was used."
      : "Done.";
  } catch (error) {
    statusBox.textContent = "Request failed.";
    resultBox.textContent = error.message;
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

function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
