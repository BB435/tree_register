import { useMemo, useState } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Alert, Autocomplete, Box, Button, Checkbox, Chip, Divider, FormControlLabel, MenuItem, Radio, RadioGroup, Stack, TextField, Typography } from '@mui/material';
import type { NodePatch, Snapshot, SourceNode } from '../shared/types';
import { analyze } from '../domain/catalog';
export function Editor({
  node: n,
  state,
  analysis: a,
  patch,
  run,
  busy
}: {
  node: SourceNode;
  state: Snapshot;
  analysis: ReturnType<typeof analyze>;
  busy: boolean;
  patch: (id: string, patch: NodePatch) => void;
  run: (fn: () => Promise<Snapshot | null>) => void;
}) {
  const [query, setQuery] = useState(''),
    [categoryId, setCategoryId] = useState('');
  const [newCategory, setNewCategory] = useState(''),
    [adminTag, setAdminTag] = useState<string | null>(null),
    [destination, setDestination] = useState('');
  const meta = a.metadata.get(n.id)!;
  const locked = busy || a.blocked || a.excluded.has(n.id) || n.inherit && n.mode === 'dataset';
  const options = n.kind === 'folder' ? [['top', 'トップレベル', '独立したカタログ'], ['sub', 'サブカタログ', '親カタログの配下'], ['exclude', '登録対象外', '配下もまとめて除外']] : [['dataset', 'データセット', '親カタログの配下'], ['standalone', '単独カタログ', 'データセット1件を内包'], ['exclude', '登録対象外', 'このファイルを除外']];
  const tags = useMemo(() => state.tags.filter(t => (!categoryId || t.categoryId === categoryId) && t.label.normalize('NFKC').toLowerCase().includes(query.trim().normalize('NFKC').toLowerCase())), [state.tags, query, categoryId]);
  function tag(id: string, checked: boolean) {
    patch(n.id, {
      tagIds: checked ? [...new Set([...n.tagIds, id])] : n.tagIds.filter(t => t !== id)
    });
  }
  const registered = a.registered.get(n.id);
  return <Box id="editor">
    <Box sx={{
      p: 3,
      bgcolor: "#fcfdfb",
      borderBottom: "1px solid #e1e7e2"
    }}>
      <Typography sx={{
        fontSize: 11,
        color: "text.secondary",
        overflowWrap: 'anywhere'
      }}>{n.sourcePath} · {n.depth}階層 / 上限 {state.settings.maxDepth}</Typography>
      <Typography variant="h6" sx={{
        fontSize: 22,
        mt: 1.5,
        mb: 1,
        overflowWrap: 'anywhere'
      }}>{n.name}</Typography>
      <Chip color="primary" variant="outlined" label={n.kind === 'folder' ? 'FOLDER / フォルダ' : 'FILE / ファイル'} />
    </Box>
    <Stack spacing={2.5} sx={{
      p: 3
    }}>
      {registered && <Alert severity="info">登録済み階層に含まれます。<br />{registered.catalogId} · 登録日 {registered.registeredAt}<br />{registered.path}</Alert>}
      {a.blocked && <Alert severity="error">読込・登録処理を停止しています。上部のエラーを解消してください。</Alert>}
      <Box><Typography sx={{
          fontWeight: 700,
          mb: 1.5
        }}>01　登録区分</Typography>
        <RadioGroup row value={n.mode} onChange={(_, value) => patch(n.id, {
          mode: value as SourceNode['mode']
        })} sx={{
          flexWrap: 'nowrap',
          gap: 1
        }}>
          {options.map(([value, title, caption]) => <Box key={value} sx={{
            border: '1px solid',
            borderColor: n.mode === value ? 'primary.main' : '#e1e7e2',
            borderRadius: 1,
            p: 1,
            flex: 1,
            bgcolor: n.mode === value ? '#f0f7f1' : 'white'
          }}>
            <FormControlLabel sx={{
              m: 0,
              alignItems: 'flex-start'
            }} value={value} disabled={busy || a.blocked} control={<Radio size="small" sx={{
              p: .3,
              mr: .4
            }} />} label={<Box><Typography sx={{
                fontSize: 12,
                fontWeight: 600
              }}>{title}</Typography><Typography sx={{
                fontSize: 10,
                color: "text.secondary",
                mt: .5
              }}>{caption}</Typography></Box>} />
          </Box>)}
        </RadioGroup>
        <Typography sx={{
          fontSize: 11,
          color: "text.secondary",
          mt: 1.5
        }}>登録先：{['top', 'standalone'].includes(n.mode) ? 'トップレベル' : n.parentId ? a.metadata.get(n.parentId)?.title : '親カタログなし'}</Typography>
      </Box>
      <Divider />
      <Typography sx={{
        fontWeight: 700
      }}>02　メタデータ</Typography>
      {n.mode === 'dataset' && <Box><RadioGroup row value={n.inherit ? 'parent' : 'own'} onChange={(_, v) => patch(n.id, {
          inherit: v === 'parent'
        })}>
        <FormControlLabel disabled={busy || a.blocked || a.excluded.has(n.id)} value="own" control={<Radio size="small" />} label="固有登録" />
        <FormControlLabel disabled={busy || a.blocked || a.excluded.has(n.id)} value="parent" control={<Radio size="small" />} label="親と同じ内容" />
      </RadioGroup>{n.inherit && <Typography sx={{
          color: "text.secondary",
          fontSize: 11
        }}>タイトル・説明・タグを継承します。親の変更も反映されます。</Typography>}</Box>}
      <TextField label="タイトル" required value={meta.title} disabled={locked} error={!a.excluded.has(n.id) && !meta.title.trim()} onChange={e => patch(n.id, {
        title: e.target.value
      })} slotProps={{
        htmlInput: {
          maxLength: 2000
        }
      }} />
      <TextField label="説明文" multiline minRows={3} value={meta.description} disabled={locked} onChange={e => patch(n.id, {
        description: e.target.value
      })} slotProps={{
        htmlInput: {
          maxLength: 100000
        }
      }} />
      <Divider />
      <Typography sx={{
        fontWeight: 700
      }}>03　タグ <Typography component="span" sx={{
          fontSize: 11,
          color: "text.secondary"
        }}>複数選択可</Typography></Typography>
      <Box sx={{
        p: 1.5,
        bgcolor: "#f5f7f4",
        borderRadius: 1,
        display: "flex",
        gap: .8,
        flexWrap: "wrap"
      }}>
        {meta.tagIds.length ? meta.tagIds.map(id => <Chip key={id} label={state.tags.find(t => t.id === id)?.label ?? id} color="primary" variant="outlined" disabled={locked} onDelete={locked ? undefined : () => tag(id, false)} />) : <Typography sx={{
          color: "text.secondary",
          fontSize: 12
        }}>タグは未選択です</Typography>}
      </Box>
      <Stack direction="row" sx={{
        gap: 1
      }}><TextField label="タグを検索" value={query} onChange={e => setQuery(e.target.value)} sx={{
          flex: 1
        }} />
        <TextField select label="カテゴリ" value={categoryId} onChange={e => setCategoryId(e.target.value)} sx={{
          minWidth: 150
        }}><MenuItem value="">すべて</MenuItem>{state.categories.map(c => <MenuItem value={c.id} key={c.id}>{c.name}</MenuItem>)}</TextField></Stack>
      <Typography role="status" sx={{
        fontSize: 11,
        color: "text.secondary"
      }}>{tags.length} / {state.tags.length} 件 · 選択中 {meta.tagIds.length} 件</Typography>
      <Box sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: .8,
        maxHeight: 220,
        overflow: 'auto'
      }}>
        {tags.map(t => <FormControlLabel key={t.id} sx={{
          m: 0,
          border: '1px solid #e1e7e2',
          borderRadius: 1,
          pr: 1
        }} control={<Checkbox size="small" disabled={locked} checked={meta.tagIds.includes(t.id)} onChange={(_, checked) => tag(t.id, checked)} />} label={<Typography sx={{
          fontSize: 11
        }}>{t.label}</Typography>} />)}
        {!tags.length && <Typography sx={{
          fontSize: 12,
          color: "text.secondary"
        }}>該当するタグはありません。</Typography>}
      </Box>
      <Typography sx={{
        fontSize: 11,
        color: "text.secondary"
      }}>検索条件を変更しても選択は保持されます。</Typography>
      <Accordion disableGutters><AccordionSummary expandIcon="⌄">タグのカテゴリ分類を編集（全項目共通）</AccordionSummary><AccordionDetails>
        <Stack spacing={2}>
          <Autocomplete options={state.tags} getOptionLabel={t => t.label} value={state.tags.find(t => t.id === adminTag) ?? null} onChange={(_, t) => {
              setAdminTag(t?.id ?? null);
              setDestination(t?.categoryId ?? '');
            }} renderInput={params => <TextField {...params} label="分類するタグを検索" />} />
          <TextField select label="移動先カテゴリ" value={destination} onChange={e => setDestination(e.target.value)}><MenuItem value="">選択してください</MenuItem>{state.categories.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}</TextField>
          <Button variant="outlined" disabled={busy || a.blocked || !adminTag || !destination} onClick={() => run(() => window.tree.moveTag(adminTag!, destination))}>カテゴリを変更</Button>
          <TextField label="新しいカテゴリ名" value={newCategory} onChange={e => setNewCategory(e.target.value)} slotProps={{
              htmlInput: {
                maxLength: 40
              }
            }} />
          <Button variant="outlined" disabled={busy || a.blocked || !newCategory.trim()} onClick={() => {
              run(() => window.tree.addCategory(newCategory));
              setNewCategory('');
            }}>カテゴリを追加</Button>
        </Stack>
      </AccordionDetails></Accordion>
    </Stack>
  </Box>;
}
