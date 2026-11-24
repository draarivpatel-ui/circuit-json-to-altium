import type { AltiumBinaryPcbDoc } from "altiumts"

export function getCopperStackEntries(document: AltiumBinaryPcbDoc) {
  return (document.board?.layerStack.entries ?? []).filter((entry) => {
    const layerId = Number(entry.layerId)
    return (layerId >= 16777217 && layerId <= 16777247) || layerId === 16842751
  })
}
