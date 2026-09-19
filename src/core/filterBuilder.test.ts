import test from "node:test"
import assert from "node:assert/strict"
import { applyFilterGroups, filterFields, validateFilter } from "./filterBuilder"

test("filter builder derives fields from schema and combines groups", () => {
  assert.ok(filterFields("sources").some((field) => field.key === "name"))
  const rows = [{ name: "Reuters", country: "UK" }, { name: "AP", country: "US" }]
  const result = applyFilterGroups(rows, [{ logic: "and", conditions: [{ field: "name", operator: "contains", value: "reut" }] }])
  assert.deepEqual(result, [rows[0]])
})

test("filter validation rejects unknown fields and missing values", () => {
  assert.equal(validateFilter("contents", { field: "nope", operator: "equals", value: "x" }) !== null, true)
  assert.equal(validateFilter("contents", { field: "title", operator: "equals" }) !== null, true)
  assert.equal(validateFilter("contents", { field: "title", operator: "isEmpty" }), null)
})
