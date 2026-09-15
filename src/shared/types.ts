export type Mode = 'top' | 'sub' | 'dataset' | 'standalone' | 'exclude';
export interface Metadata { title: string; description: string; tagIds: string[] }
export interface SourceNode extends Metadata {
  id: string; parentId: string | null; name: string; kind: 'folder' | 'file';
  sourcePath: string; absolutePath: string; depth: number; mode: Mode; inherit: boolean;
}
export interface Tag { id: string; label: string; categoryId: string }
export interface Category { id: string; name: string }
export interface RegistryEntry {
  sourceId: string; path: string; catalogId: string; title: string; registeredAt: string;
}
export interface Settings { maxDepth: number; sourceId: string; sourceRoots: Record<string, string> }
export interface ScanFailure {
  kind: 'depth' | 'io' | 'cancelled'; message: string; path: string;
  depth?: number; limit: number; checked: number; total?: number;
}
export interface Snapshot {
  nodes: SourceNode[]; tags: Tag[]; categories: Category[]; registry: RegistryEntry[];
  settings: Settings; rootPath: string; demo: boolean; failure: ScanFailure | null;
}
export interface Progress { jobId: string; checked: number; path: string; total?: number }
export type NodePatch = Partial<Pick<SourceNode, 'mode' | 'title' | 'description' | 'tagIds' | 'inherit'>>;
export interface TreeAPI {
  getState(): Promise<Snapshot>;
  chooseFolder(): Promise<Snapshot | null>;
  sample(): Promise<Snapshot>;
  depthDemo(): Promise<Snapshot>;
  restore(): Promise<Snapshot>;
  updateNode(id: string, patch: NodePatch): Promise<void>;
  updateSettings(settings: Pick<Settings, 'maxDepth' | 'sourceId'>): Promise<Snapshot>;
  addCategory(name: string): Promise<Snapshot>;
  moveTag(id: string, categoryId: string): Promise<Snapshot>;
  importRegistry(): Promise<Snapshot | null>;
  excludeRegistered(): Promise<Snapshot>;
  exportConfig(): Promise<string | null>;
  onProgress(callback: (progress: Progress) => void): () => void;
}
