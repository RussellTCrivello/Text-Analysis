import { useCallback, useMemo, useState } from "react"
import { createFormState, resetForm, setFormValue, validateForm, type FormMode, type FormState } from "../core/formEngine"
import type { EntityName } from "../core/schema"

export function useFormEngine<T extends Record<string, unknown>>(entity: EntityName, defaults: T, mode: FormMode = "create") {
  const [state, setState] = useState<FormState>(() => createFormState(entity, mode, defaults))
  const setValues = useCallback((next: T | ((current: T) => T)) => setState((current) => {
    const values = typeof next === "function" ? (next as (value: T) => T)(current.values as T) : next
    return Object.keys(values).reduce((result, key) => setFormValue(result, key, values[key]), { ...current, values: { ...current.values } })
  }), [])
  const setValue = useCallback((field: string, value: unknown) => setState((current) => setFormValue(current, field, value)), [])
  const reset = useCallback(() => setState((current) => resetForm(current)), [])
  const validate = useCallback(() => {
    const errors = validateForm(entity, state)
    setState((current) => ({ ...current, errors }))
    return errors
  }, [entity, state])
  const form = state.values as T
  return useMemo(() => ({ state, form, setValues, setValue, reset, validate }), [state, form, setValues, setValue, reset, validate])
}
