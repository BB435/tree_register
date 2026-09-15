import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { collect, walk, ScanError, type Entry } from '../src/workers/scan';

test('10,000-item stream is stopped at the first excess entry and iterator is closed', async () => {
  let read = 0, closed = false;
  function* entries(): Generator<Entry> {
    try {
      for (let i = 0; i < 10000; i++) {
        read++;
        yield { path: i === 0 ? 'root' : 'root/item' + i, absolutePath: 'C:/root/' + i, kind: i === 0 ? 'folder' : 'file', depth: i === 750 ? 4 : i === 0 ? 1 : 2 };
      }
    } finally { closed = true; }
  }
  await assert.rejects(collect(entries(), 3, 'test', () => {}), (error: unknown) => {
    assert(error instanceof ScanError); assert.equal(error.detail.checked, 751); assert.equal(error.detail.depth, 4); return true;
  });
  assert.equal(read, 751); assert(closed);
});

test('10,000 valid entries succeed with stable parent references', async () => {
  function* entries(): Generator<Entry> {
    yield { path: 'root', kind: 'folder', absolutePath: 'C:/root', depth: 1 };
    for (let i = 1; i < 10000; i++) yield { path: 'root/file' + i + '.csv', kind: 'file', absolutePath: 'C:/root/file' + i + '.csv', depth: 2 };
  }
  const nodes = await collect(entries(), 2, 'test', () => {});
  assert.equal(nodes.length, 10000); assert(nodes.slice(1).every(n => n.parentId === nodes[0].id));
});

test('filesystem traversal includes empty folders and fails before descending too deep', async () => {
  await mkdir('.test-data', { recursive: true });
  const temporary = await mkdtemp(path.resolve('.test-data/scan-'));
  try {
    const root = path.join(temporary, 'root');
    await mkdir(path.join(root, 'empty'), { recursive: true });
    await writeFile(path.join(root, 'file.csv'), 'unused');
    const nodes = await collect(walk(root, temporary), 2, 'test', () => {});
    assert(nodes.some(n => n.name === 'empty' && n.kind === 'folder'));
    assert.equal(nodes.length, 3);
    await mkdir(path.join(root, 'deep', 'deeper'), { recursive: true });
    await assert.rejects(collect(walk(root, temporary), 2, 'test', () => {}), ScanError);
  } finally {
    // mkdtemp creates this exact fixture under the workspace; never delete a user-supplied path.
    assert(temporary.startsWith(path.resolve('.test-data') + path.sep));
    await rm(temporary, { recursive: true, force: true });
  }
});
