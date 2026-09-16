import { parentPort, workerData } from 'node:worker_threads';
import { readFile, stat, realpath, lstat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Store } from '../database/store';
import { analyze, exportConfiguration, isWithin, pathKey } from '../domain/catalog';
import { sampleState } from '../domain/seeds';
import { collect, walk, ScanError, type Entry } from './scan';
import { nodePatchInput, registryInput, settingsInput } from '../shared/validation';
import type { Snapshot } from '../shared/types';

const port = parentPort!;
const store = new Store(workerData.databasePath);
let state = store.load();
const commit = (next: Snapshot) => { store.save(next); state = next; return state; };
function assertEditable() {
  if (analyze(state).blocked) throw new Error('読込停止中は設定項目を編集できません。エラーを解消してください。');
}
function progress(value: unknown) { port.postMessage({ progress: value }); }

async function run(method: string, args: any) {
  switch (method) {
    case 'getState': return state;
    case 'sample': return commit(sampleState());
    case 'restore': {
      const next = { ...state, failure: null }; store.saveHeader(next); state = next; return state;
    }
    case 'updateSettings': {
      const input = settingsInput.parse(args);
      const next = { ...state, settings: { ...state.settings, ...input } };
      // Binding a different source does not silently reinterpret an already loaded folder.
      const base = next.settings.sourceRoots[input.sourceId];
      if (base && state.rootPath && !state.demo) {
        if (!isWithin(state.rootPath, base)) throw new Error('この管理元IDは別の基準位置に対応しています。新しいIDを入力してフォルダを再選択してください。');
        next.nodes = state.nodes.map(n => ({ ...n, sourcePath: path.relative(base, n.absolutePath).split(path.sep).join('/') }));
      }
      return commit(next);
    }
    case 'updateNode': {
      assertEditable();
      if (typeof args?.id !== 'string') throw new Error('項目IDが不正です。');
      const patch = nodePatchInput.parse(args.patch);
      const n = state.nodes.find(n => n.id === args.id);
      if (!n) throw new Error('項目が見つかりません。');
      const allowed = n.kind === 'folder' ? ['top', 'sub', 'exclude'] : ['dataset', 'standalone', 'exclude'];
      if (patch.mode && !allowed.includes(patch.mode)) throw new Error('この項目に指定できない登録区分です。');
      if (patch.tagIds && (new Set(patch.tagIds).size !== patch.tagIds.length || patch.tagIds.some(id => !state.tags.some(t => t.id === id)))) throw new Error('タグが不正です。');
      if (patch.catalogCategoryId && !state.categories.some(c => c.id === patch.catalogCategoryId)) throw new Error('カタログカテゴリが不正です。');
      const next = { ...n, ...patch };
      store.updateNode(next); state.nodes = state.nodes.map(item => item.id === n.id ? next : item);
      return null;
    }
    case 'addCategory': {
      assertEditable();
      if (typeof args !== 'string' || !args.trim() || args.trim().length > 40) throw new Error('カテゴリ名は1〜40文字で入力してください。');
      const name = args.trim();
      if (state.categories.some(c => c.name === name)) throw new Error('同名のカテゴリがあります。');
      return commit({ ...state, categories: [...state.categories, { id: randomUUID(), name }] });
    }
    case 'addTag': {
      assertEditable();
      if (typeof args?.label !== 'string' || !args.label.trim() || args.label.trim().length > 100) throw new Error('タグ名は1〜100文字で入力してください。');
      if (typeof args?.categoryId !== 'string' || !state.categories.some(c => c.id === args.categoryId)) throw new Error('タグのカテゴリを選択してください。');
      const label = args.label.trim();
      if (state.tags.some(t => t.label === label)) throw new Error('同名のタグがあります。');
      return commit({ ...state, tags: [...state.tags, { id: randomUUID(), label, description: '', categoryId: args.categoryId }] });
    }
    case 'updateTagDescription': {
      assertEditable();
      if (typeof args?.id !== 'string' || !state.tags.some(t => t.id === args.id)) throw new Error('タグが見つかりません。');
      if (typeof args?.description !== 'string' || args.description.length > 10000) throw new Error('タグ説明は10,000文字以内で入力してください。');
      return commit({ ...state, tags: state.tags.map(t => t.id === args.id ? { ...t, description: args.description } : t) });
    }
    case 'moveTag': {
      assertEditable();
      if (!state.categories.some(c => c.id === args?.categoryId) || !state.tags.some(t => t.id === args?.id)) throw new Error('タグまたはカテゴリが不正です。');
      return commit({ ...state, tags: state.tags.map(t => t.id === args.id ? { ...t, categoryId: args.categoryId } : t) });
    }
    case 'importRegistry': {
      const size = (await stat(args)).size;
      if (size > 5_000_000) throw new Error('台帳JSONは5,000,000バイト以下にしてください。');
      const { entries } = registryInput.parse(JSON.parse(await readFile(args, 'utf8')));
      const keys = new Set<string>();
      for (const r of entries) {
        const key = JSON.stringify([r.sourceId, pathKey(r.path)]);
        if (keys.has(key)) throw new Error('台帳に同じ管理元・パスの重複があります。');
        keys.add(key);
      }
      return commit({ ...state, registry: entries });
    }
    case 'excludeRegistered': {
      assertEditable(); const a = analyze(state);
      return commit({ ...state, nodes: state.nodes.map(n => a.registered.has(n.id) ? { ...n, mode: 'exclude' } : n) });
    }
    case 'scan': {
      let root = String(args.root), current = root;
      const limit = state.settings.maxDepth;
      const sourceId = state.demo && state.settings.sourceId === 'demo' ? 'local' : state.settings.sourceId;
      try {
        if ((await lstat(root)).isSymbolicLink()) throw new Error('リンク・ジャンクションは探索しません。元のフォルダを選択してください。');
        root = await realpath(root);
        const base = state.settings.sourceRoots[sourceId] ?? path.dirname(root);
        if (!isWithin(root, base)) throw new Error('管理元IDに対応する基準位置の外です。別の管理元IDを設定してください。');
        const nodes = await collect(walk(root, base), limit, args.jobId, p => { current = p.path; progress(p); }, undefined, state.settings.depthPolicy === 'truncate');
        const excluded = new Set(state.settings.excludedExtensions ?? []);
        const adjusted = nodes.map(n => n.kind === 'file' && excluded.has(path.extname(n.name).toLowerCase()) ? { ...n, mode: 'exclude' as const } : n);
        return commit({ ...state, nodes: adjusted, rootPath: root, demo: false, failure: null,
          settings: { ...state.settings, sourceId, sourceRoots: { ...state.settings.sourceRoots, [sourceId]: base } } });
      } catch (e) {
        const failure = e instanceof ScanError ? e.detail : { kind: 'io' as const, message: e instanceof Error ? e.message : String(e), path: current, limit, checked: 0 };
        const next = { ...state, failure }; store.saveHeader(next); state = next; return state;
      }
    }
    case 'depthDemo': {
      const limit = state.settings.maxDepth;
      function* entries(): Generator<Entry> {
        yield { path: '大量データ', absolutePath: 'demo:/大量データ', kind: 'folder', depth: 1 };
        for (let i = 1; i < 10000; i++) yield {
          path: i === 750 ? '大量データ/' + Array.from({ length: limit }, (_, j) => '階層' + (j + 2)).join('/') + '/超過.csv' : `大量データ/データ${i}.csv`,
          absolutePath: `demo:/大量データ/データ${i}.csv`, kind: 'file', depth: i === 750 ? limit + 2 : 2,
        };
      }
      try { await collect(entries(), limit, args.jobId, progress, 10000); }
      catch (e) {
        if (!(e instanceof ScanError)) throw e;
        const next = { ...state, failure: e.detail }; store.saveHeader(next); state = next;
      }
      return state;
    }
    case 'export': {
      exportConfiguration(state); // Reject invalid configuration before opening any filesystem traversal.
      try {
        if (!state.demo) {
          const base = state.settings.sourceRoots[state.settings.sourceId];
          const fresh = await collect(walk(state.rootPath, base), state.settings.maxDepth, args.jobId, progress, undefined, state.settings.depthPolicy === 'truncate');
          const previous = new Map(state.nodes.map(n => [pathKey(n.sourcePath), n.kind]));
          if (fresh.length !== previous.size || fresh.some(n => previous.get(pathKey(n.sourcePath)) !== n.kind)) {
            throw new ScanError({ kind: 'io', message: 'フォルダの内容が読込時から変わっています。フォルダを再選択してください。',
              path: state.rootPath, limit: state.settings.maxDepth, checked: fresh.length });
          }
        }
      } catch (e) {
        if (e instanceof ScanError) { const next = { ...state, failure: e.detail }; store.saveHeader(next); state = next; }
        throw e;
      }
      return exportConfiguration(state);
    }
    case 'close': store.close(); return true;
    default: throw new Error('未対応の処理です。');
  }
}

// A single queue owns the SQLite connection and all authoritative state.
let queue = Promise.resolve();
port.on('message', ({ id, method, args }) => {
  queue = queue.then(async () => {
    try { port.postMessage({ id, result: await run(method, args) }); }
    catch (error) { port.postMessage({ id, error: error instanceof Error ? error.message : String(error) }); }
  });
});
