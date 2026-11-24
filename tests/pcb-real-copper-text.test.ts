import { expect, test } from "bun:test"
import { AltiumTextRecord, serializeAltiumPcbToSvg } from "altiumts"
import { pcb_copper_text } from "circuit-json"
import { type CircuitElement, extractArchive } from "./fixtures"

async function scenario() {
  const elements = (await Bun.file(
    new URL("./assets/nema17.circuit.json", import.meta.url),
  ).json()) as CircuitElement[]
  const label = elements.find(
    (element) =>
      element.type === "pcb_silkscreen_text" && element.text === "Y1",
  )!
  // Move the real Y1 label to copper without changing its placement or size.
  elements[elements.indexOf(label)] = pcb_copper_text.parse({
    ...label,
    type: "pcb_copper_text",
    pcb_copper_text_id: "real-y1-copper-label",
  })
  return extractArchive(elements)
}

test("preserves the real Y1 label when its layer is changed to copper", async () => {
  const { pcb } = await scenario()
  expect(
    pcb
      .getRecordsByKind("Text")
      .filter(
        (text) =>
          text instanceof AltiumTextRecord &&
          text.text === "Y1" &&
          text.layer === "TOP",
      ),
  ).toHaveLength(1)
}, 30_000)

test("snapshots copper text around the real Y1 footprint", async () => {
  const { pcb } = await scenario()
  const component = pcb.components.find(
    (record) => record.get("SOURCEDESIGNATOR") === "Y1",
  )!
  const x = component.getAltiumMeasurement("X")!.toMils()
  const y = component.getAltiumMeasurement("Y")!.toMils()
  await expect(
    serializeAltiumPcbToSvg(pcb, {
      width: 600,
      height: 420,
      layers: ["TOP"],
      componentIndices: [pcb.components.indexOf(component)],
      showBoardOutline: false,
      viewBox: { x: x - 125, y: y - 100, width: 250, height: 200 },
    }),
  ).toMatchSvgSnapshot(import.meta.path)
}, 30_000)
