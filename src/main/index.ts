import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { Worker } from 'node:worker_threads';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import type { Progress } from '../shared/types';

// Smoke tests use a separate data directory and never alter the user's database.
if (process.env.TREE_REGISTER_TEST_DATA) app.setPath('userData', process.env.TREE_REGISTER_TEST_DATA);
if (!app.requestSingleInstanceLock()) app.exit(0);
let window: BrowserWindow;
let worker: Worker;
let workerAlive = false;
let busy = false;
let shuttingDown = false;
app.on('second-instance', () => {
  if (window && !window.isDestroyed()) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); }
});
const pending = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }>();
function request<T = any>(method: string, args?: unknown): Promise<T> {
  if (!workerAlive) return Promise.reject(new Error('保存処理が利用できません。アプリを再起動してください。'));
  const id = randomUUID();
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); worker.postMessage({ id, method, args }); });
}
async function exclusive<T>(operation: () => Promise<T>) {
  if (busy) throw new Error('現在の処理が完了するまでお待ちください。');
  busy = true;
  try { return await operation(); } finally { busy = false; }
}
function handle(name: string, operation: (...args: any[]) => any) {
  ipcMain.handle('tree:' + name, (event, ...args) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('許可されていない送信元です。');
    return operation(...args);
  });
}

app.whenReady().then(async () => {
  await mkdir(app.getPath('userData'), { recursive: true });
  worker = new Worker(path.join(__dirname, '../workers/service.js'), { workerData: { databasePath: path.join(app.getPath('userData'), 'tree-register.sqlite') } });
  workerAlive = true;
  worker.on('message', (message: { id?: string; result?: unknown; error?: string; progress?: Progress }) => {
    if (message.progress) { if (window && !window.isDestroyed()) window.webContents.send('tree:progress', message.progress); return; }
    const item = pending.get(message.id!);
    if (!item) return;
    pending.delete(message.id!);
    if (message.error) item.reject(new Error(message.error)); else item.resolve(message.result);
  });
  const fail = (error: Error) => { workerAlive = false; for (const p of pending.values()) p.reject(error); pending.clear(); };
  worker.on('error', fail);
  worker.on('exit', code => { if (!shuttingDown) fail(new Error(`保存処理が終了しました（${code}）。アプリを再起動してください。`)); });
  window = new BrowserWindow({ width: 1500, height: 1000, minWidth: 900, minHeight: 650, backgroundColor: '#f5f7f4',
    show: !process.env.TREE_REGISTER_SMOKE,
    webPreferences: { preload: path.join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false, sandbox: true,
      offscreen: !!process.env.TREE_REGISTER_SMOKE, backgroundThrottling: !process.env.TREE_REGISTER_SMOKE } });
  window.setMenuBarVisibility(false);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  handle('getState', () => request('getState'));
  for (const method of ['sample', 'restore', 'updateSettings', 'addCategory', 'excludeRegistered']) {
    handle(method, args => exclusive(() => request(method, args)));
  }
  handle('updateNode', (id, patch) => {
    if (busy) throw new Error('処理中のため編集できません。');
    return request('updateNode', { id, patch });
  });
  handle('moveTag', (id, categoryId) => exclusive(() => request('moveTag', { id, categoryId })));
  handle('depthDemo', () => exclusive(() => request('depthDemo', { jobId: randomUUID() })));
  handle('chooseFolder', () => exclusive(async () => {
    const result = await dialog.showOpenDialog(window, { title: '登録するフォルダを選択', properties: ['openDirectory'] });
    if (result.canceled) return null;
    return request('scan', { root: result.filePaths[0], jobId: randomUUID() });
  }));
  handle('importRegistry', () => exclusive(async () => {
    const result = await dialog.showOpenDialog(window, { title: '登録済み台帳を置き換えるJSONを選択', filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile'] });
    if (result.canceled) return null;
    return request('importRegistry', result.filePaths[0]);
  }));
  handle('exportConfig', () => exclusive(async () => {
    const configuration = await request('export', { jobId: randomUUID() });
    const result = await dialog.showSaveDialog(window, { title: '登録設定を保存', defaultPath: 'catalog-registration.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (result.canceled || !result.filePath) return null;
    const temporary = result.filePath + '.' + randomUUID() + '.tmp';
    try { await writeFile(temporary, JSON.stringify(configuration, null, 2), { encoding: 'utf8', flag: 'wx' }); await rename(temporary, result.filePath); }
    finally { await rm(temporary, { force: true }); }
    return result.filePath;
  }));
  const devUrl = process.env.TREE_REGISTER_DEV_URL;
  if (devUrl && !app.isPackaged && devUrl === 'http://127.0.0.1:5173') await window.loadURL(devUrl);
  else await window.loadFile(path.join(__dirname, '../renderer/index.html'));
}).catch(error => { dialog.showErrorBox('起動できませんでした', String(error)); app.quit(); });

app.on('window-all-closed', () => app.quit());
app.on('before-quit', event => {
  if (shuttingDown || !worker || !workerAlive) return;
  event.preventDefault(); shuttingDown = true;
  request('close').catch(() => {}).finally(async () => { workerAlive = false; await worker.terminate(); app.quit(); });
});
