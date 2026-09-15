// Workspace-local fallback for a broken global npm shim. Uses the same npm CLI, not another package manager.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
const cli = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
if (!existsSync(cli)) throw new Error('Node.jsに同梱されたnpmが見つかりません。Node.jsのインストールを確認してください。');
const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], { stdio: 'inherit' });
child.on('exit', code => { process.exitCode = code ?? 1; });
