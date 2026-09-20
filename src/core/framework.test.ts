import test from "node:test"
import assert from "node:assert/strict"
import { allDocTypes, displayValue, validateAllDocTypes } from "./framework"

test("metadata covers every application entity and surface", () => {
  const types = allDocTypes()
  assert.deepEqual(types.map((t) => t.name), ["sources", "contents", "analyses"])
  for (const type of types) {
    assert.ok(type.fields.length > 0)
    assert.ok(type.defaults.list.length > 0)
    assert.ok(type.defaults.form.length > 0)
    assert.ok(type.defaults.filter.length > 0)
    assert.ok(type.defaults.export.length > 0)
  }
  assert.deepEqual(validateAllDocTypes(), [])
})

test("relationship display never changes the stored identifier", () => {
  const field = allDocTypes().find((t) => t.name === "contents")!.fields.find((f) => f.key === "sources_id")!
  assert.equal(displayValue("src-1", field, { name: "Reuters" }), "Reuters")
  assert.equal(displayValue("src-1", field), "src-1")
})
