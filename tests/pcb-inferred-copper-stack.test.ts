import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import { board, type CircuitElement } from "./fixtures"
import { getCopperStackEntries } from "./fixtures/pcb-copper-stack"

test("infers missing board layer counts from tracks, copper pours, and via spans", () => {
  const cases: { elements: CircuitElement[]; count: number }[] = [
    { elements: [], count: 2 },
    {
      elements: [
        {
          type: "pcb_trace",
          pcb_trace_id: "trace",
          route: [
            { route_type: "wire", x: -2, y: 0, width: 0.2, layer: "inner8" },
            { route_type: "wire", x: 2, y: 0, width: 0.2, layer: "inner8" },
          ],
        },
      ],
      count: 10,
    },
    {
      elements: [
        {
          type: "pcb_copper_pour",
          pcb_copper_pour_id: "pour",
          layer: "inner2",
          shape: "rect",
          center: { x: 0, y: 0 },
          width: 4,
          height: 2,
        },
      ],
      count: 4,
    },
    {
      elements: [
        {
          type: "pcb_via",
          pcb_via_id: "via",
          x: 0,
          y: 0,
          outer_diameter: 0.6,
          hole_diameter: 0.3,
          layers: ["top", "inner2"],
          from_layer: "top",
          to_layer: "inner2",
        },
      ],
      count: 4,
    },
  ]

  for (const { elements, count } of cases) {
    const converter = new CircuitJsonToAltiumConverter([board(), ...elements])
    converter.runUntilFinished()
    const document = parseAltiumBinaryPcbDoc(converter.getOutput().pcb.content)
    expect(getCopperStackEntries(document)).toHaveLength(count)
    expect(getCopperStackEntries(document).at(-1)?.name).toBe("Bottom Layer")
  }
})
