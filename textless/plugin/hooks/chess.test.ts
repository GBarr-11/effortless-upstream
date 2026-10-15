import { describe, expect, mock, test } from 'claude-code/testing'
import { describe as say, legalMoves, outcome, parseFen, perft, play, squareOf, START, toFen } from './chess-rules'

// The usual perft counts: any mistake in castling, en passant, promotion or pins changes them.
describe('chess rules', () => {
  test('start position', () => {
    const p = parseFen(START)
    expect(perft(p, 1)).toBe(20)
    expect(perft(p, 2)).toBe(400)
    expect(perft(p, 3)).toBe(8902)
  })
  test('kiwipete: castling, pins, en passant', () => {
    const p = parseFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1')
    expect(perft(p, 1)).toBe(48)
    expect(perft(p, 2)).toBe(2039)
  })
  test('endgame with en passant checks', () => {
    expect(perft(parseFen('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1'), 3)).toBe(2812)
  })
  test('promotions', () => {
    expect(perft(parseFen('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1'), 2)).toBe(264)
  })
  test('fen round trip and words', () => {
    const p = parseFen(START)
    expect(toFen(p)).toBe(START)
    const e4 = { from: squareOf('e2'), to: squareOf('e4') }
    expect(say(p, e4)).toBe('pawn e2 to e4')
    expect(toFen(play(p, e4))).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1')
  })
  test('fool\'s mate is checkmate', () => {
    let p = parseFen(START)
    for (const [a, b] of [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']]) p = play(p, { from: squareOf(a), to: squareOf(b) })
    expect(legalMoves(p).length).toBe(0)
    expect(outcome(p)).toBe('checkmate')
  })
})

function fakeHost(on: any) {
  const store = new Map<string, unknown>()
  const sent: { text: string; context: string[] }[] = []
  const toasts: string[] = []
  on('env.get', () => ({ value: '' }))
  on('fs.list', () => ({ value: [] }))
  on('fs.read', () => ({ value: '' }))
  on('fs.write', () => ({ value: undefined }))
  on('store.get', ($: any, e: any) => ({ value: store.get(e.key) ?? null }))
  on('store.set', ($: any, e: any) => { store.set(e.key, e.value); return { value: undefined } })
  on('ui.invalidate', async ($: any, e: any, next: any) => next(e).catch(() => ({ value: undefined })))
  on('ui.toast', ($: any, e: any) => { toasts.push(String(e.text ?? e.message ?? '')); return { value: undefined } })
  on('prompt.submit', ($: any, e: any) => { sent.push({ text: e.text, context: [...(e.context ?? [])] }); return { text: e.text } })
  on('turn.complete', () => ({ text: '' }))
  on('http.fetch', () => ({ value: { status: 404, ok: false, headers: {}, text: '' } }))
  on('ui.render', (h: any, e: any) => h.ui.resolve(e).Box({ key: 'core' }))
  return { sent, toasts }
}

const sq = (name: string) => `chess-${squareOf(name)}`
const answer = (e: any, text: string) => e.turn.complete({ answer: text, reason: 'answer', durationMs: 3000, isAborted: false, turnId: 't' })

describe('chess with Claude', () => {
  test('a click move goes to Claude with the position, and its MOVE line is played back', async ($, on) => {
    const host = fakeHost(on)
    mock.clock(on)
    const e: any = $
    const band: any = await e.ui.mount({ plugin: 'textless', surface: 'desktop', component: 'AbovePrompt', props: {} })
    expect(await band.find({ key: 'chess' })).toBeUndefined()
    const r = await e.command.run({ command: 'chess', args: '' })
    expect(String(r?.text ?? '')).toContain('New game')
    expect(await band.find({ key: 'chess' })).toBeDefined()
    expect(await band.find({ key: 'core' })).toBeDefined()

    // A black piece cannot be picked, and an illegal target does nothing.
    await band.press({ key: sq('e7') })
    await band.press({ key: sq('e2') })
    await band.press({ key: sq('e5') })
    expect(host.sent.length).toBe(0)
    await band.press({ key: sq('e4') })
    expect(host.sent.length).toBe(1)
    expect(host.sent[0].text.split('\n')[0]).toBe('♟ I play pawn e2 to e4. Your move.')
    expect(host.sent[0].text).toContain('Your legal moves:')
    expect(host.sent[0].text).toContain('e7e5')
    // The chat shows only the first line; the position under the marker is for Claude.
    const msg: any = await e.ui.mount({ plugin: 'textless', surface: 'desktop', component: 'UserMessage', props: { text: host.sent[0].text } })
    expect(msg).toBeDefined()
    expect(await band.find({ text: '♟ Chess with Claude · Claude is thinking…' })).toBeDefined()

    // Clicks while Claude thinks are ignored.
    await band.press({ key: sq('d2') })
    await band.press({ key: sq('d4') })
    expect(host.sent.length).toBe(1)

    await answer(e, 'The classic reply.\nMOVE: e7e5')
    expect(await band.find({ text: '♟ Chess with Claude · Your move: click a piece, then where it goes.' })).toBeDefined()
    // e5 now holds black's pawn, so the white pawn on e4 cannot move.
    await band.press({ key: sq('e4') })
    await band.press({ key: sq('e5') })
    expect(host.sent.length).toBe(1)
  })

  test('an illegal answer is asked again once, then a legal move is played for Claude', async ($, on) => {
    const host = fakeHost(on)
    mock.clock(on)
    const e: any = $
    const band: any = await e.ui.mount({ plugin: 'textless', surface: 'desktop', component: 'AbovePrompt', props: {} })
    await e.command.run({ command: 'chess', args: 'new' })
    await band.press({ key: sq('g1') })
    await band.press({ key: sq('f3') })
    expect(host.sent[0].text).toContain('g8f6')
    expect(host.sent[0].text.split('\n')[0]).toBe('♟ I play knight g1 to f3. Your move.')
    await answer(e, 'Queen to the moon. MOVE: d8h1')
    expect(host.sent.length).toBe(2)
    expect(host.sent[1].text).toContain('not legal')
    expect(host.sent[1].text).toContain('Your legal moves:')
    await answer(e, 'No move line at all.')
    expect(host.sent.length).toBe(2)
    expect(await band.find({ text: '♟ Chess with Claude · Your move: click a piece, then where it goes.' })).toBeDefined()

    const r = await e.command.run({ command: 'chess', args: 'end' })
    expect(String(r?.text ?? '')).toContain('closed')
    expect(await band.find({ key: 'chess' })).toBeUndefined()
  })
})
