import { expect, test } from "bun:test"
import { board, extractArchive } from "./fixtures"

test.failing("skips every reserved suffix and remains deterministic for repeated net names", async () => {
  const input = [
    board(),
    ...["DATA", "DATA", "DATA", "DATA-2", "DATA-3"].map((name, index) => ({
      type: "source_trace",
      source_trace_id: `trace-${index}`,
      name,
      connected_source_port_ids: [],
      connected_source_net_ids: [],
    })),
  ]
  const { pcb, pcbBytes } = await extractArchive(input)
  expect(pcb.nets.map((net) => net.name)).toEqual([
    "DATA",
    "DATA-4",
    "DATA-5",
    "DATA-2",
    "DATA-3",
  ])
  expect(
    Buffer.from((await extractArchive(input)).pcbBytes).equals(
      Buffer.from(pcbBytes),
    ),
  ).toBe(true)
})
