// Pixel-art scenes for a plain terminal. A terminal cannot draw an SVG, but it can paint cells with a glyph, a foreground
// and a background colour: this reads the shapes of a scene (rectangles, alone or as paths of rectangles) into a grid of
// pixels, shrinks it to the room there is, and packs two pixel rows into each row of half-block cells. Pure functions, no
// `$`: the card hands the result to the terminal's Raster element.

type Pixel = { r: number; g: number; b: number; a: number }

const NAMED: Record<string, string> = { black: '#000000', white: '#ffffff', red: '#ff0000', none: '' }

function colour(value: string | undefined): [number, number, number] | null {
  const v = String(value ?? '').trim().toLowerCase()
  const hex = (NAMED[v] ?? v).replace('#', '')
  if (/^[0-9a-f]{3}$/.test(hex)) return [parseInt(hex[0] + hex[0], 16), parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16)]
  if (/^[0-9a-f]{6}$/.test(hex)) return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
  return null
}

const attr = (attrs: string, name: string) => attrs.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*"([^"]*)"`))?.[1]

/** The rectangles of a path's data: every subpath that is an axis-aligned box (M, H, V, L, Z in either case). */
function pathBoxes(d: string): [number, number, number, number][] {
  const boxes: [number, number, number, number][] = []
  let x = 0
  let y = 0
  let pts: [number, number][] = []
  const flush = () => {
    if (pts.length >= 3) {
      const xs = pts.map(p => p[0])
      const ys = pts.map(p => p[1])
      const x0 = Math.min(...xs)
      const x1 = Math.max(...xs)
      const y0 = Math.min(...ys)
      const y1 = Math.max(...ys)
      if (pts.every(p => (p[0] === x0 || p[0] === x1) && (p[1] === y0 || p[1] === y1))) boxes.push([x0, y0, x1 - x0, y1 - y0])
    }
    pts = []
  }
  for (const m of d.matchAll(/([MmHhVvLlZz])([^MmHhVvLlZz]*)/g)) {
    const cmd = m[1]
    const n = (m[2].match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number)
    const rel = cmd === cmd.toLowerCase()
    const up = cmd.toUpperCase()
    if (up === 'M') {
      flush()
      x = rel ? x + n[0] : n[0]
      y = rel ? y + n[1] : n[1]
      pts.push([x, y])
    } else if (up === 'H') {
      x = rel ? x + n[0] : n[0]
      pts.push([x, y])
    } else if (up === 'V') {
      y = rel ? y + n[0] : n[0]
      pts.push([x, y])
    } else if (up === 'L') {
      x = rel ? x + n[0] : n[0]
      y = rel ? y + n[1] : n[1]
      pts.push([x, y])
    } else if (up === 'Z') flush()
  }
  flush()
  return boxes
}

/** The scene's first frame as pixels: a grid of the viewBox's units. Groups that start hidden are skipped, groups an
 * opacity animation starts at 1 are shown; transforms and animations are otherwise ignored. */
export function sceneGrid(svg: string): { w: number; h: number; px: Pixel[] } | null {
  const root = svg.match(/<svg\b([^>]*)>/)
  if (!root) return null
  const vb = attr(root[1], 'viewBox')?.trim().split(/[\s,]+/).map(Number)
  const w = Math.round(vb?.[2] ?? Number(attr(root[1], 'width')))
  const h = Math.round(vb?.[3] ?? Number(attr(root[1], 'height')))
  if (!w || !h || w > 1024 || h > 1024) return null
  const px: Pixel[] = Array.from({ length: w * h }, () => ({ r: 0, g: 0, b: 0, a: 0 }))
  const paint = (x0: number, y0: number, bw: number, bh: number, rgb: [number, number, number], alpha: number) => {
    for (let y = Math.max(0, Math.round(y0)); y < Math.min(h, Math.round(y0 + bh)); y++) {
      for (let x = Math.max(0, Math.round(x0)); x < Math.min(w, Math.round(x0 + bw)); x++) {
        const p = px[y * w + x]
        const out = alpha + p.a * (1 - alpha)
        if (out <= 0) continue
        p.r = (rgb[0] * alpha + p.r * p.a * (1 - alpha)) / out
        p.g = (rgb[1] * alpha + p.g * p.a * (1 - alpha)) / out
        p.b = (rgb[2] * alpha + p.b * p.a * (1 - alpha)) / out
        p.a = out
      }
    }
  }
  // One entry per open <g>: shown or not, and its opacity.
  const stack: { shown: boolean; opacity: number }[] = []
  const hidden = () => stack.some(g => !g.shown)
  const opacity = () => stack.reduce((o, g) => o * g.opacity, 1)
  for (const m of svg.matchAll(/<(\/?)([A-Za-z][\w:-]*)([^>]*?)(\/?)>/g)) {
    const closing = m[1] === '/'
    const name = m[2]
    const attrs = m[3]
    if (name === 'g') {
      if (closing) stack.pop()
      else if (m[4] !== '/') {
        const o = attr(attrs, 'opacity')
        stack.push({ shown: o === undefined || Number(o) > 0, opacity: o === undefined ? 1 : Number(o) || 0 })
      }
      continue
    }
    if (closing) continue
    if (name === 'animate' && attr(attrs, 'attributeName') === 'opacity' && stack.length) {
      // Its first value is how the group starts.
      const first = Number((attr(attrs, 'values') ?? '').split(';')[0])
      const top = stack[stack.length - 1]
      if (!Number.isNaN(first)) {
        top.shown = first > 0
        top.opacity = first > 0 ? 1 : 0
      }
      continue
    }
    if (hidden()) continue
    const rgb = colour(attr(attrs, 'fill'))
    if (!rgb) continue
    const alpha = Math.min(1, Number(attr(attrs, 'fill-opacity') ?? 1) * Number(attr(attrs, 'opacity') ?? 1) * opacity())
    if (alpha <= 0) continue
    if (name === 'rect') {
      const rw = Number(attr(attrs, 'width'))
      const rh = Number(attr(attrs, 'height'))
      if (rw > 0 && rh > 0) paint(Number(attr(attrs, 'x') ?? 0), Number(attr(attrs, 'y') ?? 0), rw, rh, rgb, alpha)
    } else if (name === 'path') {
      for (const [bx, by, bw, bh] of pathBoxes(attr(attrs, 'd') ?? '')) paint(bx, by, bw, bh, rgb, alpha)
    }
  }
  return px.some(p => p.a > 0) ? { w, h, px } : null
}

const base64 = (bytes: Uint8Array) => {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out += abc[(n >> 18) & 63] + abc[(n >> 12) & 63] + (i + 1 < bytes.length ? abc[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? abc[n & 63] : '=')
  }
  return out
}

const DEFAULT = 0x01000000
const rgbInt = (p: Pixel) => (Math.round(p.r) << 16) | (Math.round(p.g) << 8) | Math.round(p.b)

/** The scene as terminal cells: shrunk by whole pixels to fit `maxCols` columns and `maxRows` rows, two pixel rows to a
 * row of half blocks. Null when the scene has nothing this can read (a quote, a picture). */
export function sceneCells(svg: string, maxCols: number, maxRows: number): { columns: number; rows: number; cells: string } | null {
  const grid = sceneGrid(svg)
  if (!grid) return null
  const k = Math.max(1, Math.ceil(grid.w / Math.max(8, maxCols)), Math.ceil(grid.h / (Math.max(4, maxRows) * 2)))
  const columns = Math.ceil(grid.w / k)
  const pixelRows = Math.ceil(grid.h / k)
  const rows = Math.ceil(pixelRows / 2)
  // Each shrunk pixel averages its block, weighted by how much of it is painted.
  const small: Pixel[] = []
  for (let y = 0; y < rows * 2; y++) {
    for (let x = 0; x < columns; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let n = 0
      for (let dy = 0; dy < k; dy++) {
        for (let dx = 0; dx < k; dx++) {
          const sx = x * k + dx
          const sy = y * k + dy
          if (sx >= grid.w || sy >= grid.h) continue
          const p = grid.px[sy * grid.w + sx]
          n++
          a += p.a
          r += p.r * p.a
          g += p.g * p.a
          b += p.b * p.a
        }
      }
      small.push(a > 0 ? { r: r / a, g: g / a, b: b / a, a: a / Math.max(1, n) } : { r: 0, g: 0, b: 0, a: 0 })
    }
  }
  const words = new Uint32Array(columns * rows * 3)
  const solid = (p: Pixel) => p.a >= 0.5
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const top = small[row * 2 * columns + col]
      const bottom = small[(row * 2 + 1) * columns + col]
      const i = (row * columns + col) * 3
      if (solid(top) && solid(bottom)) { words[i] = 0x2580; words[i + 1] = rgbInt(top); words[i + 2] = rgbInt(bottom) }
      else if (solid(top)) { words[i] = 0x2580; words[i + 1] = rgbInt(top); words[i + 2] = DEFAULT }
      else if (solid(bottom)) { words[i] = 0x2584; words[i + 1] = rgbInt(bottom); words[i + 2] = DEFAULT }
      else { words[i] = 0x20; words[i + 1] = DEFAULT; words[i + 2] = DEFAULT }
    }
  }
  return { columns, rows, cells: base64(new Uint8Array(words.buffer)) }
}
