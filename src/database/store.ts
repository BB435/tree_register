import { DatabaseSync } from 'node:sqlite';
import type { Snapshot, SourceNode } from '../shared/types';
import { sampleState } from '../domain/seeds';

export class Store {
  private db: DatabaseSync;
  constructor(filename: string) {
    this.db = new DatabaseSync(filename);
    const version = Number(this.db.prepare('PRAGMA user_version').get()!.user_version);
    if (version > 1) { this.db.close(); throw new Error('このデータベースは新しいアプリで作成されています。対応するバージョンを使用してください。'); }
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);
      CREATE TABLE IF NOT EXISTS tags (id TEXT PRIMARY KEY, label TEXT NOT NULL UNIQUE, category_id TEXT NOT NULL REFERENCES categories(id));
      CREATE TABLE IF NOT EXISTS nodes (id TEXT PRIMARY KEY, parent_id TEXT REFERENCES nodes(id) DEFERRABLE INITIALLY DEFERRED, source_path TEXT NOT NULL UNIQUE, position INTEGER NOT NULL, payload TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS nodes_parent ON nodes(parent_id);
      CREATE TABLE IF NOT EXISTS node_tags (node_id TEXT REFERENCES nodes(id) ON DELETE CASCADE, tag_id TEXT REFERENCES tags(id), PRIMARY KEY(node_id,tag_id));
      CREATE TABLE IF NOT EXISTS registry (source_id TEXT NOT NULL, path_key TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(source_id,path_key));
      PRAGMA user_version=1;`);
    if (!this.db.prepare('SELECT id FROM app_state').get()) this.save(sampleState());
  }
  private transaction(fn: () => void) {
    this.db.exec('BEGIN IMMEDIATE');
    try { fn(); this.db.exec('COMMIT'); } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  load(): Snapshot {
    const row = this.db.prepare('SELECT payload FROM app_state WHERE id=1').get()!;
    const header = JSON.parse(String(row.payload));
    const nodes = this.db.prepare('SELECT payload FROM nodes ORDER BY position').all().map(r => JSON.parse(String(r.payload)));
    const categories = this.db.prepare('SELECT id,name FROM categories ORDER BY rowid').all();
    const tags = this.db.prepare('SELECT id,label,category_id AS categoryId FROM tags ORDER BY rowid').all();
    const registry = this.db.prepare('SELECT payload FROM registry ORDER BY rowid').all().map(r => JSON.parse(String(r.payload)));
    return { ...header, nodes, categories, tags, registry };
  }
  save(state: Snapshot) {
    this.transaction(() => {
      this.db.exec('DELETE FROM node_tags; DELETE FROM nodes; DELETE FROM tags; DELETE FROM categories; DELETE FROM registry;');
      const category = this.db.prepare('INSERT INTO categories VALUES (?,?)');
      state.categories.forEach(c => category.run(c.id, c.name));
      const tag = this.db.prepare('INSERT INTO tags VALUES (?,?,?)');
      state.tags.forEach(t => tag.run(t.id, t.label, t.categoryId));
      const insert = this.db.prepare('INSERT INTO nodes VALUES (?,?,?,?,?)');
      const link = this.db.prepare('INSERT INTO node_tags VALUES (?,?)');
      state.nodes.forEach((n, i) => { insert.run(n.id, n.parentId, n.sourcePath, i, JSON.stringify(n)); n.tagIds.forEach(t => link.run(n.id, t)); });
      const registry = this.db.prepare('INSERT INTO registry VALUES (?,?,?)');
      state.registry.forEach(r => registry.run(r.sourceId, r.path.toLocaleLowerCase('en-US'), JSON.stringify(r)));
      this.saveHeader(state);
    });
  }
  saveHeader(state: Snapshot) {
    const { nodes: _nodes, categories: _categories, tags: _tags, registry: _registry, ...header } = state;
    this.db.prepare('INSERT INTO app_state VALUES (1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(JSON.stringify(header));
  }
  updateNode(n: SourceNode) {
    this.transaction(() => {
      this.db.prepare('UPDATE nodes SET payload=? WHERE id=?').run(JSON.stringify(n), n.id);
      this.db.prepare('DELETE FROM node_tags WHERE node_id=?').run(n.id);
      const link = this.db.prepare('INSERT INTO node_tags VALUES (?,?)');
      n.tagIds.forEach(t => link.run(n.id, t));
    });
  }
  close() { this.db.close(); }
}
