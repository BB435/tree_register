import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, exportConfiguration, isWithin } from '../src/domain/catalog';
import { sampleState } from '../src/domain/seeds';
import { registryInput, settingsInput } from '../src/shared/validation';

test('sample tags and DCAT standalone structure', () => {
  const state = sampleState(); state.registry = [];
  assert.equal(state.tags.length, 132);
  assert.equal(new Set(state.tags.map(t => t.id)).size, 132);
  const result = exportConfiguration(state);
  assert.equal(result.catalogs.length, 4);
  assert.equal(result.datasets.length, 4);
  const standalone = result.catalogs.find(c => c.title === '障害復旧手順')!;
  const dataset = result.datasets.find(d => d.parentCatalogId === standalone.id)!;
  assert.equal(dataset.type, 'dcat:Dataset');
  assert.equal(dataset.distribution.type, 'dcat:Distribution');
  assert.equal(standalone.parentCatalogId, null);
});

test('inheritance retains own values; excluding a folder removes all descendants', () => {
  const state = sampleState(); state.registry = [];
  const parent = state.nodes.find(n => n.name === '01_企画・開発')!;
  const child = state.nodes.find(n => n.name === '世帯数.csv')!;
  const own = child.title;
  parent.title = '更新後'; parent.tagIds = [state.tags[0].id];
  assert.equal(analyze(state).metadata.get(child.id)!.title, '更新後');
  assert.deepEqual(analyze(state).metadata.get(child.id)!.tagIds, parent.tagIds);
  child.inherit = false;
  assert.equal(analyze(state).metadata.get(child.id)!.title, own);
  parent.mode = 'exclude';
  assert(analyze(state).excluded.has(child.id));
  assert(!exportConfiguration(state).datasets.some(d => d.id === child.id));
});

test('duplicate coverage is segment-safe, case-insensitive and source-specific', () => {
  const state = sampleState();
  assert.equal(analyze(state).registered.size, 3);
  assert.throws(() => exportConfiguration(state), /登録済み/);
  const entry = state.registry[0];
  entry.path += '0'; assert.equal(analyze(state).registered.size, 0);
  assert(isWithin('C:\\Data\\Root\\child', 'c:/data/root'));
  assert(!isWithin('C:\\Data\\Root2', 'c:/data/root'));
  const other = sampleState(); other.registry[0].sourceId = 'other';
  assert.equal(analyze(other).registered.size, 0);
});

test('depth violation blocks the entire export even for an excluded or top-level item', () => {
  const state = sampleState(); state.registry = [];
  state.settings.maxDepth = 2;
  state.nodes.find(n => n.depth === 3)!.mode = 'standalone';
  assert.equal(analyze(state).active.length, 0);
  assert.throws(() => exportConfiguration(state), /階層/);
  state.settings.maxDepth = 3;
  assert.equal(analyze(state).blocked, false);
  state.failure = { kind: 'depth', message: 'stopped', path: 'new/deep/file', depth: 4, limit: 3, checked: 751 };
  state.settings.maxDepth = 5;
  assert.throws(() => exportConfiguration(state), /読込/);
});

test('changing a source alias does not bypass known physical registration', () => {
  const state = sampleState();
  state.settings.sourceId = 'alias'; state.settings.sourceRoots.alias = 'demo:/';
  assert.equal(analyze(state).registered.size, 3);
  assert.throws(() => exportConfiguration(state), /登録済み/);
});

test('parent/title/source validation and registry input boundaries', () => {
  const state = sampleState(); state.registry = [];
  state.nodes[0].mode = 'sub'; assert.throws(() => exportConfiguration(state), /親カタログ/);
  state.nodes[0].mode = 'top'; state.nodes[0].title = '  '; assert.throws(() => exportConfiguration(state), /タイトル/);
  assert(!settingsInput.safeParse({ maxDepth: 2.5, sourceId: 'local' }).success);
  assert(!settingsInput.safeParse({ maxDepth: 0, sourceId: 'local' }).success);
  const bad = sampleState().registry[0]; bad.path = '../outside';
  assert(!registryInput.safeParse({ entries: [bad] }).success);
});
