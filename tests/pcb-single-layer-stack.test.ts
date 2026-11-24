import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import { board, expectValidPcb } from "./fixtures"
import { getCopperStackEntries } from "./fixtures/pcb-copper-stack"

test("keeps a single copper layer when the board also has bottom silkscreen", () => {
  const converter = new CircuitJsonToAltiumConverter([
    board({ num_layers: 1, thickness: 0.8 }),
    {
      type: "pcb_silkscreen_path",
      pcb_silkscreen_path_id: "bottom-marking",
      layer: "bottom",
      stroke_width: 0.2,
      route: [
        { x: -2, y: 0 },
        { x: 2, y: 0 },
      ],
    },
  ])
  converter.runUntilFinished()
  const document = parseAltiumBinaryPcbDoc(converter.getOutput().pcb.content)
  expect(getCopperStackEntries(document).map((entry) => entry.name)).toEqual([
    "Top Layer",
  ])
  expect(
    document.tracks.some((track) => track.get("LAYER") === "BOTTOMOVERLAY"),
  ).toBe(true)
  expectValidPcb(document)
})
