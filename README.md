# Tree Register

Windows 11向けのDCATカタログ登録設定アプリです。フォルダを探索し、登録区分・タイトル・説明・タグを編集して、登録設定JSONを保存できます。

## 起動

ビルド済みアプリは `release/win-unpacked/Tree Register.exe` です。周囲のDLLや `resources` も必要なので、移動する場合は `win-unpacked` フォルダ全体を移動してください。

初回はデモデータを表示します。「登録済み階層をまとめて対象外にする」でデモの重複を解消してから、JSON保存を試せます。

## 実装した機能

- 実フォルダ選択、空フォルダを含む逐次探索、検索・仮想スクロール付きツリー。
- 最大階層の設定。初期値3、選択フォルダが階層1。超過を1件検出した時点で全体停止し、途中結果を取り込まない。
- フォルダ・ファイルの登録区分切り替え、メタデータ編集、親からの継承。
- 132タグ・11カテゴリの初期データ、検索・複数選択、カテゴリ追加・分類変更。
- 登録済み台帳のJSON取込、親階層を含む照合、二重登録防止。
- キーボードによる選択・開閉・親子移動。
- SQLiteへの編集・設定・タグ・台帳の永続化、再起動後の復元。
- DCAT構造に対応する登録設定JSONの出力。保存前に実フォルダを再検査する。
- 1万件を想定した階層超過デモ。

外部カタログへの送信は行いません。JSON保存でも登録済み台帳は更新しません。

## 開発環境

| 項目 | 採用バージョン |
| --- | --- |
| 対象OS | Windows 11 x64 |
| Electron | 44.3.0 |
| Electron同梱Node.js | 24.20.0（実行時に確認） |
| React / React DOM | 19.3.0 |
| Material UI | 9.4.0 |
| TypeScript | 7.0.2 |
| Vite | 8.3.0 |
| SQLiteアクセス | `node:sqlite` |

依存バージョンは `package.json` と `package-lock.json` に固定しています。開発環境はNode.js 24.18.0・npm 11.16.0で検証しました。

### コマンド（PowerShell）

```powershell
npm.cmd ci
npm.cmd run dev
```

`dev` はElectron側をコンパイルし、ViteとElectronを起動します。Rendererの変更は即時反映されます。Main・Preload・Workerの変更後は `dev` を再起動してください。

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run test:electron
npm.cmd run package
```

| コマンド | 内容 |
| --- | --- |
| `dev` | 開発用のVite＋Electronを起動 |
| `typecheck` | RendererとElectron側の型検査 |
| `test` | ドメイン・探索・SQLiteのテスト |
| `build` | `dist/` にアプリをビルド |
| `start` | ビルド済み `dist/` をElectronで起動 |
| `test:electron` | 実際のElectronでUI・SQLite・実フォルダ・1万件を検証。事前に `build` が必要 |
| `package` | Windows x64用のフォルダ形式アプリを `release/win-unpacked/` に生成 |

PowerShellの `npm.ps1` が古いnpm参照先で失敗する環境では `npm.cmd` を使ってください。それも利用できない場合は、同梱npmを直接起動する `node scripts/npm.mjs run dev` 等が使えます。グローバル設定は変更していません。

初回のElectronバイナリ取得にはネットワーク接続が必要です。npmの実行スクリプト制御を使う環境では、依存パッケージの実行許可設定を確認してください。

### パッケージ済みアプリの検証

```powershell
$env:TREE_REGISTER_PACKAGED_EXE = (Resolve-Path 'release/win-unpacked/Tree Register.exe').Path
npm.cmd run test:electron
Remove-Item Env:TREE_REGISTER_PACKAGED_EXE
```

テストは `.test-data/` 内の専用プロファイルと生成したフォルダを使用します。利用者のアプリDBとは分離されています。画面画像も各テストのフォルダに保存されます。

## 操作

1. 必要なら最大階層・管理元IDを変更し、「共通設定を適用」を押す。
2. フォルダを選択する。初回の実フォルダ読込時はデモ管理元から `local` に切り替わる。
3. 階層エラーがあれば上限を変更して再選択する。途中の項目は取り込まれず、前の設定を保持する。
4. 登録済み階層があれば確認し、登録対象から外す。
5. 左ペインで対象を選び、登録区分・メタデータ・タグを設定する。変更は自動保存される。
6. 検証エラーを解消し、「登録設定をJSONで保存」を押す。

### キーボード

ツリーにフォーカスがある場合のみ適用します。

| キー | 操作 |
| --- | --- |
| ↑ / ↓ | 表示されている前／次の項目へ |
| → | 展開、または子項目へ |
| ← | 折りたたみ、または親項目へ |
| Home / End | 表示対象の先頭／末尾へ |
| Enter | 設定欄へフォーカス移動 |
| Tab / Shift+Tab | 入力欄・ペイン間を移動 |

### 登録済み台帳

```json
{
  "entries": [
    {
      "sourceId": "local",
      "path": "地域データ/人口",
      "catalogId": "CAT-001",
      "title": "人口統計",
      "registeredAt": "2026-09-15"
    }
  ]
}
```

- 管理元IDの初回読込時に、選択フォルダの親位置を基準位置として保存します。
- `path` はその基準位置からの相対パスを `/` 区切りで指定します。基準位置が `D:\Data` なら `D:\Data\地域データ\人口` は `地域データ/人口` です。
- 同じ管理元IDで子フォルダを選び直しても基準位置を変えません。登録済みの親階層に含まれる場合も検出します。
- 既知の基準位置から同じ実パスと判定できる登録済み情報は、別の管理元IDでも重複として扱います。
- 未対応の管理元IDは、フォルダ選択で基準位置を確定するまで保存できません。
- JSONは5,000,000バイト以下。検証成功時に台帳を置き換え、検証失敗時は既存台帳を維持します。

## データ保存と構成

DBはElectronの `app.getPath('userData')` 内の `tree-register.sqlite` に保存します。通常は `%APPDATA%\tree-register\tree-register.sqlite` です。元フォルダには書き込みません。

```text
src/main/       Electron起動、ダイアログ、IPC受付
src/preload/    目的別の型付きAPI
src/workers/    逐次探索・SQLiteの専用Worker
src/database/   node:sqlite、スキーマ、トランザクション
src/domain/     DCAT構造、継承、除外、重複判定、初期データ
src/shared/     型・IPC入力検証
src/renderer/   React・Material UIの画面
tests/          ドメイン・探索・SQLiteテスト
scripts/        開発起動・Electron統合テスト
```

RendererはNode.jsやSQLiteへ直接アクセスしません。単一WorkerがDB接続を所有し、書込を直列化します。全体の取込はトランザクションで確定します。同じユーザーデータ領域でのアプリ多重起動は抑止します。

要件は [agetn.md](agetn.md)、元の画面試作は [index.html](index.html) に残しています。

## 現時点の範囲

- 開発用の署名なしフォルダ形式ビルドです。インストーラー・コード署名・自動更新は未設定です。
- ジャンクション・シンボリックリンクを検出した場合は説明付きで停止し、追跡しません。
- パス比較はWindowsの通常の大文字・小文字非区別を前提とします。大文字・小文字だけが異なる同名項目のあるフォルダは停止します。
- プレビューは先頭100項目。JSON出力は全対象を含みます。
- 保存前の検査はフォルダ構造の変更を確認します。ファイル本文の内容・更新は検査しません。
- 外部カタログ登録、DCAT RDF出力、登録完了APIは未実装です。

## 参照した公式資料

- [Electron 44.3.0の同梱ランタイム](https://releases.electronjs.org/release/v44.3.0)
- [Node.js SQLite API](https://nodejs.org/api/sqlite.html)
- [Material UIの導入](https://mui.com/material-ui/getting-started/installation/)
