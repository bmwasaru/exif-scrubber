const dropzone = document.getElementById('dropzone');
const fileList = document.getElementById('fileList');
const btnProcess = document.getElementById('btnProcess');
const btnClear = document.getElementById('btnClear');
const btnPickDir = document.getElementById('btnPickDir');
const outputDirInput = document.getElementById('outputDir');
const overwriteCheckbox = document.getElementById('overwrite');
const statusEl = document.getElementById('status');

let pickedOutputDir = null;
let files = [];

// Global drag handlers to keep the window droppable
document.addEventListener('dragover', (e) => {
  e.preventDefault();
});
document.addEventListener('drop', (e) => {
  e.preventDefault();
});

// Dropzone visual + capture paths
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});
dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('dragover');
});
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  const paths = [...(e.dataTransfer?.files || [])].map(f => f.path).filter(Boolean);
  addFiles(paths);
});

btnClear.addEventListener('click', () => {
  files = [];
  refreshList();
});

btnPickDir.addEventListener('click', async () => {
  const dir = await window.api.pickOutputDir();
  if (dir) {
    pickedOutputDir = dir;
    outputDirInput.value = dir;
  }
});

btnProcess.addEventListener('click', async () => {
  if (files.length === 0) {
    status('No files to process.', 'err');
    return;
  }
  status(`Processing ${files.length} file(s)…`);
  const res = await window.api.processFiles(files, {
    outputDir: pickedOutputDir,
    overwrite: overwriteCheckbox.checked
  });
  if (!res?.ok) {
    status(`Error: ${res?.error || 'unknown error'}`, 'err');
    return;
  }
  // Show per-file results
  const out = res.results.map(r => {
    if (r.status === 'ok') {
      return `<div class="result-ok">✔ ${escapeHtml(basename(r.src))} → ${escapeHtml(r.dest)}</div>`;
    } else {
      return `<div class="result-err">✖ ${escapeHtml(basename(r.src))} — ${escapeHtml(r.error)}</div>`;
    }
  }).join('');
  statusEl.innerHTML = out || 'Done.';
});

window.api.onProgress(({ index, total, file }) => {
  status(`(${index}/${total}) Cleaning: ${file}…`);
});

function addFiles(paths) {
  const unique = new Set(files);
  for (const p of paths) unique.add(p);
  files = [...unique];
  refreshList();
}

function refreshList() {
  if (files.length === 0) {
    fileList.hidden = true;
    fileList.innerHTML = '';
    status('');
    return;
  }
  fileList.hidden = false;
  fileList.innerHTML = files.map(p => `<div class="file">${escapeHtml(p)}</div>`).join('');
  status('');
}

function status(msg, kind) {
  if (!msg) { statusEl.textContent = ''; return; }
  const cls = kind === 'err' ? 'result-err' : 'muted';
  statusEl.innerHTML = `<span class="${cls}">${escapeHtml(msg)}</span>`;
}

function basename(p) {
  return p.split(/[\\/]/).pop();
}
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
