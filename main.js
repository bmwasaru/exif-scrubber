const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { randomUUID } = require('crypto');
const { exiftool } = require('exiftool-vendored');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 820,
    height: 560,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', async () => {
  try { await exiftool.end(); } catch {}
  if (process.platform !== 'darwin') app.quit();
});

// Choose an output directory
ipcMain.handle('pick-output-dir', async () => {
  const res = await dialog.showOpenDialog(win, {
    properties: ['openDirectory', 'createDirectory']
  });
  if (res.canceled || !res.filePaths?.[0]) return null;
  return res.filePaths[0];
});

// Core: process files -> strip metadata -> save as UUID.ext
ipcMain.handle('process-files', async (event, payload) => {
  const { filePaths, outputDir, overwrite } = payload || {};
  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    return { ok: false, error: 'No files received.' };
  }

  // Where to put cleaned files if outputDir not provided
  const defaultDir = (f) => path.join(path.dirname(f), 'cleaned');

  const results = [];
  for (let i = 0; i < filePaths.length; i++) {
    const src = filePaths[i];

    try {
      const ext = path.extname(src) || '';
      const uuid = randomUUID();
      const outDir = outputDir || defaultDir(src);
      const dest = path.join(outDir, `${uuid}${ext}`);

      // Ensure destination folder exists
      fs.mkdirSync(outDir, { recursive: true });

      if (overwrite) {
        // Overwrite original file contents with metadata removed,
        // then rename file to UUID in place.
        await exiftool.write(src, {}, ['-all=', '-overwrite_original']);
        const renamedPath = path.join(path.dirname(src), `${uuid}${ext}`);
        fs.renameSync(src, renamedPath);
        results.push({ src, dest: renamedPath, status: 'ok', overwritten: true });
      } else {
        // Write a NEW cleaned file with UUID name
        // This runs: exiftool -all= -o dest src
        await exiftool.write(src, {}, ['-all=', '-o', dest]);
        results.push({ src, dest, status: 'ok', overwritten: false });
      }

      win.webContents.send('progress', {
        index: i + 1,
        total: filePaths.length,
        file: path.basename(src)
      });
    } catch (err) {
      // Fallback: if stripping fails, do not silently copy the original
      // (copying would keep metadata). Report failure instead.
      results.push({ src, status: 'error', error: String(err) });
    }
  }

  return { ok: true, results };
});
