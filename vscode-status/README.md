# effortless status

The effortless bar for Claude Code in VS Code. VS Code draws no plugin UI yet, so this small extension shows effortless
in VS Code's status bar instead:

`✦ Low · Opus  20%  cache 59m`

- **Low** is the effort effortless picked for the last message (`(manual)` when Auto is off), **Opus** the model.
- **20%** is how full the chat's context is; **cache 59m** how long the prompt cache stays warm.
- It turns amber when the cache went cold, the chat is swamped, or Haiku suggests a handoff.
- Click it for **Auto on/off**, **Compact** and **Handoff** (quick or full). Each is also a command (`effortless: ...`).

It shows the newest running Claude chat whose folder is this window's. It needs the effortless plugin from this fork,
version 1.71.3 or later, which writes `~/.claude/effortless-status-<chat>.json`.

## Build and install

```bash
npx @vscode/vsce package --skip-license
code --install-extension effortless-status-0.1.0.vsix
```
