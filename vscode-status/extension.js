// The effortless bar for Claude Code in VS Code. VS Code draws no plugin UI, so the effortless mod writes what its bar
// would show to ~/.claude/effortless-status-<chat>.json each second it changes; this reads it into the status bar, and
// the menu asks the mod back through ~/.claude/effortless-ask-<chat>.json (see EditorStatus in hooks/register.tsx).
const vscode = require('vscode')
const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')

const DIR = path.join(os.homedir(), '.claude')
const STATUS_RE = /^effortless-status-(.+)\.json$/
// The mod rewrites its file at least every 20 s while the chat runs; older than this, the chat is closed.
const STALE_MS = 60_000
const POLL_MS = 1000
const EFFORTS = { low: 'Low', medium: 'Medium', high: 'High', xhigh: 'XHigh', max: 'Max' }

/** A path to compare with: forward slashes, no trailing slash, lower case (Windows paths ignore case). */
function norm(p) {
  return String(p || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

/** Whether a chat's root is this window's folder, inside it, or holds it. */
function inWorkspace(root) {
  const r = norm(root)
  if (!r) return false
  return (vscode.workspace.workspaceFolders || []).some(f => {
    const w = norm(f.uri.fsPath)
    return r === w || r.startsWith(w + '/') || w.startsWith(r + '/')
  })
}

// A closed chat's status and ask files are removed once they are this old.
const CLEAN_MS = 24 * 60 * 60_000
const ASK_RE = /^effortless-ask-(.+)\.json$/

/** When a chat was last used: a message sent or answered (older mods wrote no lastActiveAt, so their file's time). */
function activeAt(s) {
  return typeof s.lastActiveAt === 'number' ? s.lastActiveAt : s.updatedAt
}

/** The running chats' status files, the one used last first. */
function readChats() {
  let names = []
  try {
    names = fs.readdirSync(DIR)
  } catch {
    return []
  }
  const now = Date.now()
  const chats = []
  for (const name of names) {
    if (!STATUS_RE.test(name)) continue
    try {
      const s = JSON.parse(fs.readFileSync(path.join(DIR, name), 'utf8'))
      if (s && s.v === 1 && typeof s.updatedAt === 'number' && now - s.updatedAt < STALE_MS) chats.push(s)
    } catch {
      // Being rewritten right now: the next poll reads it.
    }
  }
  return chats.sort((a, b) => activeAt(b) - activeAt(a))
}

/** Removes status and ask files no chat has touched for a day: closed chats leave theirs behind. */
function cleanOld() {
  let names = []
  try {
    names = fs.readdirSync(DIR)
  } catch {
    return
  }
  const now = Date.now()
  for (const name of names) {
    if (!STATUS_RE.test(name) && !ASK_RE.test(name)) continue
    const file = path.join(DIR, name)
    try {
      if (now - fs.statSync(file).mtimeMs > CLEAN_MS) fs.unlinkSync(file)
    } catch {
      // Gone already, or in use: the next start tries again.
    }
  }
}

/** The chats this window's bar can show: those in its folder, VS Code ones before desktop or terminal ones (those draw
 * their own bar), each group the one used last first. */
function chatsHere(chats) {
  const here = chats.filter(c => inWorkspace(c.root))
  const theirs = c => (c.surfaces || []).some(s => s === 'desktop' || s === 'terminal')
  return [...here.filter(c => !theirs(c)), ...here.filter(theirs)]
}

/** This window's chat: the one chosen in Switch chat while it runs, else the one used last. */
function pickChat(chats, pinned) {
  const here = chatsHere(chats)
  return (pinned && here.find(c => c.session === pinned)) || here[0] || null
}

/** "just now", "4m ago", "2h ago". */
function ago(at) {
  const min = Math.round((Date.now() - at) / 60_000)
  if (min < 1) return 'just now'
  return min < 60 ? `${min}m ago` : `${Math.round(min / 60)}h ago`
}

function cacheText(s) {
  if (s.cacheLeftMs === null || s.cacheLeftMs === undefined) return null
  const left = s.cacheLeftMs - (Date.now() - s.updatedAt)
  if (left <= 0) return 'cache cold'
  const min = Math.max(1, Math.round(left / 60_000))
  return `cache ${min}m`
}

function modelName(m) {
  return m ? m.charAt(0).toUpperCase() + m.slice(1) : ''
}

/** The status bar item's text, tooltip and colour for a chat's status. */
function look(s) {
  const parts = []
  let warn = false
  if (s.compacting) parts.push('$(sync~spin) Compacting')
  else if (s.handoff) parts.push('$(sync~spin) Handing off')
  else if (s.judging) parts.push('$(sync~spin) Deciding')
  else if (s.paused) parts.push('$(sparkle) Paused')
  // Auto off: the effort is the one set in Claude Code (before the first reply the mod has not seen it yet).
  else if (!s.auto) parts.push(`$(circle-slash) ${s.effort ? EFFORTS[s.effort] : 'Your effort'} (Auto off)`)
  else parts.push(`$(sparkle) ${s.effort ? EFFORTS[s.effort] : 'Auto'}`)
  if (s.model) parts.push(modelName(s.model))
  const text = [parts.join(' · ')]
  if (typeof s.context === 'number') text.push(`${s.context}%`)
  const cache = cacheText(s)
  if (cache) text.push(cache)
  if (cache === 'cache cold' || s.swamped) warn = true
  if (s.advice) {
    text.push('$(arrow-right) Handoff')
    warn = true
  }

  const tip = new vscode.MarkdownString(undefined, true)
  tip.appendMarkdown('**effortless**\n\n')
  if (!s.auto) tip.appendMarkdown('Auto is off: the effort stays as you set it in Claude Code.\n\n')
  else if (s.effort) tip.appendMarkdown(`Auto picked **${EFFORTS[s.effort]}**${s.by && s.by !== 'manual' ? ` (${s.by})` : ''}${s.why ? `: ${s.why}` : ''}\n\n`)
  if (typeof s.context === 'number') tip.appendMarkdown(`Context ${s.context}% full.\n\n`)
  if (cache === 'cache cold') tip.appendMarkdown('Prompt cache cold: the next message re-reads the whole chat at full price. Compact first to save.\n\n')
  else if (cache) tip.appendMarkdown(`Prompt cache warm for about ${cache.slice(6)}: messages until then re-read the chat cheaply.\n\n`)
  if (s.swamped) tip.appendMarkdown('The chat is getting swamped: every message re-reads a lot of context.\n\n')
  if (s.advice) tip.appendMarkdown(`Haiku suggests a handoff: ${s.advice}\n\n`)
  tip.appendMarkdown('Click for Auto, Compact and Handoff.')
  return { text: text.join('  '), tip, warn }
}

let current = null
let item
// The chat chosen in Switch chat; null follows the one used last. Kept until that chat closes.
let pinned = null
let here = []

function refresh() {
  here = chatsHere(readChats())
  if (pinned && !here.some(c => c.session === pinned)) pinned = null
  const chat = pickChat(here, pinned)
  current = chat
  if (!chat) {
    item.text = '$(sparkle) effortless'
    item.tooltip = 'effortless: no running Claude chat in this folder yet. Start one, or check that the effortless plugin (1.71.5+) is installed.'
    item.backgroundColor = undefined
    item.show()
    return
  }
  const { text, tip, warn } = look(chat)
  item.text = text
  item.tooltip = tip
  item.backgroundColor = warn ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined
  item.show()
}

/** Asks the chat's mod for an action; it runs it within a second. */
function ask(action, said) {
  if (!current) {
    vscode.window.showInformationMessage('effortless: no running Claude chat in this folder.')
    return
  }
  const file = path.join(DIR, `effortless-ask-${current.session}.json`)
  try {
    fs.writeFileSync(file, JSON.stringify({ id: crypto.randomUUID(), action, at: Date.now() }))
    vscode.window.setStatusBarMessage(`effortless: ${said}`, 3000)
  } catch (error) {
    vscode.window.showErrorMessage(`effortless: could not reach the chat (${error.message})`)
  }
}

async function menu() {
  if (!current) {
    vscode.window.showInformationMessage('effortless: no running Claude chat in this folder.')
    return
  }
  const busy = current.busy ? 'Claude is replying: it runs when the reply is done' : undefined
  const picks = [
    { label: current.auto ? '$(circle-slash) Turn Auto off' : '$(sparkle) Turn Auto on', detail: current.auto ? 'Every message then runs at the effort set in Claude Code' : 'effortless picks the effort for each message', action: 'auto', said: current.auto ? 'Auto off' : 'Auto on' },
    { label: '$(fold) Compact', detail: busy || 'Summarize this chat in place (Haiku writes the summary)', action: 'compact', said: 'compacting' },
    { label: '$(arrow-right) Handoff (quick)', detail: busy || (current.advice ? `Suggested: ${current.advice}` : 'A short summary, then carry on in a fresh chat'), action: 'handoff', said: 'writing the handoff' },
    { label: '$(file-text) Handoff (full)', detail: busy || 'Checks git and saves HANDOFF.md, then a fresh chat', action: 'handoff-full', said: 'writing the full handoff' },
  ]
  if (here.length > 1) picks.push({ label: '$(arrow-swap) Switch chat', detail: `${here.length} chats run in this folder: choose which one the bar shows`, action: 'switch' })
  const chosen = await vscode.window.showQuickPick(picks, { placeHolder: 'effortless', matchOnDetail: true })
  if (!chosen) return
  if (chosen.action === 'switch') await switchChat()
  else ask(chosen.action, chosen.said)
}

/** Chooses the chat the bar shows, or goes back to following the one used last. */
async function switchChat() {
  const picks = [
    { label: '$(history) Follow the chat used last', description: pinned ? '' : 'current', session: null },
    ...here.map(c => ({
      label: `${c.session === current?.session ? '$(check) ' : ''}${c.label || `Chat ${c.session.slice(0, 8)}`}`,
      description: [c.effort ? EFFORTS[c.effort] : '', modelName(c.model), (c.surfaces || []).join(', ')].filter(Boolean).join(' · '),
      detail: `Used ${ago(activeAt(c))}`,
      session: c.session,
    })),
  ]
  const chosen = await vscode.window.showQuickPick(picks, { placeHolder: 'Which chat should the effortless bar show?' })
  if (!chosen) return
  pinned = chosen.session
  refresh()
}

function activate(context) {
  item = vscode.window.createStatusBarItem('effortless.status', vscode.StatusBarAlignment.Right, 100)
  item.name = 'effortless'
  item.command = 'effortless.menu'
  context.subscriptions.push(
    item,
    vscode.commands.registerCommand('effortless.menu', menu),
    vscode.commands.registerCommand('effortless.toggleAuto', () => ask('auto', 'Auto switched')),
    vscode.commands.registerCommand('effortless.compact', () => ask('compact', 'compacting')),
    vscode.commands.registerCommand('effortless.handoff', () => ask('handoff', 'writing the handoff')),
    vscode.commands.registerCommand('effortless.handoffFull', () => ask('handoff-full', 'writing the full handoff')),
    vscode.commands.registerCommand('effortless.switchChat', switchChat),
    vscode.workspace.onDidChangeWorkspaceFolders(refresh),
  )
  cleanOld()
  refresh()
  const timer = setInterval(refresh, POLL_MS)
  context.subscriptions.push({ dispose: () => clearInterval(timer) })
}

function deactivate() {}

module.exports = { activate, deactivate, norm, pickChat, chatsHere, activeAt, look, cacheText }
