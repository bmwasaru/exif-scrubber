const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  pickOutputDir: () => ipcRenderer.invoke('pick-output-dir'),
  processFiles: (filePaths, options) =>
    ipcRenderer.invoke('process-files', {
      filePaths,
      outputDir: options?.outputDir || null,
      overwrite: !!options?.overwrite
    }),
  onProgress: (cb) => {
    const listener = (_event, data) => cb?.(data);
    ipcRenderer.on('progress', listener);
    return () => ipcRenderer.removeListener('progress', listener);
  }
});
