import type { Metadata, RegistryEntry, Snapshot, SourceNode } from '../shared/types';

// Compare path segments, not name prefixes. The original display spelling is retained.
export const pathKey = (value: string) => value.replace(/\\/g, '/').replace(/\/+$/, '').toLocaleLowerCase('en-US');
export function isWithin(value: string, parent: string) {
  const a = pathKey(value), b = pathKey(parent);
  return a === b || a.startsWith(b + '/');
}
export function analyze(state: Snapshot) {
  const byId = new Map(state.nodes.map(n => [n.id, n]));
  const excluded = new Set<string>();
  const metadata = new Map<string, Metadata>();
  const registered = new Map<string, RegistryEntry>();
  const registryByPath = new Map(state.registry.filter(r => r.sourceId === state.settings.sourceId)
    .map(r => [pathKey(r.path), r]));
  const registryByAbsolute = new Map(state.registry.flatMap(r => {
    const root = state.settings.sourceRoots[r.sourceId];
    return root ? [[pathKey(root) + '/' + pathKey(r.path), r] as const] : [];
  }));
  const base = state.settings.sourceRoots[state.settings.sourceId];
  const errors: string[] = [];
  if (!state.settings.sourceId.trim()) errors.push('管理元IDを入力してください。');
  if (!base) errors.push('管理元IDと基準位置が未対応です。このIDでフォルダを再選択してください。');
  if (state.failure) errors.push('読込が停止しています。再選択するか前の設定に戻ってください。');
  const violation = state.nodes.find(n => n.depth > state.settings.maxDepth);
  if (violation) errors.push(`最大階層を超えています：${violation.sourcePath}（${violation.depth}階層）`);
  const blocked = !!state.failure || !!violation;
  // Nodes are stored in traversal order, with parents before children.
  for (const n of state.nodes) {
    if (n.mode === 'exclude' || (n.parentId && excluded.has(n.parentId))) excluded.add(n.id);
    metadata.set(n.id, n.inherit && n.mode === 'dataset' && n.parentId
      ? metadata.get(n.parentId) ?? n : n);
    // Known source aliases must not allow the same physical folder to be registered twice.
    for (const [initial, lookup] of [[n.absolutePath, registryByAbsolute], [n.sourcePath, registryByPath]] as const) {
      let p = pathKey(initial);
      while (p) {
        const entry = lookup.get(p);
        if (entry) { registered.set(n.id, entry); break; }
        const slash = p.lastIndexOf('/');
        if (slash < 0) break;
        p = p.slice(0, slash);
      }
      if (registered.has(n.id)) break;
    }
  }
  const active = blocked ? [] : state.nodes.filter(n => !excluded.has(n.id));
  for (const n of active) {
    if (!metadata.get(n.id)!.title.trim()) errors.push(`${n.name}：タイトルは必須です。`);
    if ((n.mode === 'sub' || n.mode === 'dataset') && (!n.parentId || !byId.has(n.parentId) || excluded.has(n.parentId))) {
      errors.push(`${n.name}：親カタログが必要です。`);
    }
  }
  if (active.some(n => registered.has(n.id))) errors.push('登録済みの階層が登録対象に残っています。対象外にしてください。');
  const catalogs = active.filter(n => n.mode !== 'dataset');
  const datasets = active.filter(n => n.mode === 'dataset' || n.mode === 'standalone');
  return { byId, excluded, metadata, registered, errors, blocked, violation, active, catalogs, datasets };
}
export function exportConfiguration(state: Snapshot) {
  const a = analyze(state);
  if (a.errors.length || !a.catalogs.length) throw new Error(a.errors.join('\n') || '登録対象がありません。');
  const tagNames = new Map(state.tags.map(t => [t.id, t.label]));
  const base = (n: SourceNode) => {
    const m = a.metadata.get(n.id)!;
    return { id: n.id, sourcePath: n.sourcePath, title: m.title, description: m.description,
      tags: m.tagIds.map(id => tagNames.get(id)!), tagIds: m.tagIds };
  };
  return {
    format: 'tree-register-config', version: 3, sourceId: state.settings.sourceId,
    registryChecked: true, createdAt: new Date().toISOString(),
    tagPresets: state.tags.map(t => ({ ...t, category: state.categories.find(c => c.id === t.categoryId)!.name })),
    tagCategories: state.categories.map(c => c.name),
    rules: { depthViolation: 'stop-entire-import', duplicatePolicy: 'block-until-excluded',
      maxSourceDepth: state.settings.maxDepth, depthOrigin: 'selected-folder-is-1', depthIncludesFiles: true,
      generatedDatasetUsesSourceDepth: true, excludedFolder: 'exclude-descendants',
      inheritance: ['title', 'description', 'tags'], standaloneFile: 'catalog-with-dataset' },
    catalogs: a.catalogs.map(n => ({ ...base(n), type: 'dcat:Catalog', parentCatalogId: n.mode === 'sub' ? n.parentId : null })),
    datasets: a.datasets.map(n => ({ ...base(n), id: n.mode === 'standalone' ? n.id + '-dataset' : n.id,
      type: 'dcat:Dataset', parentCatalogId: n.mode === 'standalone' ? n.id : n.parentId,
      metadataMode: n.mode === 'standalone' ? 'catalog' : n.inherit ? 'inherit' : 'own',
      distribution: { type: 'dcat:Distribution', sourcePath: n.sourcePath } })),
    excluded: state.nodes.filter(n => a.excluded.has(n.id)).map(n => n.sourcePath),
    sourceNodes: state.nodes.map(n => ({ ...n, registrationAllowed: !a.excluded.has(n.id) })),
  };
}
