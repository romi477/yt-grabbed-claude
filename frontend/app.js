// API base URL — backend is always on port 8000
const API = `http://${window.location.hostname}:8000`;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const urlInput       = document.getElementById("url-input");
const btnInfo        = document.getElementById("btn-info");
const videoPreview   = document.getElementById("video-preview");
const previewThumb   = document.getElementById("preview-thumb");
const previewTitle   = document.getElementById("preview-title");
const previewUploader = document.getElementById("preview-uploader");
const previewDuration = document.getElementById("preview-duration");
const typeRow        = document.getElementById("type-row");
const qualityRow     = document.getElementById("quality-row");
const qualitySelect  = document.getElementById("quality-select");
const downloadRow    = document.getElementById("download-row");
const btnDownload    = document.getElementById("btn-download");
const progressRow    = document.getElementById("progress-row");
const progressBar    = document.getElementById("progress-bar");
const progressLabel  = document.getElementById("progress-label");
const saveRow        = document.getElementById("save-row");
const saveLink       = document.getElementById("save-link");
const btnNew         = document.getElementById("btn-new");
const errorRow       = document.getElementById("error-row");
const errorMsg       = document.getElementById("error-msg");

// ── State ─────────────────────────────────────────────────────────────────────
let pollTimer = null;

// ── Helpers ───────────────────────────────────────────────────────────────────
function show(...els) { els.forEach(el => el.classList.remove("hidden")); }
function hide(...els) { els.forEach(el => el.classList.add("hidden")); }

function showError(msg) {
  errorMsg.textContent = msg;
  show(errorRow);
}

function clearError() { hide(errorRow); }

function formatDuration(seconds) {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ── Step 1: Get Info ──────────────────────────────────────────────────────────
btnInfo.addEventListener("click", getInfo);
urlInput.addEventListener("keydown", e => { if (e.key === "Enter") getInfo(); });

async function getInfo() {
  const url = urlInput.value.trim();
  if (!url) return;

  clearError();
  hide(videoPreview, typeRow, qualityRow, downloadRow, progressRow, saveRow);
  btnInfo.disabled = true;
  btnInfo.textContent = "Loading…";

  try {
    const res = await fetch(`${API}/api/info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to fetch info");
    }
    const data = await res.json();
    renderInfo(data);
  } catch (e) {
    showError(e.message);
  } finally {
    btnInfo.disabled = false;
    btnInfo.textContent = "Get Info";
  }
}

function renderInfo(data) {
  previewThumb.src = data.thumbnail || "";
  previewTitle.textContent = data.title || "Unknown title";
  previewUploader.textContent = data.uploader || "";
  previewDuration.textContent = formatDuration(data.duration);

  // Populate quality select
  qualitySelect.innerHTML = "";
  const qualities = data.available_qualities || [];
  qualities.forEach(q => {
    const opt = document.createElement("option");
    opt.value = q;
    opt.textContent = `${q}p`;
    qualitySelect.appendChild(opt);
  });
  if (!qualities.length) {
    const opt = document.createElement("option");
    opt.value = "best";
    opt.textContent = "Best";
    qualitySelect.appendChild(opt);
  }

  show(videoPreview, typeRow, qualityRow, downloadRow);
  updateTypeUI();
}

// ── Step 2: Type toggle ───────────────────────────────────────────────────────
document.querySelectorAll("input[name='dl-type']").forEach(radio => {
  radio.addEventListener("change", updateTypeUI);
});

function updateTypeUI() {
  const isAudio = document.querySelector("input[name='dl-type']:checked").value === "audio";
  isAudio ? hide(qualityRow) : show(qualityRow);
}

// ── Step 3: Download ──────────────────────────────────────────────────────────
btnDownload.addEventListener("click", startDownload);

async function startDownload() {
  const url = urlInput.value.trim();
  const type = document.querySelector("input[name='dl-type']:checked").value;
  const quality = qualitySelect.value || "best";

  clearError();
  hide(saveRow);
  show(progressRow);
  btnDownload.disabled = true;
  setProgress(0);

  try {
    const res = await fetch(`${API}/api/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, type, quality }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to start download");
    }
    const { job_id } = await res.json();
    pollJob(job_id);
  } catch (e) {
    showError(e.message);
    hide(progressRow);
    btnDownload.disabled = false;
  }
}

// ── Step 4: Poll job ──────────────────────────────────────────────────────────
function pollJob(jobId) {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    try {
      const res = await fetch(`${API}/api/jobs/${jobId}`);
      const job = await res.json();

      setProgress(job.progress || 0);

      if (job.status === "done") {
        clearInterval(pollTimer);
        setProgress(100);
        onDownloadDone(job);
      } else if (job.status === "error") {
        clearInterval(pollTimer);
        hide(progressRow);
        btnDownload.disabled = false;
        showError(job.error || "Download failed");
      }
    } catch (e) {
      clearInterval(pollTimer);
      showError("Lost connection to server");
    }
  }, 1000);
}

function setProgress(pct) {
  progressBar.style.width = `${pct}%`;
  progressLabel.textContent = `${Math.round(pct)}%`;
}

// ── Step 5: Done → show Save ──────────────────────────────────────────────────
async function onDownloadDone() {
  hide(progressRow);
  btnDownload.disabled = false;

  // Find the newest file in data/
  try {
    const res = await fetch(`${API}/api/files`);
    const files = await res.json();
    if (files.length) {
      const newest = files.sort((a, b) => b.modified - a.modified)[0];
      saveLink.href = `${API}/api/files/${encodeURIComponent(newest.name)}`;
      saveLink.download = newest.name;
    }
  } catch (_) {}

  show(saveRow);
}

// ── Part 2: Transcribe ───────────────────────────────────────────────────────

const fileSelect      = document.getElementById("file-select");
const btnRefreshFiles = document.getElementById("btn-refresh-files");
const modelSelect     = document.getElementById("model-select");
const btnTranscribe   = document.getElementById("btn-transcribe");
const trProgressRow   = document.getElementById("tr-progress-row");
const trResultRow     = document.getElementById("tr-result-row");
const trTextarea      = document.getElementById("tr-textarea");
const trErrorRow      = document.getElementById("tr-error-row");
const trErrorMsg      = document.getElementById("tr-error-msg");

let trJobId   = null;
let trPollTimer = null;
let trJobTitle = "";

// Load file list on page load and on refresh click
async function loadFileList() {
  try {
    const res = await fetch(`${API}/api/files`);
    const files = await res.json();
    fileSelect.innerHTML = '<option value="">— select a downloaded file —</option>';
    files
      .sort((a, b) => b.modified - a.modified)
      .forEach(f => {
        const opt = document.createElement("option");
        opt.value = f.name;
        opt.textContent = `${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB)`;
        fileSelect.appendChild(opt);
      });
  } catch (_) {}
}

loadFileList();
btnRefreshFiles.addEventListener("click", loadFileList);

// Start transcription
btnTranscribe.addEventListener("click", async () => {
  const filename = fileSelect.value;
  if (!filename) return;

  trErrorRow.classList.add("hidden");
  trResultRow.classList.add("hidden");
  trProgressRow.classList.remove("hidden");
  btnTranscribe.disabled = true;

  trJobTitle = filename.replace(/\.[^.]+$/, ""); // strip extension for export title

  try {
    const res = await fetch(`${API}/api/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, model: modelSelect.value }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to start transcription");
    }
    const data = await res.json();
    trJobId = data.job_id;
    pollTranscribeJob(trJobId);
  } catch (e) {
    trProgressRow.classList.add("hidden");
    trErrorMsg.textContent = e.message;
    trErrorRow.classList.remove("hidden");
    btnTranscribe.disabled = false;
  }
});

function pollTranscribeJob(jobId) {
  clearInterval(trPollTimer);
  trPollTimer = setInterval(async () => {
    try {
      const res = await fetch(`${API}/api/transcribe/${jobId}`);
      const job = await res.json();

      if (job.status === "done") {
        clearInterval(trPollTimer);
        trProgressRow.classList.add("hidden");
        trTextarea.value = job.result || "";
        trResultRow.classList.remove("hidden");
        btnTranscribe.disabled = false;
      } else if (job.status === "error") {
        clearInterval(trPollTimer);
        trProgressRow.classList.add("hidden");
        trErrorMsg.textContent = job.error || "Transcription failed";
        trErrorRow.classList.remove("hidden");
        btnTranscribe.disabled = false;
      }
    } catch (e) {
      clearInterval(trPollTimer);
      trErrorMsg.textContent = "Lost connection to server";
      trErrorRow.classList.remove("hidden");
    }
  }, 2000);
}

// Export buttons
async function doExport(format) {
  if (!trJobId) return;
  try {
    const res = await fetch(`${API}/api/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: trJobId, format, title: trJobTitle }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Export failed");
    }
    // Trigger browser download
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${trJobTitle}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    trErrorMsg.textContent = e.message;
    trErrorRow.classList.remove("hidden");
  }
}

document.getElementById("btn-export-txt").addEventListener("click",  () => doExport("txt"));
document.getElementById("btn-export-pdf").addEventListener("click",  () => doExport("pdf"));
document.getElementById("btn-export-json").addEventListener("click", () => doExport("json"));

// ── Reset ─────────────────────────────────────────────────────────────────────
btnNew.addEventListener("click", () => {
  urlInput.value = "";
  hide(videoPreview, typeRow, qualityRow, downloadRow, progressRow, saveRow, errorRow);
  document.querySelector("input[name='dl-type'][value='video']").checked = true;
  updateTypeUI();
});
