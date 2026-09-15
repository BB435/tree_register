# Project instructions

- 要件・実装方針は `agetn.md` を読む。最新のユーザー指示を優先する。
- 対象はWindows 11。Electron、React、TypeScript、Material UI、SQLiteを使用する。
- SQLiteアクセスはElectron同梱Node.jsの `node:sqlite` に限定する。
- 参照用のルート `index.html` をアプリのエントリに置き換えない。Reactのエントリは `src/renderer/index.html`。
- ソースを変更し、`dist/`・`release/` はビルドで生成する。
- 変更に応じて `npm.cmd run typecheck`、`npm.cmd test`、`npm.cmd run build` を実行する。
- Electronの実動作確認は `npm.cmd run test:electron`。テスト専用データを使い、利用者のDBを変更しない。
- 外部カタログへの登録APIは未定義。設定JSON保存を登録完了として扱わない。
