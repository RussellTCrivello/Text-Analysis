import test from "node:test"
import assert from "node:assert/strict"
import { defaultTableLayout, normalizeTableLayout, resetTableLayout } from "./tableLayout"

test("table layouts expose every schema field and default list fields", () => {
  const layout = defaultTableLayout("sources")
  assert.ok(layout.order.includes("name"))
  assert.ok(layout.hidden.includes("note"))
  assert.equal(layout.entity, "sources")
})

test("schema changes repair invalid saved layout data", () => {
  const layout = normalizeTableLayout("contents", {
    order: ["unknown", "title", "title"],
    hidden: ["unknown", "note"],
    pinned: ["unknown", "title"],
    widths: { unknown: 20, title: 240 },
    sort: [{ field: "unknown", direction: "asc" }, { field: "title", direction: "desc" }],
    filters: { unknown: "x", title: "brief" },
  })
  assert.deepEqual(layout.order.slice(0, 2), ["title", "id"])
  assert.deepEqual(layout.pinned, ["title"])
  assert.deepEqual(layout.widths, { title: 240 })
  assert.deepEqual(layout.sort, [{ field: "title", direction: "desc" }])
  assert.deepEqual(layout.filters, { title: "brief" })
})

test("reset removes custom layout state", () => {
  const layout = resetTableLayout("analyses")
  assert.deepEqual(layout.pinned, [])
  assert.deepEqual(layout.sort, [])
  assert.deepEqual(layout.filters, {})
})
