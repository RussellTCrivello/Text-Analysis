// Preload script. The renderer is fully sandboxed; expose only a tiny,
// read-only bridge so the UI can detect that it is running on the desktop.
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
})
