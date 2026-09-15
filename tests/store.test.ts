import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { Store } from '../src/database/store';
import { sampleState } from '../src/domain/seeds';

test('SQLite restores edits and rolls back invalid replacement without losing prior state', () => {
  mkdirSync('.test-data', { recursive: true });
  const directory = mkdtempSync(path.resolve('.test-data/store-'));
  const filename = path.join(directory, 'state.sqlite');
  let store = new Store(filename);
  try {
    const state = store.load();
    state.nodes[0].title = '再起動後も保持';
    store.updateNode(state.nodes[0]); store.close(); store = new Store(filename);
    assert.equal(store.load().nodes[0].title, '再起動後も保持');
    const invalid = sampleState(); invalid.categories[1].name = invalid.categories[0].name;
    assert.throws(() => store.save(invalid));
    assert.equal(store.load().nodes[0].title, '再起動後も保持');
    const failed = store.load(); failed.failure = { kind: 'depth', message: '停止', path: 'bad/path', limit: 3, checked: 751, depth: 4 };
    store.saveHeader(failed); store.close(); store = new Store(filename);
    assert.equal(store.load().failure!.checked, 751);
    assert.equal(store.load().nodes[0].title, '再起動後も保持');
  } finally {
    store.close(); assert(directory.startsWith(path.resolve('.test-data') + path.sep)); rmSync(directory, { recursive: true, force: true });
  }
});
