import test from "node:test"
import assert from "node:assert/strict"
import { createFormState, defaultFormLayout, formFields, normalizeFormLayout, orderedVisibleFormFields, resetForm, setFormValue, validateForm } from "./formEngine"

test("form definitions derive from schema metadata", () => {
  const fields = formFields("contents")
  assert.ok(fields.some((field) => field.key === "title"))
  assert.equal(fields.some((field) => field.key === "id"), false)
  assert.deepEqual(defaultFormLayout("sources").entity, "sources")
  const repaired = normalizeFormLayout("sources", { order: ["unknown", "name", "name"], hidden: ["unknown", "note"] })
  assert.equal(repaired.order[0], "name")
  assert.equal(repaired.order.includes("unknown"), false)
  assert.deepEqual(repaired.hidden, ["note"])
})

test("ordered visible form fields are unique, schema-safe, and exclude specialized controls", () => {
  const layout = normalizeFormLayout("sources", { order: ["note", "name", "name", "unknown"], hidden: ["city"] })
  const fields = orderedVisibleFormFields("sources", layout, ["type", "importance"])
  const keys = fields.map((field) => field.key)
  assert.equal(keys[0], "note")
  assert.equal(keys.includes("unknown"), false)
  assert.equal(keys.includes("city"), false)
  assert.equal(new Set(keys).size, keys.length)
  assert.equal(keys.includes("type"), false)
})

test("form state centrally handles values, dirty, validation and reset", () => {
  let state = createFormState("sources", "create", { name: "" })
  assert.ok(validateForm("sources", state).name)
  state = setFormValue(state, "name", "Brief")
  assert.equal(state.dirty, true)
  state = setFormValue(state, "name", "")
  assert.equal(state.dirty, false)
  state = setFormValue(state, "name", "Brief")
  assert.equal(state.dirty, true)
  state = resetForm(state)
  assert.equal(state.values.name, "")
  assert.equal(state.dirty, false)
})
