import { _electron as electron, expect } from '@playwright/test';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import electronPath from 'electron';

await mkdir('.test-data', { recursive: true });
const directory = await mkdtemp(path.resolve('.test-data/electron-'));
const env = { ...process.env, TREE_REGISTER_TEST_DATA: path.join(directory, 'profile'), TREE_REGISTER_SMOKE: '1' };
delete env.ELECTRON_RUN_AS_NODE;
const executablePath = process.env.TREE_REGISTER_PACKAGED_EXE || electronPath;
const args = process.env.TREE_REGISTER_PACKAGED_EXE ? [] : [path.resolve('.')];
let instance;
const errors = [];
async function launch() {
  instance = await electron.launch({ executablePath, args, env, timeout: 30000 });
  const page = await instance.firstWindow();
  page.on('pageerror', e => errors.push(e.message));
  await expect(page.getByRole('heading', { name: 'フォルダから、データカタログへ。' })).toBeVisible();
  return page;
}
try {
  let page = await launch();
  const runtime = await instance.evaluate(() => {
    const { DatabaseSync } = process.getBuiltinModule('node:sqlite');
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE smoke (value TEXT); INSERT INTO smoke VALUES (\'ok\')');
    const result = db.prepare('SELECT value FROM smoke').get(); db.close();
    return { node: process.versions.node, electron: process.versions.electron, sqlite: result.value };
  });
  assert.equal(runtime.sqlite, 'ok');
  await expect(page.getByText('登録済みの階層を 1 件検出しました')).toBeVisible();
  await page.getByRole('button', { name: '登録済み階層をまとめて対象外にする' }).click();
  await expect(page.getByRole('button', { name: '↓ 登録設定をJSONで保存' })).toBeEnabled();
  const tree = page.getByRole('tree');
  await tree.focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown');
  await expect(page.locator('[role=treeitem][aria-selected=true]')).toContainText('01_人口');
  await page.keyboard.press('Home'); await page.keyboard.press('Enter');
  await page.getByRole('textbox', { name: 'タイトル' }).fill('SQLite保存・復元テスト');
  await expect.poll(() => page.evaluate(async () => (await window.tree.getState()).nodes[0].title)).toBe('SQLite保存・復元テスト');
  await page.getByRole('textbox', { name: 'タグを検索' }).fill('人口');
  await page.getByRole('checkbox', { name: '人口', exact: true }).check();
  await page.getByRole('textbox', { name: 'タグを検索' }).fill('CSV');
  await expect(page.locator('#editor').getByText('人口', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(async () => (await window.tree.getState()).nodes[0].tagIds.length)).toBe(3);
  await instance.close();
  page = await launch();
  await expect(page.getByRole('textbox', { name: 'タイトル' })).toHaveValue('SQLite保存・復元テスト');
  await page.getByRole('button', { name: '1万件・階層超過を試す' }).click();
  await expect(page.getByText('読込・登録処理を停止しています', { exact: true })).toBeVisible();
  assert.equal((await page.evaluate(() => window.tree.getState())).failure.checked, 751);
  await expect(page.getByRole('button', { name: '↓ 登録設定をJSONで保存' })).toBeDisabled();
  await page.screenshot({ path: path.join(directory, 'depth-error.png'), fullPage: true });
  await page.getByRole('button', { name: '前の設定に戻る' }).click();
  await expect(page.getByRole('button', { name: '↓ 登録設定をJSONで保存' })).toBeEnabled();
  // Replace native dialogs only inside the test process; production exposes no arbitrary path API.
  const root = path.join(directory, '実フォルダ');
  await mkdir(path.join(root, '空フォルダ'), { recursive: true });
  await writeFile(path.join(root, 'data.csv'), 'value\n1');
  await instance.evaluate(({ dialog }, root) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [root] }); }, root);
  const state = await page.evaluate(() => window.tree.chooseFolder());
  assert.equal(state.nodes.length, 3); assert.equal(state.demo, false);
  assert(state.nodes.some(n => n.name === '空フォルダ'));
  const output = path.join(directory, 'catalog-registration.json');
  await instance.evaluate(({ dialog }, output) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: output }); }, output);
  await page.evaluate(() => window.tree.exportConfig());
  const result = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(result.datasets.length, 1); assert.equal(result.catalogs.length, 2);
  assert.equal((await page.evaluate(() => window.tree.getState())).registry.length, 1);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'タイトル' })).toHaveValue('実フォルダ');
  await page.screenshot({ path: path.join(directory, 'desktop.png'), fullPage: true });
  const large = path.join(directory, '大量フォルダ');
  await mkdir(large);
  for (let batch = 0; batch < 100; batch++) {
    await Promise.all(Array.from({ length: 100 }, (_, i) => writeFile(path.join(large, `data-${String(batch * 100 + i).padStart(5, '0')}.csv`), '')));
  }
  await instance.evaluate(({ dialog }, root) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [root] }); }, large);
  const largeState = await page.evaluate(() => window.tree.chooseFolder());
  assert.equal(largeState.nodes.length, 10001);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'タイトル' })).toHaveValue('大量フォルダ');
  assert(await page.getByRole('treeitem').count() <= 22);
  await page.getByRole('tree').focus(); await page.keyboard.press('End');
  await expect(page.locator('[role=treeitem][aria-selected=true]')).toContainText(largeState.nodes.at(-1).name);
  assert(await page.getByRole('treeitem').count() <= 22);
  await page.getByRole('textbox', { name: 'フォルダ・ファイルを検索' }).fill('no-such-file');
  await expect(page.getByText('一致する項目はありません。')).toBeVisible();
  await page.getByRole('tree').focus(); await page.keyboard.press('ArrowDown');
  await page.getByRole('textbox', { name: 'フォルダ・ファイルを検索' }).fill('data-00001');
  await expect(page.getByRole('treeitem')).toHaveCount(2);
  // Import a real registry and verify duplicate prevention, including its descendants.
  const ledger = path.join(directory, 'registry.json');
  await writeFile(ledger, JSON.stringify({ entries: [{ sourceId: 'local', path: '大量フォルダ', catalogId: 'REAL-001', title: '登録済み実フォルダ', registeredAt: '2026-09-15' }] }));
  await instance.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, ledger);
  await page.evaluate(() => window.tree.importRegistry());
  await page.reload();
  await expect(page.getByText('登録済みの階層を 1 件検出しました')).toBeVisible();
  await expect(page.getByRole('button', { name: '↓ 登録設定をJSONで保存' })).toBeDisabled();
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'PASS', runtime, checks: ['SQLite in Electron', 'duplicate exclusion', 'keyboard', 'tag selection', 'restart persistence', '751/10000 stop', 'real folder + empty folder', 'JSON export', '10,000 real files + virtual scrolling', 'empty search', 'registry import'], artifacts: directory }, null, 2));
} finally { if (instance) await instance.close(); }
