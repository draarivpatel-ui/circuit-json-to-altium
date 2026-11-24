import { expect, test } from "bun:test"
import { type CircuitElement, extractArchive } from "./fixtures"

async function scenario(kind: "root" | "directory") {
  const elements = (await Bun.file(
    new URL("./assets/nema17.circuit.json", import.meta.url),
  ).json()) as CircuitElement[]
  const sheets = elements.filter(
    (element) => element.type === "schematic_sheet",
  )
  sheets[0]!.source_filename =
    kind === "root" ? "nema17.SchDoc" : "Controller/Power.SchDoc"
  if (kind === "directory") sheets[1]!.source_filename = "Motor/Power.SchDoc"
  return {
    ...(await extractArchive(elements, "nema17")),
    expectedDocuments: sheets.length + 1,
  }
}

for (const kind of ["root", "directory"] as const) {
  test.failing(`preserves all real-board schematic files after ${kind} name collision`, async () => {
    const result = await scenario(kind)
    expect(result.schematicSources).toHaveLength(result.expectedDocuments)
    expect(result.schematics.flatMap((sheet) => sheet.components)).toHaveLength(
      115,
    )
    const root =
      result.schematics[
        result.schematicSources.findIndex(
          (file) => file.filename === "nema17.SchDoc",
        )
      ]!
    expect(root.sheetLinks).toHaveLength(10)
  }, 30_000)
}

test("records the actual files and surviving schematic components", async () => {
  const result = await scenario("directory")
  expect({
    files: result.schematicSources.map((file) => file.filename),
    componentCount: result.schematics.flatMap((sheet) => sheet.components)
      .length,
  }).toMatchInlineSnapshot(`
    {
      "componentCount": 101,
      "files": [
        "Power.SchDoc",
        "nema17-03.SchDoc",
        "nema17-04.SchDoc",
        "nema17-05.SchDoc",
        "nema17-06.SchDoc",
        "nema17-07.SchDoc",
        "nema17-08.SchDoc",
        "nema17-09.SchDoc",
        "nema17-10.SchDoc",
        "nema17.SchDoc",
      ],
    }
  `)
}, 30_000)
