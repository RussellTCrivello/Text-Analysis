import type { ValidationIssue } from "../core/validation"
import type { TranslationShape } from "./locales/en"

/**
 * Core validation messages are plain-English diagnostics with embedded
 * values (limits, ids, percentages). This display layer rebuilds each one
 * from its stable `code` plus the active locale's templates, so non-English
 * sessions never see English wording — the raw message is only the
 * fallback when a code is unrecognised.
 */
export function formatValidationIssue(
  issue: ValidationIssue,
  t: TranslationShape,
): string {
  const label = (t.fields as Record<string, string>)[issue.field] ?? issue.field
  const v = t.messages.validation
  const fill = (template: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce(
      (s, [k, val]) => s.split(`{${k}}`).join(val),
      template,
    )

  switch (issue.code) {
    case "required":
      return fill(v.required, { f: label })
    case "minLength": {
      const n = issue.message.match(/at least (\d+)/)?.[1] ?? ""
      return fill(v.minLength, { f: label, n })
    }
    case "url":
      return fill(v.url, { f: label })
    case "range": {
      if (/was read as a percentage/i.test(issue.message)) {
        const m = issue.message.match(/"(.*)" was read as a percentage \(([\d.]+)%\)/)
        return fill(v.percentWarning, { f: label, v: m?.[1] ?? "", p: m?.[2] ?? "" })
      }
      const between = issue.message.match(/between (-?[\d.]+) and (-?[\d.]+)/)
      if (between) return fill(v.rangeBetween, { f: label, min: between[1], max: between[2] })
      return fill(v.rangeNumber, { f: label })
    }
    case "date":
      return fill(v.date, { f: label })
    case "duplicate": {
      const id = issue.message.match(/record (.+)$/)?.[1] ?? ""
      return fill(v.duplicate, { f: label, id })
    }
    case "unknownRef":
      return fill(v.unknownRef, { f: label })
    case "exactDuplicate": {
      const id = issue.message.match(/ID (.+)\)?$/)?.[1] ?? ""
      return fill(v.exactDuplicate, { id })
    }
    default: {
      // Fallback for unrecognised codes: rewrite a leading raw field key.
      if (label !== issue.field && issue.message.startsWith(issue.field + " ")) {
        return label + issue.message.slice(issue.field.length)
      }
      return issue.message
    }
  }
}
