import test from "node:test"
import assert from "node:assert/strict"
import { createFormState, defaultFormLayout, formFields, resetForm, setFormValue, validateForm } from "./formEngine"

test("form definitions derive from schema metadata", () => {
  const fields = formFields("contents")
  assert.ok(fields.some((field) => field.key === "title"))
  assert.equal(fields.some((field) => field.key === "id"), false)
  assert.deepEqual(defaultFormLayout("sources").entity, "sources")
})

test("form state centrally handles values, dirty, validation and reset", () => {
  let state = createFormState("sources", "create", { name: "" })
  assert.ok(validateForm("sources", state).name)
  state = setFormValue(state, "name", "Brief")
  assert.equal(state.dirty, true)
  state = resetForm(state)
  assert.equal(state.values.name, "")
  assert.equal(state.dirty, false)
})
