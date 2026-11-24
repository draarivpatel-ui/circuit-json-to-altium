import { expect, test } from "bun:test"
import { type CircuitElement, extractArchive } from "./fixtures"

async function scenario() {
  const elements = (await Bun.file(
    new URL("./assets/nema17.circuit.json", import.meta.url),
  ).json()) as CircuitElement[]
  const nets = elements.filter((element) => element.type === "source_net")
  // Naming-only variant; all copper, ports and source IDs are retained.
  for (const [i, name] of ["DATA", "DATA", "DATA-2"].entries())
    nets[i]!.name = name
  return extractArchive(elements)
}

test("full real-board net names remain unique when a suffix is already used", async () => {
  const { pcb } = await scenario()
  const names = pcb.nets.map((net) => net.name)
  expect(new Set(names).size).toBe(names.length)
  expect(names.slice(0, 3)).toEqual(["DATA", "DATA-3", "DATA-2"])
}, 30_000)

test("records the actual exported net names and uniqueness", async () => {
  const { pcb } = await scenario()
  const names = pcb.nets.map((net) => net.name)
  expect({
    renamedNets: names.slice(0, 3),
    total: names.length,
    unique: new Set(names).size,
  }).toMatchInlineSnapshot(`
    {
      "renamedNets": [
        "DATA",
        "DATA-3",
        "DATA-2",
      ],
      "total": 82,
      "unique": 82,
    }
  `)
}, 30_000)
