import test from "node:test"
import assert from "node:assert/strict"
import { findLegacyColumns, migrateTablePreferences, sanitizeImportedFields } from "./frameworkMigration"

test("legacy table preferences migrate into schema-safe layouts", () => {
  const layout = migrateTablePreferences("sources", { visible: ["name"], widths: { name: 240 }, hidden: ["name", "unknown"] })
  assert.equal(layout.hidden.includes("name"), false)
  assert.equal(layout.widths.name, 240)
  assert.equal(layout.entity, "sources")
})

test("legacy duplicate columns are detectable before removal", () => {
  assert.deepEqual(findLegacyColumns("analyses", ["classification", "old_custom_field"]), ["classification"])
})

test("legacy imported payloads are limited to schema fields", () => {
  assert.deepEqual(sanitizeImportedFields("contents", { title: "Brief", sources_id: "src-1", unsafe: "drop" }), { title: "Brief", sources_id: "src-1" })
})
