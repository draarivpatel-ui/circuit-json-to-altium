import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import { board } from "./fixtures"
import { getCopperStackEntries } from "./fixtures/pcb-copper-stack"

test.failing("preserves declared copper layer order and native IDs in binary PCB documents", () => {
  for (const count of [4, 2, 6, 8, 10, 32]) {
    const converter = new CircuitJsonToAltiumConverter([
      board({ num_layers: count }),
    ])
    converter.runUntilFinished()
    const document = parseAltiumBinaryPcbDoc(converter.getOutput().pcb.content)
    const names = [
      "Top Layer",
      ...Array.from(
        { length: count - 2 },
        (_, index) => `Mid-Layer ${index + 1}`,
      ),
      "Bottom Layer",
    ]
    const layerIds = [
      "16777217",
      ...Array.from({ length: count - 2 }, (_, index) =>
        String(16777218 + index),
      ),
      "16842751",
    ]
    expect(getCopperStackEntries(document).map((entry) => entry.name)).toEqual(
      names,
    )
    expect(
      getCopperStackEntries(document).map((entry) => entry.layerId),
    ).toEqual(layerIds)

    const legacyIds = [
      1,
      ...Array.from({ length: count - 2 }, (_, index) => index + 2),
      32,
    ]
    for (const [index, id] of legacyIds.entries()) {
      expect(document.board?.get(`LAYER${id}NAME`)).toBe(names[index])
      expect(document.board?.get(`LAYER${id}PREV`)).toBe(
        String(legacyIds[index - 1] ?? 0),
      )
      expect(document.board?.get(`LAYER${id}NEXT`)).toBe(
        String(legacyIds[index + 1] ?? 0),
      )
    }
    expect(document.board?.get("LAYER33NAME")).toBe("Top Overlay")
    expect(document.board?.get("LAYER34NAME")).toBe("Bottom Overlay")
    expect(document.board?.get("LAYER74NAME")).toBe("Multi-Layer")
  }
})
