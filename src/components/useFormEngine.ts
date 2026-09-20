import { useCallback, useMemo, useState } from "react"
import { createFormState, resetForm, setFormValue, validateForm, type FormMode, type FormState } from "../core/formEngine"
import type { EntityName } from "../core/schema"
import { useTranslation } from "../i18n"

export function useFormEngine<T extends Record<string, unknown>>(entity: EntityName, defaults: T, mode: FormMode = "create") {
  const { t } = useTranslation()
  const [state, setState] = useState<FormState>(() => createFormState(entity, mode, defaults))
  const setValues = useCallback((next: T | ((current: T) => T)) => setState((current) => {
    const values = typeof next === "function" ? (next as (value: T) => T)(current.values as T) : next
    return Object.keys(values).reduce((result, key) => setFormValue(result, key, values[key]), { ...current, values: { ...current.values } })
  }), [])
  const setValue = useCallback((field: string, value: unknown) => setState((current) => setFormValue(current, field, value)), [])
  const setErrors = useCallback((errors: Record<string, string>) => setState((current) => ({ ...current, errors })), [])
  const load = useCallback((values: T, nextMode: FormMode) => setState(createFormState(entity, nextMode, values)), [entity])
  const commit = useCallback((values: T) => setState((current) => ({ ...createFormState(entity, current.mode, values), errors: {}, submitting: false })), [entity])
  const reset = useCallback(() => setState((current) => resetForm(current)), [])
  const validate = useCallback(() => {
    const errors = validateForm(entity, state, t.messages.required)
    setState((current) => ({ ...current, errors }))
    return errors
  }, [entity, state, t])
  const form = state.values as T
  return useMemo(() => ({ state, form, setValues, setValue, setErrors, load, commit, reset, validate }), [state, form, setValues, setValue, setErrors, load, commit, reset, validate])
}
