import { expect, test } from "bun:test"
import type { AltiumTextRecord } from "altiumts"
import { board, extractArchive } from "./fixtures"

test.failing("exports copper text on top, bottom and inner layers with Unicode, rotation and mirroring", async () => {
  const { pcb } = await extractArchive([
    board({ num_layers: 4 }),
    ...["top", "bottom", "inner1"].map((layer, i) => ({
      type: "pcb_copper_text",
      pcb_copper_text_id: `text-${i}`,
      text: `µV ${i}`,
      anchor_position: { x: i, y: 0 },
      anchor_alignment: "center",
      font_size: 1,
      ccw_rotation: 45,
      layer,
    })),
  ])
  const texts = pcb.getRecordsByKind("Text") as AltiumTextRecord[]
  expect(texts.map((text) => text.text)).toEqual(["µV 0", "µV 1", "µV 2"])
  expect(texts.map((text) => text.layer)).toEqual([
    "TOP",
    "BOTTOM",
    "MID-LAYER1",
  ])
  expect(texts.map((text) => text.getBoolean("MIRROR"))).toEqual([
    false,
    true,
    false,
  ])
  expect(texts.map((text) => text.getNumber("ROTATION"))).toEqual([45, 45, 45])
})
