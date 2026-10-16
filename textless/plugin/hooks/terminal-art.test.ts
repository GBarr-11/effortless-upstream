import { describe, expect, test } from 'claude-code/testing'
import { sceneCells } from './terminal-art'

// A frame of two groups that swap on a discrete opacity clock, and a block that steps right with a translate.
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="8" viewBox="0 0 16 8">
<g><animate attributeName="opacity" calcMode="discrete" values="1;0" keyTimes="0;0.5" dur="2s" repeatCount="indefinite"/><rect x="0" y="0" width="4" height="4" fill="#ff0000"/></g>
<g opacity="0"><animate attributeName="opacity" calcMode="discrete" values="0;1" keyTimes="0;0.5" dur="2s" repeatCount="indefinite"/><rect x="0" y="0" width="4" height="4" fill="#00ff00"/></g>
<g><animateTransform attributeName="transform" type="translate" calcMode="discrete" values="0 0;8 0" keyTimes="0;0.5" dur="2s" repeatCount="indefinite"/><rect x="0" y="4" width="4" height="4" fill="#0000ff"/></g>
</svg>`

describe('terminal art plays', () => {
  test('the same scene read at later times gives other frames, and loops', () => {
    const a = sceneCells(SVG, 16, 4, 0.2)
    const b = sceneCells(SVG, 16, 4, 1.2)
    const c = sceneCells(SVG, 16, 4, 2.2)
    expect(a).not.toBeNull()
    expect(a!.cells).not.toBe(b!.cells)
    expect(a!.cells).toBe(c!.cells)
  })
})
