import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import { board } from "./fixtures"
import { getCopperStackEntries } from "./fixtures/pcb-copper-stack"

test("preserves total board thickness in the native copper and dielectric stack", () => {
  for (const [numLayers, thickness] of [
    [1, 0.8],
    [2, 1.6],
    [4, 1.2],
    [8, 0.8],
    [32, 0.1],
  ] as const) {
    const converter = new CircuitJsonToAltiumConverter([
      board({ num_layers: numLayers, thickness }),
    ])
    converter.runUntilFinished()
    const document = parseAltiumBinaryPcbDoc(converter.getOutput().pcb.content)
    const entries = document.board?.layerStack.entries ?? []
    const copper = getCopperStackEntries(document)
    const dielectric = entries.filter((entry) => entry.dielectricHeight)
    expect(copper).toHaveLength(numLayers)
    expect(dielectric).toHaveLength(Math.max(1, numLayers - 1))
    const total = entries.reduce(
      (sum, entry) =>
        sum +
        (entry.copperThickness?.toMillimeters() ?? 0) +
        (entry.dielectricHeight?.toMillimeters() ?? 0),
      0,
    )
    expect(total).toBeCloseTo(thickness, 4)
    expect(
      copper.every(
        (entry) => (entry.copperThickness?.toMillimeters() ?? 0) > 0,
      ),
    ).toBe(true)
    expect(document.board?.layerStack.subStacks).toHaveLength(1)
  }
})
