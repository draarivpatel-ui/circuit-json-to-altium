import { expect, test } from "bun:test"
import { CircuitJsonToAltiumConverter } from "../lib"
import { board } from "./fixtures"

test("rejects invalid or contradictory declared copper layer counts", () => {
  for (const numLayers of [0, 33, 2.5, Number.NaN]) {
    const converter = new CircuitJsonToAltiumConverter([
      board({ num_layers: numLayers }),
    ])
    expect(() => converter.runUntilFinished()).toThrow(
      "Altium copper layer count must be an integer from 1 to 32",
    )
  }
  const converter = new CircuitJsonToAltiumConverter([
    board({ num_layers: 2 }),
    {
      type: "pcb_trace",
      pcb_trace_id: "inner-trace",
      route: [
        { route_type: "wire", layer: "inner2", x: -2, y: 0, width: 0.2 },
        { route_type: "wire", layer: "inner2", x: 2, y: 0, width: 0.2 },
      ],
    },
  ])
  expect(() => converter.runUntilFinished()).toThrow(
    "Board declares 2 copper layers, but 4 are needed",
  )
})
