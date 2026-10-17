#!/usr/bin/env node
// Render rig for the band as Claude Code for VS Code draws it above the prompt.
//
//   node tools/render-band/vscode.mjs --command cold --width 700
//
// 1. Runs the real mod in a temporary copy under `claude plugin test` (dump.template.ts, with the band mounted on the
//    vscode surface) and dumps the tree it returns.
// 2. Draws that tree with a copy of the webview's element renderer: the Box, Text, Button and Svg rules of the
//    installed extension's webview/index.js (the style mapper that turns Box props into CSS, the Text one, the button
//    and svg classes of its index.css), on VS Code's Dark+ colours.
// 3. Shoots it with headless Chrome.
//
// What the webview honours, and so what this copy honours: flex direction (rows wrap unless told not to), grow, shrink,
// wrap, alignItems, justifyContent, gap, width and minWidth in ch, height in lh, padding and margin, a 1px border with
// 6px corners for borderStyle round, backgroundColor, overflow hidden, display none. Not position or its offsets,
// alignSelf, hover or a Button's variant: a Button is VS Code's own button, or a bare outlined one with dimColor.
import { spawn, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')

const argv = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 || i + 1 >= argv.length ? fallback : argv[i + 1]
}
const params = {
  percent: Number(opt('percent', '19')),
  cacheMinutes: opt('cache', '59') === 'off' ? null : Number(opt('cache', '59')),
  effort: opt('effort', 'medium'),
  reason: opt('reason', 'a small fix in one file'),
  model: opt('model', 'opus'),
  handoff: opt('handoff', '') || '',
  judged: !argv.includes('--fresh'),
  judging: argv.includes('--judging'),
  working: argv.includes('--working'),
  auto: opt('auto', 'on') !== 'off',
  bodyColumns: Number(opt('columns', '100')),
  press: (opt('press', '') || '').split(',').filter(Boolean),
  command: opt('command', '') || '',
  trace: 0,
  options: Object.fromEntries((opt('options', '') || '').split(',').filter(Boolean).map((kv) => kv.split('='))),
}
const width = Number(opt('width', '700'))
const zoom = Number(opt('zoom', '1.5'))
const name = opt('name', params.command || 'rest')
const out = resolve(opt('out', join(HERE, 'out', `vscode-${name}.html`)))
mkdirSync(dirname(out), { recursive: true })

const treeFile = opt('tree', null)
const tree = treeFile ? JSON.parse(readFileSync(treeFile, 'utf8')) : dumpTree()
writeFileSync(out.replace(/\.html$/, '.tree.json'), JSON.stringify(tree, null, 1))
writeFileSync(out, page(tree))
const png = out.replace(/\.html$/, '.png')
await screenshot(pathToFileURL(out).href, png)
console.log(`page  ${out}\npng   ${png}`)

function dumpTree() {
  const work = mkdtempSync(join(tmpdir(), 'effortless-render-'))
  try {
    for (const part of ['.claude-plugin', 'hooks', 'commands', 'sounds', 'types', 'tsconfig.json'])
      if (existsSync(join(REPO, part))) cpSync(join(REPO, part), join(work, part), { recursive: true })
    mkdirSync(join(work, 'tests'), { recursive: true })
    const test = readFileSync(join(HERE, 'dump.template.ts'), 'utf8')
      .replace('const P: Params = __PARAMS__', () => `const P: Params = ${JSON.stringify(params)}`)
      .replaceAll("surface: 'desktop'", "surface: 'vscode'")
    writeFileSync(join(work, 'tests', 'dump.test.ts'), test)
    const run = spawnSync(`claude plugin test "${work}"`, {
      encoding: 'utf8',
      shell: true,
      env: { ...process.env, CLAUDE_CODE_ENABLE_FUNCTION_HOOKS: '1' },
      maxBuffer: 64 * 1024 * 1024,
    })
    const text = `${run.stdout}\n${run.stderr}`
    const line = text.split(/\r?\n/).find((l) => l.includes('DUMP-TREE '))
    if (!line) fail(`the mod did not draw a band:\n${text.slice(-3000)}`)
    return JSON.parse(line.slice(line.indexOf('DUMP-TREE ') + 'DUMP-TREE '.length))
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

function page(tree) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
:root{--app-primary-foreground:#cccccc;--app-secondary-foreground:#9d9d9d;--app-disabled-foreground:#6e6e6e;--app-primary-background:#1f1f1f;
--app-button-background:#0e639c;--app-button-foreground:#ffffff;--app-button-hover-background:#1177bb;--app-widget-border:#303031;
--app-ghost-button-hover-background:rgba(90,93,94,.31);--app-spacing-small:4px;--app-spacing-medium:8px;--app-input-border:#3c3c3c;
--app-ansi-red:#f14c4c;--app-ansi-green:#23d18b;--app-ansi-yellow:#f5f543;--app-ansi-blue:#3b8eea;--app-ansi-gray:#808080;--app-ansi-white:#e5e5e5;--app-accent-color:#0078d4}
body{margin:0;padding:16px;background:#181818;font-family:"Segoe WPC","Segoe UI",sans-serif;font-size:13px;color:var(--app-primary-foreground)}
.slot{width:${width}px;border:1px solid #2b2b2b;border-radius:6px;padding:4px 8px 8px}
.from{font-size:11px;color:var(--app-secondary-foreground);margin-bottom:4px}
.root{font-family:inherit;line-height:1.4;color:var(--app-primary-foreground);overflow-wrap:break-word;min-width:0}
.box{min-width:0}.text{overflow-wrap:break-word}
.button{white-space:nowrap;font-family:inherit;font-size:inherit;color:var(--app-button-foreground);background:var(--app-button-background);border:1px solid var(--app-widget-border);padding:0 var(--app-spacing-medium);cursor:pointer;border-radius:4px;flex-shrink:0;align-self:flex-start}
.buttonDim{white-space:nowrap;font-family:inherit;font-size:inherit;color:var(--app-secondary-foreground);border:1px solid var(--app-widget-border);padding:0 var(--app-spacing-medium);cursor:pointer;background:0 0;border-radius:4px;flex-shrink:0;align-self:flex-start}
.svg{display:block;contain:size;flex-shrink:0;max-width:100%}
.input{font-family:inherit;font-size:inherit;color:#ccc;background:#313131;border:1px solid var(--app-input-border);padding:0 4px;border-radius:4px;flex:16ch;min-width:8ch;max-width:100%}
</style></head><body><div class="slot" data-rig-band><div class="from">From the effortless plugin</div><div class="root" id="root"></div></div>
<script>
const TREE = ${JSON.stringify(tree)};
const NAMED = {text:'var(--app-primary-foreground)',inactive:'var(--app-secondary-foreground)',subtle:'var(--app-disabled-foreground)',secondaryText:'var(--app-secondary-foreground)',background:'var(--app-primary-background)'};
const ANSI = new Set(['black','red','green','yellow','blue','magenta','cyan','white','gray','grey']);
function color(v){if(typeof v!=='string'||!v)return;const n=NAMED[v];const z=v.replace(/^ansi:/,'');const x=z==='blackBright'?'gray':z.replace(/Bright$/,'');const a=ANSI.has(x)?'var(--app-ansi-'+x.replace('grey','gray')+')':undefined;const h=/^#[0-9a-fA-F]{3,8}$/.test(v)||/^rgb\\(\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*\\d+\\s*\\)$/.test(v)?v:undefined;return n??a??h}
function len(p,k,u){const v=p[k];if(typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e4)return v+u;if(typeof v==='string'&&/^\\d+(\\.\\d+)?%$/.test(v))return v}
const pick=(p,ks,u)=>len(p,ks[0],u)??len(p,ks[1],u)??len(p,ks[2],u);
const oneOf=(p,k,l)=>typeof p[k]==='string'&&l.includes(p[k])?p[k]:undefined;
function boxStyle(p){const d=oneOf(p,'flexDirection',['row','column','row-reverse','column-reverse'])??'row';const w=oneOf(p,'flexWrap',['wrap','nowrap','wrap-reverse'])??(d.startsWith('row')?'wrap':undefined);
return {display:p.display==='none'?'none':'flex',flexDirection:d,flexGrow:typeof p.flexGrow==='number'?p.flexGrow:'',flexShrink:typeof p.flexShrink==='number'?p.flexShrink:'',flexWrap:w??'',
alignItems:oneOf(p,'alignItems',['flex-start','center','flex-end','stretch'])??'',justifyContent:oneOf(p,'justifyContent',['flex-start','center','flex-end','space-between','space-around','space-evenly'])??'',
rowGap:len(p,'rowGap','lh')??len(p,'gap','lh')??'',columnGap:len(p,'columnGap','ch')??len(p,'gap','ch')??'',width:len(p,'width','ch')??'',height:len(p,'height','lh')??'',minWidth:len(p,'minWidth','ch')??'',minHeight:len(p,'minHeight','lh')??'',
marginTop:pick(p,['marginTop','marginY','margin'],'lh')??'',marginBottom:pick(p,['marginBottom','marginY','margin'],'lh')??'',marginLeft:pick(p,['marginLeft','marginX','margin'],'ch')??'',marginRight:pick(p,['marginRight','marginX','margin'],'ch')??'',
paddingTop:pick(p,['paddingTop','paddingY','padding'],'lh')??'',paddingBottom:pick(p,['paddingBottom','paddingY','padding'],'lh')??'',paddingLeft:pick(p,['paddingLeft','paddingX','padding'],'ch')??'',paddingRight:pick(p,['paddingRight','paddingX','padding'],'ch')??'',
border:typeof p.borderStyle==='string'?'1px solid '+(color(p.borderColor)??'var(--app-widget-border)'):'',borderRadius:p.borderStyle==='round'?'6px':'',backgroundColor:color(p.backgroundColor)??'',overflow:p.overflow==='hidden'?'hidden':''}}
function textStyle(p){const c=color(p.color),b=color(p.backgroundColor),inv=p.inverse===true,wrap=p.wrap===undefined||p.wrap==='wrap',tr=typeof p.wrap==='string'&&p.wrap.startsWith('truncate');
return {color:inv?(b??'var(--app-primary-background)'):(c??''),backgroundColor:inv?(c??'var(--app-primary-foreground)'):(b??''),opacity:p.dimColor===true?0.65:'',fontWeight:p.bold===true?700:'',fontStyle:p.italic===true?'italic':'',whiteSpace:wrap?'pre-wrap':'pre',overflow:wrap?'':'hidden',textOverflow:tr?'ellipsis':''}}
function el(tag,cls,style){const e=document.createElement(tag);if(cls)e.className=cls;if(style)Object.assign(e.style,style);return e}
function draw(n){if(n==null||n===false||n===true)return document.createTextNode('');if(typeof n==='string'||typeof n==='number')return document.createTextNode(String(n));
if(Array.isArray(n)){const f=document.createDocumentFragment();n.forEach(c=>f.append(draw(c)));return f}
const p=n.props??{},kids=n.children??p.children??[];const add=(e)=>{(Array.isArray(kids)?kids:[kids]).forEach(c=>e.append(draw(c)));return e};
switch(n.type){case 'Box':return add(el('div','box',boxStyle(p)));case 'Text':return add(el('span','text',textStyle(p)));
case 'Button':{const b=el('button',p.dimColor===true?'buttonDim':'button');if(p.label!==undefined)b.textContent=p.label;else add(b);return b}
case 'Input':{const i=el('input','input');i.placeholder=p.placeholder??'';return i}
case 'Svg':{const i=el('img','svg');i.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(p.source);if(p.width)i.width=p.width;if(p.height)i.height=p.height;i.alt=p.alt??'';return i}
default:return add(document.createDocumentFragment())}}
document.getElementById('root').append(draw(TREE));
document.documentElement.dataset.rigStatus='ready';
</script></body></html>`
}

function fail(message) {
  console.error(`vscode rig: ${message}`)
  process.exit(1)
}

function findChrome() {
  const candidates = [
    opt('chrome', ''),
    join(process.env.PROGRAMFILES ?? '', 'Google/Chrome/Application/chrome.exe'),
    join(process.env['PROGRAMFILES(X86)'] ?? '', 'Microsoft/Edge/Application/msedge.exe'),
    join(process.env.PROGRAMFILES ?? '', 'Microsoft/Edge/Application/msedge.exe'),
    join(process.env.LOCALAPPDATA ?? '', 'Google/Chrome/Application/chrome.exe'),
  ]
  const found = candidates.find((c) => c && existsSync(c))
  if (!found) fail('no Chrome or Edge found; pass --chrome <path>')
  return found
}

async function screenshot(pageUrl, png) {
  const profile = mkdtempSync(join(tmpdir(), 'effortless-render-chrome-'))
  const chrome = spawn(findChrome(), ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--hide-scrollbars', '--no-first-run', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' })
  try {
    const portFile = join(profile, 'DevToolsActivePort')
    for (let i = 0; i < 100 && !existsSync(portFile); i++) await sleep(100)
    const port = readFileSync(portFile, 'utf8').split('\n')[0]
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
    await new Promise((ok, no) => ((ws.onopen = ok), (ws.onerror = no)))
    let id = 0
    const pending = new Map()
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data)
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg)
        pending.delete(msg.id)
      }
    }
    const send = (method, p = {}) =>
      new Promise((ok, no) => {
        const n = ++id
        pending.set(n, (msg) => (msg.error ? no(new Error(`${method}: ${msg.error.message}`)) : ok(msg.result)))
        ws.send(JSON.stringify({ id: n, method, params: p }))
      })
    await send('Emulation.setDeviceMetricsOverride', { width: width + 64, height: 400, deviceScaleFactor: zoom, mobile: false })
    await send('Page.enable')
    await send('Page.navigate', { url: pageUrl })
    let state = ''
    for (let i = 0; i < 100 && state !== 'ready'; i++) {
      await sleep(100)
      state = (await send('Runtime.evaluate', { expression: 'document.documentElement.dataset.rigStatus || ""', returnByValue: true })).result.value
    }
    if (state !== 'ready') fail('the page did not draw')
    await sleep(400)
    const rect = JSON.parse((await send('Runtime.evaluate', { expression: 'JSON.stringify(document.querySelector("[data-rig-band]").getBoundingClientRect())', returnByValue: true })).result.value)
    const clip = { x: rect.x - 8, y: rect.y - 8, width: rect.width + 16, height: rect.height + 16, scale: 1 }
    const { data } = await send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true })
    writeFileSync(png, Buffer.from(data, 'base64'))
    ws.close()
  } finally {
    chrome.kill()
    await sleep(300)
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    } catch {}
  }
}

function sleep(ms) {
  return new Promise((ok) => setTimeout(ok, ms))
}
