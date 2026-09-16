import { contextBridge, ipcRenderer } from 'electron';
import type { TreeAPI, Progress } from '../shared/types';

const api: TreeAPI = {
  getState: () => ipcRenderer.invoke('tree:getState'),
  chooseFolder: () => ipcRenderer.invoke('tree:chooseFolder'),
  sample: () => ipcRenderer.invoke('tree:sample'),
  depthDemo: () => ipcRenderer.invoke('tree:depthDemo'),
  restore: () => ipcRenderer.invoke('tree:restore'),
  updateNode: (id, patch) => ipcRenderer.invoke('tree:updateNode', id, patch),
  updateSettings: settings => ipcRenderer.invoke('tree:updateSettings', settings),
  addCategory: name => ipcRenderer.invoke('tree:addCategory', name),
  addTag: (label, categoryId) => ipcRenderer.invoke('tree:addTag', label, categoryId),
  updateTagDescription: (id, description) => ipcRenderer.invoke('tree:updateTagDescription', id, description),
  moveTag: (id, categoryId) => ipcRenderer.invoke('tree:moveTag', id, categoryId),
  importRegistry: () => ipcRenderer.invoke('tree:importRegistry'),
  excludeRegistered: () => ipcRenderer.invoke('tree:excludeRegistered'),
  exportConfig: () => ipcRenderer.invoke('tree:exportConfig'),
  onProgress: callback => {
    const listener = (_event: unknown, progress: Progress) => callback(progress);
    ipcRenderer.on('tree:progress', listener);
    return () => { ipcRenderer.removeListener('tree:progress', listener); };
  },
};
contextBridge.exposeInMainWorld('tree', api);
