import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Chip, TextField, Typography } from '@mui/material';
import type { SourceNode } from '../shared/types';
const HEIGHT = 484,
  ROW = 44;
export function Tree({
  nodes,
  selected,
  onSelect,
  registered,
  excluded
}: {
  nodes: SourceNode[];
  selected: string;
  onSelect: (id: string) => void;
  registered: Set<string>;
  excluded: Set<string>;
}) {
  const [query, setQuery] = useState('');
  const [closed, setClosed] = useState(new Set<string>());
  const [scroll, setScroll] = useState(0);
  const tree = useRef<HTMLDivElement>(null);
  const index = useMemo(() => {
    const byId = new Map(nodes.map(n => [n.id, n]));
    const children = new Map<string | null, SourceNode[]>();
    for (const n of nodes) {
      if (!children.has(n.parentId)) children.set(n.parentId, []);
      children.get(n.parentId)!.push(n);
    }
    return {
      byId,
      children
    };
  }, [nodes]);
  useEffect(() => {
    setClosed(new Set(nodes.filter(n => n.kind === 'folder' && n.parentId).map(n => n.id)));
    setQuery('');
    setScroll(0);
  }, [nodes[0]?.id]);
  const visible = useMemo(() => {
    const q = query.normalize('NFKC').toLowerCase(),
      matches = new Set<string>();
    if (q) for (const n of nodes) if (n.name.normalize('NFKC').toLowerCase().includes(q)) {
      for (let p: SourceNode | undefined = n; p && !matches.has(p.id); p = p.parentId ? index.byId.get(p.parentId) : undefined) matches.add(p.id);
    }
    const result: SourceNode[] = [],
      stack = [...(index.children.get(null) ?? [])].reverse();
    while (stack.length) {
      const n = stack.pop()!;
      if (q && !matches.has(n.id)) continue;
      result.push(n);
      if (q || !closed.has(n.id)) {
        const children = index.children.get(n.id) ?? [];
        for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
      }
    }
    return result;
  }, [nodes, index, query, closed]);
  useEffect(() => {
    if (!visible.some(n => n.id === selected) && visible.length) onSelect(visible[0].id);
    if (tree.current) {
      tree.current.scrollTop = Math.min(tree.current.scrollTop, Math.max(0, visible.length * ROW - HEIGHT));
      setScroll(tree.current.scrollTop);
    }
  }, [visible, selected, onSelect]);
  const toggle = (id: string) => setClosed(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);else next.add(id);
    return next;
  });
  function choose(id: string) {
    onSelect(id);
    const i = visible.findIndex(n => n.id === id),
      element = tree.current;
    if (element && i >= 0) {
      if (i * ROW < element.scrollTop) element.scrollTop = i * ROW;else if ((i + 1) * ROW > element.scrollTop + HEIGHT) element.scrollTop = (i + 1) * ROW - HEIGHT;
      setScroll(element.scrollTop);
      element.focus();
    }
  }
  const start = Math.max(0, Math.floor(scroll / ROW) - 4),
    end = Math.min(visible.length, start + 22);
  const selectedIndex = visible.findIndex(n => n.id === selected);
  return <>
    <Box sx={{
      p: 2
    }}><TextField fullWidth label="フォルダ・ファイルを検索" value={query} onChange={e => setQuery(e.target.value)} />
      <Typography sx={{
        color: "text.secondary",
        fontSize: 11,
        mt: 1.5
      }}>↑↓ 選択　←→ 開閉・親子移動<br />Home / End 先頭・末尾　Enter 設定へ</Typography></Box>
    <div ref={tree} role="tree" tabIndex={0} aria-label="フォルダツリー" aria-activedescendant={selectedIndex >= start && selectedIndex < end ? 'tree-' + selected : undefined} style={{
      height: HEIGHT,
      overflow: 'auto',
      position: 'relative'
    }} onScroll={e => setScroll(e.currentTarget.scrollTop)} onKeyDown={e => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter'].includes(e.key)) return;
      e.preventDefault();
      if (!visible.length) return;
      const i = Math.max(0, visible.findIndex(n => n.id === selected)),
        n = visible[i];
      if (e.key === 'ArrowUp') choose(visible[Math.max(0, i - 1)].id);
      if (e.key === 'ArrowDown') choose(visible[Math.min(visible.length - 1, i + 1)].id);
      if (e.key === 'Home') choose(visible[0].id);
      if (e.key === 'End') choose(visible.at(-1)!.id);
      if (e.key === 'ArrowRight') {
        if (closed.has(n.id) && !query) toggle(n.id);else if (visible[i + 1]?.parentId === n.id) choose(visible[i + 1].id);
      }
      if (e.key === 'ArrowLeft') {
        if (!closed.has(n.id) && index.children.has(n.id) && !query) toggle(n.id);else if (n.parentId) choose(n.parentId);
      }
      if (e.key === 'Enter') document.querySelector<HTMLInputElement>('#editor input:not(:disabled)')?.focus();
    }}>
      <div style={{
        height: visible.length * ROW,
        position: 'relative'
      }}>
        {visible.slice(start, end).map((n, offset) => <div id={'tree-' + n.id} key={n.id} role="treeitem" aria-selected={n.id === selected} aria-level={n.depth} aria-expanded={index.children.has(n.id) ? !!query || !closed.has(n.id) : undefined} className={'tree-row' + (n.id === selected ? ' selected' : '')} style={{
          position: 'absolute',
          top: (start + offset) * ROW,
          height: ROW,
          left: 0,
          right: 0,
          paddingLeft: 8 + Math.min(n.depth - 1, 10) * 15,
          opacity: excluded.has(n.id) ? .52 : 1
        }}>
          <button tabIndex={-1} className="tree-toggle" aria-label={n.name + 'を開閉'} onClick={() => {
            toggle(n.id);
            tree.current?.focus();
          }}>{index.children.has(n.id) ? closed.has(n.id) && !query ? '▸' : '▾' : '·'}</button>
          <button tabIndex={-1} className="tree-select" onClick={() => choose(n.id)} title={n.sourcePath}>
            <span className={n.kind === 'folder' ? 'folder-icon' : 'file-icon'}>{n.kind === 'folder' ? '▱' : '▤'}</span>
            <span className="tree-label">{n.name}</span>
            {registered.has(n.id) && <span className="registered-badge">登録済み</span>}
            <span className={'dot ' + (excluded.has(n.id) ? 'excluded' : n.mode === 'dataset' ? 'dataset' : '')} />
          </button>
        </div>)}
      </div>
      {!visible.length && <Typography sx={{
        p: 2,
        color: "text.secondary"
      }}>一致する項目はありません。</Typography>}
    </div>
    <Box sx={{
      p: 2,
      display: "flex",
      gap: 1,
      borderTop: "1px solid #e1e7e2"
    }}><Chip variant="outlined" label="カタログ" color="primary" /><Chip variant="outlined" label="データセット" color="info" /><Chip variant="outlined" label="対象外" /></Box>
  </>;
}
