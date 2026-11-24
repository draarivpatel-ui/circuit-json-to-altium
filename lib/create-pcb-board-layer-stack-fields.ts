import {
  asPositiveNumber,
  asString,
  byType,
  formatMil,
  isCircuitElement,
  MILLIMETERS_TO_MILS,
} from "./format"
import type { CircuitElement } from "./types"

const MAX_COPPER_LAYERS = 32
const DEFAULT_BOARD_THICKNESS_MM = 1.6
const NOMINAL_COPPER_THICKNESS_MM = 0.035
const copperPrimitiveTypes = new Set([
  "pcb_trace",
  "pcb_via",
  "pcb_smtpad",
  "pcb_plated_hole",
  "pcb_copper_pour",
  "pcb_copper_text",
])

const legacyLayerNames = [
  "Top Layer",
  ...Array.from({ length: 30 }, (_, index) => `Mid-Layer ${index + 1}`),
  "Bottom Layer",
  "Top Overlay",
  "Bottom Overlay",
  "Top Paste",
  "Bottom Paste",
  "Top Solder",
  "Bottom Solder",
  ...Array.from({ length: 16 }, (_, index) => `Internal Plane ${index + 1}`),
  "Drill Guide",
  "Keep-Out Layer",
  ...Array.from({ length: 16 }, (_, index) => `Mechanical ${index + 1}`),
  "Drill Drawing",
  "Multi-Layer",
  "Connections",
  "Background",
  "DRC Error Markers",
  "Selections",
  "Visible Grid 1",
  "Visible Grid 2",
  "Pad Holes",
  "Via Holes",
]

function getRequiredCopperLayerCount(circuitJson: CircuitElement[]): number {
  let required = 1
  const readLayer = (value: unknown) => {
    const layer = asString(value).toLowerCase()
    if (layer === "bottom") required = Math.max(required, 2)
    const inner = /^inner([1-9]\d*)$/u.exec(layer)
    if (inner) required = Math.max(required, Number(inner[1]) + 2)
  }
  const readLayers = (element: CircuitElement) => {
    readLayer(element.layer)
    readLayer(element.from_layer)
    readLayer(element.to_layer)
    if (Array.isArray(element.layers)) {
      for (const layer of element.layers) readLayer(layer)
    }
  }
  for (const element of circuitJson) {
    if (!copperPrimitiveTypes.has(asString(element.type))) continue
    readLayers(element)
    if (element.type === "pcb_trace" && Array.isArray(element.route)) {
      for (const point of element.route) {
        if (isCircuitElement(point)) readLayers(point)
      }
    }
  }
  return required
}

function getCopperLayerCount(circuitJson: CircuitElement[]): number {
  const declared = byType(circuitJson, "pcb_board")[0]?.num_layers
  const required = getRequiredCopperLayerCount(circuitJson)
  const count = declared === undefined ? Math.max(2, required) : declared
  if (
    typeof count !== "number" ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > MAX_COPPER_LAYERS
  ) {
    throw new RangeError(
      "Altium copper layer count must be an integer from 1 to 32",
    )
  }
  if (count < required) {
    throw new RangeError(
      `Board declares ${count} copper layers, but ${required} are needed by its PCB primitives`,
    )
  }
  return count
}

// IDs are document-local and deterministic, so identical inputs stay reproducible.
function stackGuid(index: number): string {
  return `{00000000-0000-4000-8000-${index.toString(16).padStart(12, "0").toUpperCase()}}`
}

export function createPcbBoardLayerStackFields(
  circuitJson: CircuitElement[],
): string[] {
  const count = getCopperLayerCount(circuitJson)
  const board = byType(circuitJson, "pcb_board")[0]
  const thickness = asPositiveNumber(
    board?.thickness,
    DEFAULT_BOARD_THICKNESS_MM,
  )
  // Circuit JSON supplies total thickness, not manufacturer stack dimensions.
  // Use nominal copper and equal dielectric gaps; keep both positive on thin boards.
  const copperThickness = Math.min(
    NOMINAL_COPPER_THICKNESS_MM,
    thickness / (2 * count),
  )
  const dielectricThickness =
    (thickness - count * copperThickness) / Math.max(1, count - 1)
  const copperMil = formatMil(copperThickness * MILLIMETERS_TO_MILS)
  const dielectricMil = formatMil(dielectricThickness * MILLIMETERS_TO_MILS)
  const copperIds =
    count === 1
      ? [1]
      : [1, ...Array.from({ length: count - 2 }, (_, index) => index + 2), 32]
  const masterId = stackGuid(1)
  const subStackId = stackGuid(2)
  const fields = [
    ...legacyLayerNames.map((name, index) => `LAYER${index + 1}NAME=${name}`),
    "LAYERMASTERSTACK_V8STYLE=0",
    `LAYERMASTERSTACK_V8ID=${masterId}`,
    "LAYERMASTERSTACK_V8NAME=Master layer stack",
    "LAYERMASTERSTACK_V8SHOWTOPDIELECTRIC=FALSE",
    "LAYERMASTERSTACK_V8SHOWBOTTOMDIELECTRIC=FALSE",
    "LAYERMASTERSTACK_V8ISFLEX=FALSE",
    `LAYERSUBSTACK_V8_0ID=${subStackId}`,
    "LAYERSUBSTACK_V8_0NAME=Board Layer Stack",
    "LAYERSUBSTACK_V8_0SHOWTOPDIELECTRIC=FALSE",
    "LAYERSUBSTACK_V8_0SHOWBOTTOMDIELECTRIC=FALSE",
    "LAYERSUBSTACK_V8_0ISFLEX=FALSE",
    "LAYERSUBSTACK_V8_0SERVICE=FALSE",
    "LAYERSUBSTACK_V8_0USEDBYPRIMS=FALSE",
    "LAYERSUBSTACK_V8_0TYPE=1",
  ]

  for (let legacyId = 1; legacyId <= MAX_COPPER_LAYERS; legacyId++) {
    const position = copperIds.indexOf(legacyId)
    fields.push(
      `LAYER${legacyId}PREV=${position < 0 ? 0 : (copperIds[position - 1] ?? 0)}`,
      `LAYER${legacyId}NEXT=${position < 0 ? 0 : (copperIds[position + 1] ?? 0)}`,
    )
    if (position < 0) continue
    fields.push(`LAYER${legacyId}COPTHICK=${copperMil}`)
    if (position < count - 1 || count === 1) {
      fields.push(
        `LAYER${legacyId}DIELHEIGHT=${dielectricMil}`,
        `LAYER${legacyId}DIELTYPE=0`,
      )
    }
  }

  let stackIndex = 0
  const addLayer = (
    name: string,
    nativeLayerId: number,
    properties: string[],
  ) => {
    const prefix = `LAYER_V8_${stackIndex}`
    fields.push(
      `${prefix}ID=${stackGuid(stackIndex + 3)}`,
      `${prefix}NAME=${name}`,
      `${prefix}LAYERID=${nativeLayerId}`,
      `${prefix}_${subStackId}CONTEXT=0`,
      `${prefix}_${subStackId}USEDBYPRIMS=FALSE`,
      ...properties.map((property) => `${prefix}${property}`),
    )
    stackIndex++
  }
  for (const [position, legacyId] of copperIds.entries()) {
    addLayer(
      legacyLayerNames[legacyId - 1]!,
      legacyId === 32 ? 16842751 : 16777216 + legacyId,
      [
        "USEDBYPRIMS=TRUE",
        `COPTHICK=${copperMil}`,
        `COMPONENTPLACEMENT=${legacyId === 1 ? 1 : legacyId === 32 ? 2 : 0}`,
      ],
    )
    if (position < count - 1 || count === 1) {
      addLayer(`Dielectric ${position + 1}`, 17039361 + position, [
        "USEDBYPRIMS=FALSE",
        "DIELTYPE=0",
        `DIELHEIGHT=${dielectricMil}`,
      ])
    }
  }
  return fields
}
