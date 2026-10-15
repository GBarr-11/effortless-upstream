// The quotes set, drawn when a quote is shown instead of shipped as one file each: a pixel quill writes the line in
// italic Georgia, the letters drawn on behind its nib, goes back to its inkwell, and the author's name shows. Pure
// (no $), so the card and the tests both call it.
//
// The SVG's own attributes are the finished card (every letter inked, the quill resting in the inkwell); the
// animations only play the writing up to it. Taking the animations out, as stillCard does, leaves the finished card,
// and the root's data-once says after how many seconds that is the right thing to show.
import { INKWELL, ITALIC, QUILL, UPRIGHT } from './quill-data'

const VW = 560
const VH = 350
const INK = '#d97757'
const GREY = '#8a8780'
const FAMILY = "Georgia, 'Times New Roman', serif"
const WELL_X = 52 // bottom left, clear of the author on the right; the tilted feather stays inside the card
const WELL_Y = VH - 40
const FPS = 30
const REST_ANGLE = 14

const num = (v: number) => {
  const s = v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
  return s === '' || s === '-0' ? '0' : s
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

// A line's width at a font size: the sum of its letters' advances (no kerning), measured from Georgia once.
function measure(table: Record<string, number>, text: string, size: number) {
  let w = 0
  for (const ch of text) w += table[ch] ?? 500
  return (w * size) / 1000
}

function wrap(text: string, size: number, limit: number): [string, number][] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const trial = line ? `${line} ${word}` : word
    if (measure(ITALIC, trial, size) <= limit) line = trial
    else {
      lines.push(line)
      line = word
    }
  }
  lines.push(line)
  return lines.map(l => [l, measure(ITALIC, l, size)])
}

// The biggest size whose wrapped lines fit four rows in the writing area, with no lonely last word.
export function quoteLayout(text: string): { size: number; lines: [string, number][] } {
  for (let size = 46; size >= 18; size--) {
    const lines = wrap(text, size, 470)
    const widest = Math.max(...lines.map(([, w]) => w))
    // at most four lines, and never so tall that the last one reaches down to the quill in its corner
    const tall = size * 1.35 * (lines.length - 1) + size
    if (lines.length <= 4 && tall <= 190 && !(lines.length > 1 && lines[lines.length - 1][1] < 0.3 * widest)) return { size, lines }
  }
  return { size: 18, lines: wrap(text, 18, 430) }
}

type Seg = { s0: number; s1: number; kind: 'rest' | 'dip' | 'arc' | 'write'; d: number[] }

export function quoteCard(text: string, author: string): string {
  const { size, lines } = quoteLayout(text)
  const lead = size * 1.35
  const blockW = Math.max(...lines.map(([, w]) => w))
  const blockH = lead * (lines.length - 1) + size
  const authSize = Math.max(14, Math.round(size * 0.55))
  const top = (VH - (blockH + authSize * 1.8)) / 2 + size * 0.8 // baseline of the first line
  const left = (VW - blockW) / 2

  // The quill's motion as segments of time, sampled finely below: a dip in the ink, an eased arc to the line, small
  // handwriting loops along it while the feather sways, an arc home and a last dip.
  const segs: Seg[] = []
  let t = 0
  const seg = (dur: number, kind: Seg['kind'], d: number[]) => {
    segs.push({ s0: t, s1: t + dur, kind, d })
    t += dur
  }
  seg(0.4, 'rest', [WELL_X, WELL_Y])
  seg(0.4, 'dip', [WELL_X, WELL_Y])
  let here = [WELL_X, WELL_Y]
  const reveal: { x0: number; base: number; w: number; t0: number; t1: number }[] = []
  lines.forEach(([, w], i) => {
    const x0 = (VW - w) / 2
    const base = top + i * lead
    seg(i === 0 ? 0.55 : 0.38, 'arc', [here[0], here[1], x0, base, i === 0 ? 34 : 16, i === 0 ? REST_ANGLE : -2, -2])
    const dur = Math.max(0.6, w / 330)
    seg(dur, 'write', [x0, base, w])
    reveal.push({ x0, base, w, t0: t - dur, t1: t })
    here = [x0 + w, base]
  })
  seg(0.65, 'arc', [here[0], here[1], WELL_X, WELL_Y, 40, -2, REST_ANGLE])
  seg(0.4, 'dip', [WELL_X, WELL_Y])
  const done = t
  seg(0.4, 'rest', [WELL_X, WELL_Y])
  const end = t

  const ease = (u: number) => u * u * (3 - 2 * u)
  const at = (tt: number): [number, number, number] => {
    for (const { s0, s1, kind, d } of segs) {
      if (tt < s0 || tt > s1) continue
      const u = s1 > s0 ? (tt - s0) / (s1 - s0) : 1
      if (kind === 'rest') return [d[0], d[1], REST_ANGLE]
      if (kind === 'dip') {
        const k = Math.sin(u * Math.PI)
        return [d[0], d[1] + 7 * k, REST_ANGLE - 6 * k]
      }
      if (kind === 'arc') {
        // the tilt blends from where it starts to where it lands, leaning back a little mid-air
        const [ax, ay, bx, by, lift, r0, r1] = d
        const e = ease(u)
        return [ax + (bx - ax) * e, ay + (by - ay) * e - lift * Math.sin(e * Math.PI), r0 + (r1 - r0) * e - 9 * Math.sin(u * Math.PI)]
      }
      const [x0, base, w] = d
      const ph = (tt - s0) * 2 * Math.PI * 5.2
      return [x0 + w * u + 2.6 * Math.cos(ph), base - 5 + 3.2 * Math.sin(ph), -2 + 5 * Math.sin(ph * 0.5) + 3 * Math.sin(ph * 0.23)]
    }
    return [WELL_X, WELL_Y, REST_ANGLE]
  }
  const n = Math.floor(end * FPS) + 1
  const samples = Array.from({ length: n }, (_, k) => at(Math.min(end, k / FPS)))
  const total = (n - 1) / FPS
  const dur = `${num(total)}s`
  const move = samples.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(';')
  const turn = samples.map(([, , r]) => r.toFixed(1)).join(';')
  const k = (v: number) => num(Math.min(1, v / total))

  // Each letter is written, not faded: its outline is drawn on as a dash that grows round it (stroke-dashoffset),
  // then the ink fills it. Per-letter tspans, no clip paths or ids, so two cards on one page cannot clash.
  const dash = Math.round(size * 4.5) // longer than any letter's outline at this size
  const words = lines.map(([line, w], i) => {
    const { x0, base, t0, t1 } = reveal[i]
    const chars = [...line]
    let before = 0
    const spans = chars.map(ch => {
      const a0 = t0 + (t1 - t0) * (measure(ITALIC, before ? chars.slice(0, before).join('') : '', size) / w)
      before++
      const a1 = t0 + (t1 - t0) * (measure(ITALIC, chars.slice(0, before).join(''), size) / w)
      const a2 = Math.min(total, a1 + 0.35)
      return `<tspan stroke-dasharray="${dash} ${dash}" stroke-dashoffset="0">${esc(ch)}` +
        `<animate attributeName="stroke-dashoffset" values="${dash};${dash};0;0" keyTimes="0;${k(a0)};${k(a1 + 0.12)};1" dur="${dur}" fill="freeze"/>` +
        `<animate attributeName="fill-opacity" values="0;0;1;1" keyTimes="0;${k(a1)};${k(a2)};1" dur="${dur}" fill="freeze"/></tspan>`
    })
    return `<text x="${num(x0)}" y="${num(base)}" xml:space="preserve">${spans.join('')}</text>`
  })
  const ay = top + (lines.length - 1) * lead + authSize * 1.9
  // The author sits under the quote's right edge, moved right if a long name would reach the inkwell corner.
  const aw = measure(UPRIGHT, author, authSize) + author.length
  const ax = Math.min(VW - 24, Math.max(left + blockW, 150 + aw))
  const sign = `<text x="${num(ax)}" y="${num(ay)}" text-anchor="end" font-size="${authSize}" fill="${GREY}" stroke="none" ` +
    `font-style="normal" letter-spacing="1">${esc(author)}<animate attributeName="opacity" values="0;0;1;1" ` +
    `keyTimes="0;${k(done - 0.6)};${k(done + 0.3)};1" dur="${dur}" fill="freeze"/></text>`
  const path = `<animateTransform attributeName="transform" type="translate" values="${move}" dur="${dur}" fill="freeze"/>`
  const sway = `<animateTransform attributeName="transform" type="rotate" values="${turn}" dur="${dur}" fill="freeze"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" data-fit="contain" data-once="${num(total)}" width="${VW}" height="${VH}" viewBox="0 0 ${VW} ${VH}">` +
    `<g font-family="${FAMILY}" font-style="italic" font-size="${size}" fill="${INK}" stroke="${INK}" stroke-width="0.8" stroke-linejoin="round">${words.join('')}${sign}</g>` +
    `<g shape-rendering="crispEdges"><g transform="translate(${WELL_X},${WELL_Y})">${INKWELL}</g>` +
    `<g transform="translate(${WELL_X},${WELL_Y})">${path}<g transform="rotate(${REST_ANGLE})">${sway}${QUILL}</g></g></g></svg>`
}

// A play-once card with its animations taken out: the finished card, as it should stay once it has been written.
export function stillCard(svg: string): string {
  return svg.replace(/<(animate\w*|set)\b[^>]*\/>/g, '').replace(/<(animate\w*|set)\b[^>]*>[\s\S]*?<\/\1>/g, '')
}

// How long a play-once card takes, in milliseconds, or null for a scene that loops.
export function onceMs(svg: string): number | null {
  const m = svg.match(/<svg\b[^>]*\sdata-once="([\d.]+)"/)
  return m ? Number(m[1]) * 1000 : null
}
