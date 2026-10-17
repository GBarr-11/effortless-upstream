// The bands as Claude Code for VS Code can draw them. Its webview lays a tree out with plain flexbox and leaves out
// what the desktop builds the bands from: `position` and its offsets (an absolute layer lands in the flow, art and
// all), `hover`, a Button's `variant` (every Button is VS Code's own blue one, or a bare outlined one with dimColor),
// and it wraps a row unless told not to. So the drawing the desktop gets is turned here, once, for that surface:
//
// - Art layers (an absolute Box with pictures and no words or controls) are left out, save the art at the band's right
//   edge: it closes the band's row instead, after the buttons.
// - A click layer (an absolute Box of Buttons with blank labels, laid over a switch, an icon or a card) becomes a
//   real Button on what it covered: its words, or a glyph for an icon.
// - Layers of words and controls join the flow where they were placed: the left or right end of a row, or a header
//   row at the top of a column. The room kept for them (a spacer's minWidth, a Box of fixed height) is let go.
// - Rows do not wrap, as on the desktop and the terminal.
// - Buttons keep the desktop's ranks in what VS Code can draw (see button).

type Node = { type: string; props?: Record<string, unknown>; children?: unknown[]; press?: unknown; [k: string]: unknown }

const isNode = (n: unknown): n is Node => typeof n === 'object' && n !== null && !Array.isArray(n) && typeof (n as Node).type === 'string'
const kids = (n: Node): unknown[] => (Array.isArray(n.children) ? n.children : [])
const flat = (list: unknown[]): unknown[] => list.flatMap(c => (Array.isArray(c) ? flat(c) : c === null || c === undefined || c === false || c === true ? [] : [c]))
const OFFSETS = ['position', 'top', 'left', 'right', 'bottom'] as const
// The desktop's band is about two lines tall.
const BAND_ROWS = 2
// Two of VS Code's lines (13 px type, 1.4 line height), in px: the art's height.
const BAND_PX = 36
// The art's width: enough of its right end to start from clear (the frost's ice fades in a little left of here).
const ART_PX = 240

/** Every node under n, n included. */
function* nodes(n: unknown): Generator<Node> {
  if (Array.isArray(n)) for (const c of n) yield* nodes(c)
  else if (isNode(n)) {
    yield n
    for (const c of kids(n)) yield* nodes(c)
  }
}
const isAbsolute = (n: unknown): n is Node => isNode(n) && n.type === 'Box' && n.props?.position === 'absolute'
const blank = (b: Node) => typeof b.props?.label === 'string' && (b.props.label as string).trim() === ''
const controls = (n: Node) => [...nodes(n)].filter(x => ['Button', 'Input', 'Select', 'Link'].includes(x.type))
const hasWords = (n: Node) => [...nodes(n)].some(x => x.type === 'Text' && textOf(x).trim() !== '')
const hasArt = (n: Node) => [...nodes(n)].some(x => x.type === 'Svg')
function textOf(n: unknown): string {
  if (typeof n === 'string' || typeof n === 'number') return String(n)
  if (Array.isArray(n)) return n.map(textOf).join('')
  return isNode(n) ? kids(n).map(textOf).join('') : ''
}

/** A #rrggbb colour too dark to read on the panels: words meant for a light pill. */
const isDark = (c: unknown) => {
  if (typeof c !== 'string' || !/^#[0-9a-fA-F]{6}/.test(c)) return false
  const n = parseInt(c.slice(1, 7), 16)
  return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255) < 80
}

/** A layer of nothing but pictures: the frost, a glow, an entrance. */
const isArtLayer = (n: Node) => controls(n).length === 0 && !hasWords(n)
/** A layer of invisible Buttons over something drawn under it. */
const isClickLayer = (n: Node) => {
  const c = controls(n)
  return c.length > 0 && c.every(b => b.type === 'Button' && blank(b)) && !hasWords(n)
}

// Icons whose click layer covers no words: the glyph drawn as the Button.
const GLYPHS: Record<string, string> = { Settings: '⚙', Close: '✕', Back: '←' }

/**
 * The Button as the desktop ranks it, in what VS Code can draw: a Button there always shows its label in the
 * webview's own colours (the engine needs the label, and the webview draws it over any children). The primary one is
 * VS Code's own filled button, every other its outlined one.
 */
function button(b: Node, label?: string): Node {
  const props = { ...(b.props ?? {}) }
  const primary = props.variant === 'primary' && props.plain !== true && props.dimColor !== true
  for (const k of ['variant', 'plain', 'hover', 'role']) delete props[k]
  if (label !== undefined) props.label = label
  return { ...b, props: primary ? props : { ...props, dimColor: true } }
}

/** The first Text under n, replaced by what make returns; n unchanged when it has none. */
function replaceFirstText(n: Node, make: (t: Node) => Node): { node: Node; done: boolean } {
  let done = false
  const walk = (x: unknown): unknown => {
    if (done || !isNode(x)) return x
    if (x.type === 'Text' && textOf(x).trim()) {
      done = true
      return make(x)
    }
    if (x.type !== 'Box') return x
    return { ...x, children: kids(x).map(walk) }
  }
  const node = walk(n) as Node
  return { node, done }
}
function replaceFirstSvg(n: Node, make: (s: Node) => Node): { node: Node; done: boolean } {
  let done = false
  const walk = (x: unknown): unknown => {
    if (done || !isNode(x)) return x
    if (x.type === 'Svg') {
      done = true
      return make(x)
    }
    if (x.type !== 'Box') return x
    return { ...x, children: kids(x).map(walk) }
  }
  return { node: walk(n) as Node, done }
}

const inFlow = (n: Node): Node => {
  const p = n.props ?? {}
  const props = { ...p }
  for (const k of OFFSETS) delete props[k]
  // Its height was the room of the layer it sat in.
  if (typeof props.height === 'number' && !Number.isInteger(props.height)) delete props.height
  // Pinned to both sides it filled its parent: it does so in the flow. Hung out past an edge (a window that clips
  // what it holds), its width was the overhang's: the flow gives it its parent's.
  const spans = p.left !== undefined && p.right !== undefined
  if (spans || OFFSETS.some(k => typeof p[k] === 'number' && (p[k] as number) < 0)) delete props.width
  return { ...n, props: spans ? { ...props, flexGrow: 1, flexShrink: 1, minWidth: 0 } : { ...props, flexShrink: 0 } }
}

/** A Box that only keeps room: no children, a size and nothing to see. */
const isRoom = (n: unknown) =>
  isNode(n) && n.type === 'Box' && flat(kids(n)).length === 0 && n.props?.backgroundColor === undefined && n.props?.borderStyle === undefined && n.props?.flexGrow === undefined

/** The tree turned for the VS Code surface (see the top of this file). */
export function forVscode(tree: unknown): unknown {
  return turn(tree, true)
}

function turn(n: unknown, isRoot: boolean): unknown {
  if (Array.isArray(n)) return n.map(c => turn(c, false))
  if (!isNode(n)) return n
  if (n.type === 'Button') return button(n)
  // A blank submit label (the desktop's way to hide the field's own Enter hint) is an empty button here.
  if (n.type === 'Input' && typeof n.props?.submitLabel === 'string' && !n.props.submitLabel.replace(/[\s\u200b]/g, '')) {
    const props = { ...n.props }
    delete props.submitLabel
    return { ...n, props }
  }
  if (n.type !== 'Box') return n

  const props = { ...(n.props ?? {}) }
  delete props.hover
  if (props.position === 'relative') delete props.position
  const row = props.flexDirection === undefined || String(props.flexDirection).startsWith('row')
  if (row && props.flexWrap === undefined) props.flexWrap = 'nowrap'
  const list = flat(kids(n))

  // The click layers: each gives its first Button to what it covered.
  const clicks = list.filter((c): c is Node => isAbsolute(c) && isClickLayer(c))
  let rest = list.filter(c => !clicks.includes(c as Node))
  // Art at the band's right edge, kept for the spacer; every other picture layer goes.
  let edgeArt: Node | null = null
  const before = rest.length
  rest = rest.filter(c => {
    if (!isAbsolute(c) || !isArtLayer(c)) return true
    if (isRoot && !edgeArt && c.props?.right === 0 && c.props?.left === undefined && hasArt(c)) edgeArt = c
    return false
  })
  const hadLayers = clicks.length > 0 || rest.length !== before || rest.some(isAbsolute)

  // Layers of words and controls join the flow: in a column, those at the top become one header row.
  let out: unknown[]
  if (!row && rest.some(isAbsolute)) {
    const top = rest.filter((c): c is Node => isAbsolute(c) && (c.props?.top === 0 || c.props?.top === undefined) && c.props?.bottom === undefined)
    const left = top.filter(c => c.props?.right === undefined)
    const right = top.filter(c => c.props?.right !== undefined)
    const others = rest.filter(c => !top.includes(c as Node))
    // The Box right after them kept their room; the header row takes it now.
    const firstFlow = others.findIndex(c => !isAbsolute(c))
    if (firstFlow >= 0 && isRoom(others[firstFlow])) others.splice(firstFlow, 1)
    const header: Node = {
      type: 'Box',
      props: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: 2 },
      children: [...left.map(inFlow), { type: 'Box', props: { flexGrow: 1 } }, ...right.map(inFlow)],
    }
    out = [...(top.length ? [header] : []), ...others.map(c => (isAbsolute(c) ? inFlow(c) : c))]
  } else {
    const left = rest.filter((c): c is Node => isAbsolute(c) && c.props?.right === undefined)
    const right = rest.filter((c): c is Node => isAbsolute(c) && c.props?.right !== undefined)
    const flow = rest.filter(c => !isAbsolute(c))
    out = [...left.map(inFlow), ...flow, ...right.map(inFlow)]
  }
  // Room kept for the layers: fixed-size empty Boxes go, spacers keep their stretch but not their width.
  if (hadLayers)
    out = out.flatMap(c => {
      if (!isNode(c) || c.type !== 'Box' || flat(kids(c)).length) return [c]
      if (c.props?.flexGrow !== undefined) return [{ ...c, props: { ...c.props, minWidth: 1 } }]
      return isRoom(c) && (c.props?.width !== undefined || c.props?.height !== undefined) ? [] : [c]
    })
  // A band (the root row, with its own ground) stands as tall as the desktop's, its words and buttons centred.
  if (isRoot && row && props.backgroundColor !== undefined) props.minHeight = BAND_ROWS
  let box: Node = { ...n, props, children: out.map(c => turn(c, false)) }

  // The covered words (or icon) become the Button the click layer held.
  for (const layer of clicks) {
    const hit = controls(layer).find(b => b.type === 'Button')
    if (!hit) continue
    // Words drawn dark sat on a light pill: the desktop's main action.
    const words = replaceFirstText(box, t => button(isDark(t.props?.color) ? { ...hit, props: { ...hit.props, plain: undefined, variant: 'primary' } } : hit, textOf(t).trim()))
    if (words.done) {
      box = words.node
      continue
    }
    const icon = replaceFirstSvg(box, s => {
      const alt = typeof s.props?.alt === 'string' ? s.props.alt : ''
      return button(hit, GLYPHS[alt] ?? (alt || '•'))
    })
    box = icon.node
  }

  // The art at the band's right end, against its edge as on the desktop: there the buttons lie over it, here they
  // sit just left of it. It takes only the room the rest leaves (a sliver when there is none), as tall as the band.
  if (edgeArt) {
    const picture = [...nodes(edgeArt)].find(x => x.type === 'Svg')
    if (picture) {
      box.props = { ...box.props, paddingRight: 0 }
      box.children = [
        ...(box.children ?? []),
        {
          type: 'Box',
          props: { key: 'vscode-art', width: 0, flexGrow: 1, minWidth: 3, height: BAND_ROWS, overflow: 'hidden', justifyContent: 'flex-end', alignItems: 'center' },
          children: [{ ...picture, props: { ...picture.props, width: ART_PX, height: BAND_PX } }],
        },
      ]
    }
  }
  return box
}
