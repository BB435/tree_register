import { opendir, realpath, lstat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Progress, SourceNode, ScanFailure } from '../shared/types';
import { isWithin, pathKey } from '../domain/catalog';

export class ScanError extends Error {
  constructor(public detail: ScanFailure) { super(detail.message); }
}
export interface Entry { path: string; kind: 'folder' | 'file'; absolutePath: string; depth: number }

// Iterative depth-first traversal keeps only open ancestor directories, not a full file list.
export async function* walk(root: string, base: string): AsyncGenerator<Entry> {
  const stat = await lstat(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('通常のフォルダを選択してください。リンクは探索しません。');
  const relative = path.relative(base, root).split(path.sep).join('/');
  if (!relative || !isWithin(root, base)) throw new Error('選択位置が管理元の基準位置と一致しません。別の管理元IDを設定してください。');
  yield { path: relative, kind: 'folder', absolutePath: root, depth: 1 };
  const stack: { dir: Awaited<ReturnType<typeof opendir>>; absolute: string; relative: string; depth: number }[] = [];
  try {
    stack.push({ dir: await opendir(root), absolute: root, relative, depth: 1 });
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const child = await frame.dir.read();
      if (!child) { await frame.dir.close(); stack.pop(); continue; }
      const absolute = path.join(frame.absolute, child.name);
      const sourcePath = frame.relative + '/' + child.name;
      // Yield before opening a child directory: the consumer can reject excess depth immediately.
      if (child.isSymbolicLink()) throw new Error(`リンク・ジャンクションは探索しません：${absolute}`);
      if (!child.isDirectory() && !child.isFile()) throw new Error(`未対応の項目が含まれています：${absolute}`);
      yield { path: sourcePath, kind: child.isDirectory() ? 'folder' : 'file', absolutePath: absolute, depth: frame.depth + 1 };
      if (child.isDirectory()) {
        const resolved = await realpath(absolute);
        if (!isWithin(resolved, root)) throw new Error(`選択範囲外へのリンクを検出しました：${absolute}`);
        stack.push({ dir: await opendir(absolute), absolute, relative: sourcePath, depth: frame.depth + 1 });
      }
    }
  } finally {
    await Promise.allSettled(stack.map(f => f.dir.close()));
  }
}

export async function collect(entries: AsyncIterable<Entry> | Iterable<Entry>, limit: number, jobId: string,
  progress: (p: Progress) => void, total?: number): Promise<SourceNode[]> {
  const pending: SourceNode[] = [], byPath = new Map<string, string>();
  const comparisonKeys = new Set<string>();
  let checked = 0, current = '';
  try {
    for await (const entry of entries) {
      checked++; current = entry.path;
      if (entry.depth > limit) throw new ScanError({ kind: 'depth', message: '最大階層を超えたため読込全体を停止しました。',
        path: entry.path, depth: entry.depth, limit, checked, total });
      const key = pathKey(entry.path);
      if (comparisonKeys.has(key)) throw new Error(`大文字・小文字だけが異なる同名項目には対応していません：${entry.path}`);
      comparisonKeys.add(key);
      const parentPath = entry.path.slice(0, entry.path.lastIndexOf('/'));
      const id = randomUUID(), parentId = entry.depth === 1 ? null : byPath.get(parentPath);
      if (parentId === undefined) throw new Error('親フォルダが見つかりません。');
      const name = entry.path.split('/').at(-1)!;
      pending.push({ id, parentId, name, kind: entry.kind, sourcePath: entry.path, absolutePath: entry.absolutePath,
        depth: entry.depth, mode: entry.kind === 'file' ? 'dataset' : parentId ? 'sub' : 'top',
        title: entry.kind === 'file' ? name.replace(/\.[^.]+$/, '') : name, description: '', tagIds: [], inherit: false });
      byPath.set(entry.path, id);
      if (checked === 1 || checked % 100 === 0) progress({ jobId, checked, path: current, total });
    }
    progress({ jobId, checked, path: current, total });
    return pending;
  } catch (error) {
    if (error instanceof ScanError) throw error;
    throw new ScanError({ kind: 'io', message: error instanceof Error ? error.message : String(error), path: current, limit, checked, total });
  }
}
