import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AlertTitle, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, LinearProgress, MenuItem, Paper, Snackbar, Stack, TextField, Typography } from '@mui/material';
import type { NodePatch, Progress, Snapshot } from '../shared/types';
import { analyze } from '../domain/catalog';
import { Tree } from './Tree';
import { Editor } from './Editor';
import { RegistrySearch } from './RegistrySearch';
import { TagList } from './TagList';
import { CatalogGrid } from './CatalogGrid';
export function App() {
  const [state, setState] = useState<Snapshot | null>(null),
    [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(0),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [progress, setProgress] = useState<Progress | null>(null);
  const [screen, setScreen] = useState<'workspace' | 'registry' | 'tags' | 'grid'>('workspace');
  const [depth, setDepth] = useState('3'),
    [sourceId, setSourceId] = useState(''),
    [depthPolicy, setDepthPolicy] = useState<'error' | 'truncate'>('error'),
    [excludedExtensions, setExcludedExtensions] = useState('');
  const [confirmation, setConfirmation] = useState<{
    title: string;
    body: string;
    action: () => void;
  } | null>(null);
  const writes = useRef(Promise.resolve());
  const apply = useCallback((value: Snapshot) => {
    setState(value);
    setSelected(prev => value.nodes.some(n => n.id === prev) ? prev : value.nodes[0]?.id ?? '');
    setDepth(String(value.settings.maxDepth));
    setSourceId(value.settings.sourceId);
    setExcludedExtensions((value.settings.excludedExtensions ?? []).join(', '));
    setDepthPolicy(value.settings.depthPolicy ?? 'error');
  }, []);
  useEffect(() => {
    window.tree.getState().then(apply).catch(e => setError(String(e)));
    return window.tree.onProgress(setProgress);
  }, [apply]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (saving > 0 || busy) {
        event.preventDefault(); event.returnValue = '';
        setNotice('処理が完了してからアプリを閉じてください。');
      }
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [saving, busy]);
  const analysis = useMemo(() => state ? analyze(state) : null, [state]);
  const registeredIds = useMemo(() => new Set(analysis?.registered.keys()), [analysis]);
  const duplicates = useMemo(() => [...new Map([...(analysis?.registered.values() ?? [])].map(r => [r.sourceId + '/' + r.path, r])).values()], [analysis]);
  async function run(operation: () => Promise<Snapshot | null>) {
    setBusy(true);
    setProgress(null);
    setError('');
    try {
      await writes.current;
      const result = await operation();
      if (result) apply(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  function patch(id: string, patch: NodePatch) {
    if (busy) return;
    setState(s => s && {
      ...s,
      nodes: s.nodes.map(n => n.id === id ? {
        ...n,
        ...patch
      } : n)
    });
    setSaving(n => n + 1);
    writes.current = writes.current.then(() => window.tree.updateNode(id, patch)).catch(async e => {
      setError('変更を保存できませんでした：' + String(e));
      apply(await window.tree.getState());
    }).finally(() => setSaving(n => n - 1));
  }
  function confirm(title: string, body: string, action: () => void) {
    setConfirmation({
      title,
      body,
      action
    });
  }
  const settingsChanged = !!state && (depth !== String(state.settings.maxDepth) || sourceId !== state.settings.sourceId || excludedExtensions !== (state.settings.excludedExtensions ?? []).join(', ') || depthPolicy !== (state.settings.depthPolicy ?? 'error'));
  const selectedNode = state?.nodes.find(n => n.id === selected);
  if (!state || !analysis) return <Box sx={{
    p: 6
  }}><Typography variant="h4">Tree Register</Typography>{error ? <Alert severity="error">{error}</Alert> : <CircularProgress sx={{
      mt: 3
    }} />}</Box>;
  const disabled = busy || settingsChanged;
  if (screen === 'registry') return <><Box component="header" className="app-header"><Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}><Box className="brand-icon">▥</Box><Typography sx={{ fontWeight: 750, fontSize: 21 }}>Tree Register</Typography></Stack><Chip label="登録データ検索" variant="outlined" /></Box><RegistrySearch state={state} onBack={() => setScreen('workspace')} /></>;
  if (screen === 'tags') return <><Box component="header" className="app-header"><Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}><Box className="brand-icon">▥</Box><Typography sx={{ fontWeight: 750, fontSize: 21 }}>Tree Register</Typography></Stack><Chip label="タグ一覧" variant="outlined" /></Box><TagList state={state} busy={busy} onSave={(id, description) => void run(() => window.tree.updateTagDescription(id, description))} onBack={() => setScreen('workspace')} /></>;
  if (screen === 'grid') return <><Box component="header" className="app-header"><Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}><Box className="brand-icon">▥</Box><Typography sx={{ fontWeight: 750, fontSize: 21 }}>Tree Register</Typography></Stack><Chip label="表形式編集" variant="outlined" /></Box><CatalogGrid state={state} busy={busy} onPatch={patch} onBack={() => setScreen('workspace')} /></>;
  return <>
    <Box component="header" className="app-header"><Stack direction="row" sx={{
        alignItems: "center",
        gap: 1.5
      }}><Box className="brand-icon">▥</Box><Typography sx={{
          fontWeight: 750,
          fontSize: 21
        }}>Tree Register</Typography><Typography className="brand-caption" sx={{
          fontSize: 10,
          letterSpacing: 1.8,
          color: "text.secondary"
        }}>DATA CATALOG WORKSPACE</Typography></Stack><Chip label="DESKTOP / v0.1" variant="outlined" /></Box>
    <Box component="main" className="workspace">
      <Box className="page-heading"><Box><Typography sx={{
            color: "primary.main",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 2
          }}>FOLDER TO CATALOG</Typography><Typography variant="h4" sx={{
            mt: 1,
            mb: 1
          }}>フォルダから、データカタログへ。</Typography><Typography sx={{
            color: "text.secondary"
          }}>階層を確認しながら、登録方法とメタデータを整えます。</Typography></Box>
        <Stack direction="row" spacing={1}><Button variant="outlined" onClick={() => setScreen('grid')}>表形式で編集</Button><Button variant="outlined" onClick={() => setScreen('tags')}>タグ一覧</Button><Button variant="outlined" onClick={() => setScreen('registry')}>登録データを検索</Button><Button variant="outlined" disabled={busy} onClick={() => confirm('サンプルを再読込', '現在の作業設定・タグ分類・台帳をデモデータに置き換えます。', () => void run(window.tree.sample))}>サンプルを再読込</Button>
          <Button variant="contained" disabled={disabled} onClick={() => confirm('フォルダを選択', '読込成功時に現在の作業設定を置き換えます。失敗した場合は前の設定を保持します。', () => void run(window.tree.chooseFolder))}>＋ フォルダを選択</Button></Stack>
      </Box>
      <Stack direction="row" sx={{
        gap: 3,
        mt: 3,
        mb: 2,
        color: "primary.main",
        fontSize: 12
      }}><span>① フォルダ選択</span><span>② 登録内容の設定</span><span>③ 確認・設定を保存</span></Stack>
      <Paper sx={{
        p: 2,
        mb: 2
      }}><Stack direction="row" sx={{
          gap: 2,
          alignItems: "center",
          flexWrap: "wrap"
        }}>
        <TextField label="最大階層" type="number" value={depth} onChange={e => setDepth(e.target.value)} disabled={busy} sx={{
            width: 110
          }} slotProps={{
            htmlInput: {
              min: 1,
              max: 32767,
              step: 1
            }
          }} />
        <TextField label="管理元ID" value={sourceId} onChange={e => setSourceId(e.target.value)} disabled={busy} sx={{
            width: 190
        }} />
        <TextField label="初期対象外の拡張子" placeholder=".tmp, .log" value={excludedExtensions} onChange={e => setExcludedExtensions(e.target.value)} disabled={busy} sx={{ width: 220 }} helperText="カンマ区切り。再探索時に適用" />
        <TextField select label="階層超過時の動作" value={depthPolicy} onChange={e => setDepthPolicy(e.target.value as 'error' | 'truncate')} disabled={busy} sx={{ width: 220 }}><MenuItem value="error">エラーで停止</MenuItem><MenuItem value="truncate">指定階層まで登録</MenuItem></TextField>
        <Button variant="outlined" disabled={busy || !settingsChanged || !Number.isInteger(Number(depth)) || Number(depth) < 1 || Number(depth) > 32767 || !sourceId.trim()} onClick={() => void run(() => window.tree.updateSettings({
            maxDepth: Number(depth),
            sourceId: sourceId.trim(),
            excludedExtensions: [...new Set(excludedExtensions.split(',').map(v => v.trim().toLowerCase()).filter(Boolean))],
            depthPolicy
          }))}>共通設定を適用</Button>
        <Button disabled={busy} onClick={() => confirm('登録済み台帳を読込', '検証に成功したJSONで、現在の登録済み台帳を置き換えます。設定JSONの保存は登録完了として扱いません。', () => void run(window.tree.importRegistry))}>台帳JSONを読込</Button>
        <Button disabled={disabled} onClick={() => void run(window.tree.depthDemo)}>1万件・階層超過を試す</Button>
      </Stack>
        <Typography sx={{
          fontSize: 11,
          color: "text.secondary",
          mt: 1.5
        }}>選択フォルダ＝階層1。フォルダ・ファイル共通で上限超過を1件検出した時点で読込全体を停止します。</Typography>
        <Typography sx={{
          fontSize: 11,
          color: "text.secondary",
          mt: .5,
          overflowWrap: 'anywhere'
        }}>管理元の基準位置：{state.settings.sourceRoots[state.settings.sourceId] ?? '未対応（この管理元IDでフォルダを再選択してください）'}</Typography>
        {settingsChanged && <Alert severity="info" sx={{
          mt: 1
        }}>共通設定の変更を適用してからフォルダを選択・保存してください。</Alert>}
      </Paper>
      {busy && <Paper sx={{
        p: 2,
        mb: 2
      }} role="status"><Typography sx={{
          fontWeight: 600
        }}>{progress ? `${progress.checked.toLocaleString()} 項目を確認中` : '処理中…'}</Typography><Typography sx={{
          fontSize: 11,
          color: "text.secondary",
          my: 1,
          overflowWrap: 'anywhere'
        }}>{progress?.path} {progress && (progress.total ? `/ 全 ${progress.total.toLocaleString()} 項目` : '（残りは未探索）')}</Typography><LinearProgress /></Paper>}
      {error && <Alert severity="error" sx={{
        mb: 2
      }} onClose={() => setError('')}>{error}</Alert>}
      {(state.failure || analysis.violation) && <Alert severity="error" sx={{
        mb: 2,
        overflowWrap: 'anywhere'
      }}>
        <AlertTitle>読込・登録処理を停止しています</AlertTitle>
        {state.failure ? <>{state.failure.message}<br />{state.failure.path}<br />{state.failure.depth && `検出階層：${state.failure.depth} / `}検査時の上限：{state.failure.limit}<br />{state.failure.checked.toLocaleString()} 項目を確認した時点で停止 {state.failure.total ? `（全 ${state.failure.total.toLocaleString()} 項目）` : '（残りは未探索）'}</> : <>最大階層を超えています：{analysis.violation!.sourcePath}（{analysis.violation!.depth}階層 / 上限{state.settings.maxDepth}）</>}
        <Typography sx={{
          fontSize: 12,
          my: 1
        }}>一部だけの登録は行いません。上限を変更して再選択するか、前の設定に戻ってください。</Typography>
        {state.failure && <Button disabled={busy} color="inherit" variant="outlined" onClick={() => void run(window.tree.restore)}>前の設定に戻る</Button>}
      </Alert>}
      {!!duplicates.length && <Alert severity="info" sx={{
        mb: 2
      }}><AlertTitle>登録済みの階層を {duplicates.length} 件検出しました</AlertTitle>
        {duplicates.slice(0, 10).map(r => <Typography key={r.path} sx={{
          fontSize: 12,
          overflowWrap: 'anywhere'
        }}>{r.title} · {r.catalogId} · 登録日 {r.registeredAt}<br />{r.path}</Typography>)}
        {duplicates.length > 10 && <Typography sx={{
          fontSize: 11
        }}>ほか {duplicates.length - 10} 件（ツリーで確認できます）</Typography>}
        <Button variant="outlined" sx={{
          mt: 1.5
        }} disabled={busy || analysis.blocked || !analysis.active.some(n => analysis.registered.has(n.id))} onClick={() => void run(window.tree.excludeRegistered)}>登録済み階層をまとめて対象外にする</Button>
      </Alert>}
      <Box className="pane-layout" aria-busy={busy}>
        <Paper sx={{
          overflow: 'hidden'
        }}><Box className="panel-heading"><Typography variant="h6">フォルダツリー</Typography><Typography sx={{
              fontSize: 11,
              color: "text.secondary"
            }}>{state.nodes.length.toLocaleString()} 項目</Typography></Box>
          <Tree nodes={state.nodes} selected={selected} onSelect={setSelected} registered={registeredIds} excluded={analysis.excluded} />
        </Paper>
        <Paper sx={{
          overflow: 'hidden'
        }}>{selectedNode ? <Editor node={selectedNode} state={state} analysis={analysis} patch={patch} run={run} busy={busy} /> : <Box sx={{
            p: 3
          }}>項目を選択してください。</Box>}
          <Box sx={{
            p: 2,
            bgcolor: "#f9fbf8",
            borderTop: "1px solid #e1e7e2"
          }}><Typography role="status" sx={{
              fontSize: 11,
              color: "text.secondary"
            }}>{saving ? '● SQLiteに保存中…' : '✓ 編集内容はSQLiteに自動保存されます'}</Typography></Box>
        </Paper>
        <Paper className="review-pane" sx={{
          overflow: 'hidden'
        }}><Box className="panel-heading"><Typography variant="h6">登録プレビュー</Typography><Chip label="LIVE" variant="outlined" /></Box><Box sx={{
            p: 2.5
          }}>
          <Box sx={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              textAlign: "center",
              mb: 3
            }}>{[[analysis.catalogs.length, 'カタログ'], [analysis.datasets.length, 'データセット'], [analysis.excluded.size, '対象外']].map(([count, label]) => <Box key={label}><Typography sx={{
                  fontSize: 27,
                  fontWeight: 700
                }}>{Number(count).toLocaleString()}</Typography><Typography sx={{
                  fontSize: 10,
                  color: "text.secondary"
                }}>{label}</Typography></Box>)}</Box>
          <Typography sx={{
              fontWeight: 700,
              mb: 1.5
            }}>登録後の構造</Typography>
          <Box sx={{
              bgcolor: "#fafcf9",
              border: "1px solid #e1e7e2",
              borderRadius: 1,
              p: 1.5,
              maxHeight: 400,
              overflow: 'auto'
            }}>
            {analysis.active.slice(0, 100).map(n => <Box key={n.id} sx={{
                mb: 1.5
              }}><Typography sx={{
                  fontSize: 12,
                  fontWeight: 600
                }}><span className={'preview-badge ' + (n.mode === 'dataset' ? 'data' : '')}>{n.mode === 'dataset' ? 'DATA' : 'CAT'}</span>{analysis.metadata.get(n.id)!.title || '未入力'}</Typography>
              <Typography sx={{
                  fontSize: 10,
                  color: "text.secondary",
                  overflowWrap: 'anywhere'
                }}>{n.sourcePath}</Typography>
              <Typography sx={{
                  fontSize: 10,
                  color: "text.secondary"
                }}>{n.mode === 'top' || n.mode === 'standalone' ? 'トップレベル' : `親：${analysis.metadata.get(n.parentId!)?.title ?? '未設定'}`}{n.mode === 'standalone' ? ' / DATA 1件を内包' : ''}</Typography></Box>)}
            {analysis.active.length > 100 && <Typography sx={{
                fontSize: 11
              }}>先頭100項目を表示 / 全{analysis.active.length.toLocaleString()}項目。JSONには全対象を保存します。</Typography>}
            {!analysis.active.length && <Typography sx={{
                fontSize: 12,
                color: "text.secondary"
              }}>{analysis.blocked ? '処理停止中' : '登録対象がありません'}</Typography>}
          </Box>
          {analysis.errors.length ? <Alert severity="warning" sx={{
              mt: 2
            }}>{analysis.errors.slice(0, 5).map((e, i) => <Typography key={i} sx={{
                fontSize: 11
              }}>{e}</Typography>)}{analysis.errors.length > 5 && <Typography sx={{
                fontSize: 11
              }}>ほか{analysis.errors.length - 5}件</Typography>}</Alert> : <Typography sx={{
              color: "primary.main",
              fontSize: 12,
              mt: 2
            }}>✓ 登録設定に問題はありません</Typography>}
          <Box component="details" sx={{
              mt: 2,
              fontSize: 11,
              color: "text.secondary"
            }}><summary>DCAT構造と台帳について</summary><p>カタログは dcat:Catalog、データセットは dcat:Dataset。元ファイルはデータセットの配布として関連付けます。</p><p>台帳は entries 配列に sourceId、path、catalogId、title、registeredAt を持つJSONです。pathは管理元の基準位置からの相対パスを / 区切りで指定します。</p><p>外部カタログには送信しません。JSON保存で台帳の登録済み情報は増えません。</p></Box>
        </Box><Divider /><Box sx={{
            p: 2.5
          }}><Button fullWidth variant="contained" disabled={disabled || saving > 0 || !!analysis.errors.length || !analysis.catalogs.length} onClick={async () => {
              setBusy(true);
              setProgress(null);
              setError('');
              try {
                await writes.current;
                const filename = await window.tree.exportConfig();
                if (filename) setNotice('登録設定を保存しました：' + filename);
              } catch (e) {
                setError(String(e));
                try { apply(await window.tree.getState()); } catch { /* Keep the visible last state on worker failure. */ }
              } finally {
                setBusy(false);
              }
            }}>↓ 登録設定をJSONで保存</Button><Typography sx={{
              fontSize: 10,
              color: "text.secondary",
              mt: 1
            }}>設定の保存です。外部カタログには登録しません。</Typography></Box></Paper>
      </Box>
      <Box component="footer" sx={{
        mt: 2.5,
        display: "flex",
        justifyContent: "space-between",
        gap: 2
      }}><Typography sx={{
          fontSize: 11,
          color: "text.secondary"
        }}>{state.demo ? 'デモデータを表示中' : state.rootPath}</Typography><Typography sx={{
          fontSize: 11,
          color: "text.secondary"
        }}>Windows 11 · 元ファイル本文は読み取りません</Typography></Box>
    </Box>
    <Dialog open={!!confirmation} onClose={() => setConfirmation(null)}><DialogTitle>{confirmation?.title}</DialogTitle><DialogContent>{confirmation?.body}</DialogContent><DialogActions><Button onClick={() => setConfirmation(null)}>キャンセル</Button><Button variant="contained" onClick={() => {
          const action = confirmation!.action;
          setConfirmation(null);
          action();
        }}>続ける</Button></DialogActions></Dialog>
    <Snackbar open={!!notice} autoHideDuration={6000} onClose={() => setNotice('')} message={notice} />
  </>;
}
