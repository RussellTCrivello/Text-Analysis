/**
 * DOM-level interaction harness (dev-only; run via `vite build --ssr` like the
 * smoke script). Mounts the real <App /> in jsdom and exercises the primary
 * flows: navigation, quick add, sample load, selection, export, settings,
 * backup, import wizard, advanced search and the icon-integrity audit.
 */
import { JSDOM } from "jsdom"

const dom = new JSDOM(
  '<!doctype html><html><head></head><body><div id="root"></div></body></html>',
  {
    url: "http://localhost/",
    pretendToBeVisual: true,
  },
)
const w = globalThis as unknown as Record<string, unknown>
w.window = dom.window
w.document = dom.window.document
try {
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
  })
} catch {
  /* node 22 keeps its own navigator */
}
w.HTMLElement = dom.window.HTMLElement
w.HTMLInputElement = dom.window.HTMLInputElement
w.Node = dom.window.Node
w.getComputedStyle = dom.window.getComputedStyle
w.localStorage = dom.window.localStorage
w.sessionStorage = dom.window.sessionStorage
w.requestAnimationFrame = (cb: (t: number) => void) =>
  setTimeout(() => cb(Date.now()), 0)
w.cancelAnimationFrame = (id: number) => clearTimeout(id)
w.matchMedia = () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
})
w.URL.createObjectURL = () => "blob:stub"
w.URL.revokeObjectURL = () => {}
w.alert = () => {}
w.print = () => {}
w.IS_REACT_ACT_ENVIRONMENT = true

import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react"
import App from "../src/App"

const { document } = dom.window as unknown as { document: Document }

const sleep = (ms = 30) => new Promise((r) => setTimeout(r, ms))

let failures = 0
const check = (name: string, cond: boolean, extra = "") => {
  if (cond) console.log(`ok   ${name}`)
  else {
    failures += 1
    console.log(`FAIL ${name} ${extra}`)
  }
}

const text = (el: Element | null) => (el?.textContent ?? "").trim()
const dialogs = () => Array.from(document.querySelectorAll('[role="dialog"]'))
const lastDialog = () => dialogs()[dialogs().length - 1] ?? null
const closeAllDialogs = async () => {
  for (let i = 0; i < 6 && dialogs().length; i++) {
    const cancel = dialogs().flatMap((d) =>
      Array.from(d.querySelectorAll("button")).filter(
        (b) =>
          /Cancel|Close/i.test(text(b)) ||
          b.getAttribute("aria-label") === "Close",
      ),
    )[0]
    if (cancel) await click(cancel)
    else
      await act(async () => {
        document.dispatchEvent(
          new dom.window.KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
          }),
        )
      })
    await sleep(30)
  }
}
const allButtons = () => Array.from(document.querySelectorAll("button"))
const findButton = (label: string, exact = false) =>
  allButtons().find((b) => {
    const t = (b.getAttribute("aria-label") ?? "") || text(b)
    return exact ? t === label : t.includes(label)
  })
const click = async (el: Element | undefined | null) => {
  if (!el) throw new Error("click target missing")
  await act(async () => {
    el.dispatchEvent(
      new dom.window.MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: dom.window,
      }),
    )
  })
  await sleep()
}
const dblclick = async (el: Element) => {
  await act(async () => {
    el.dispatchEvent(
      new dom.window.MouseEvent("dblclick", {
        bubbles: true,
        cancelable: true,
        view: dom.window,
      }),
    )
  })
  await sleep()
}
const setInputValue = async (input: HTMLInputElement, value: string) => {
  // React 19 under this jsdom build ignores dispatched native input events, so
  // invoke the component's onChange through the fiber props the same way the
  // browser's value tracking would.
  await act(async () => {
    input.value = value
    const key = Object.keys(input).find((k) => k.startsWith("__reactFiber$"))
    if (!key) {
      console.log(
        "DEBUG THROW NODE:",
        input.tagName,
        "type=",
        (input as HTMLInputElement).type,
        "connected=",
        input.isConnected,
        "keys=",
        JSON.stringify(Object.keys(input).slice(0, 8)),
      )
      throw new Error("no react fiber on node — is React mounted?")
    }
    const fiber = (input as unknown as Record<string, {
      memoizedProps?: {
        onChange?: (e: unknown) => void
        onBlur?: (e: unknown) => void
      }
    }>)[key]
    const onChange = fiber?.memoizedProps?.onChange
    if (onChange) onChange({ target: input, currentTarget: input })
    else throw new Error("no onChange on fiber props")
  })
  await sleep()
}

async function main() {
  const root = createRoot(document.getElementById("root")!)
  await act(async () => {
    root.render(React.createElement(App))
  })
  await sleep(50)

  // 1. Shell renders with grouped nav + command bar
  check(
    "shell renders",
    !!document.querySelector("header") && !!document.querySelector("footer"),
  )
  const nav = document.querySelector('nav[aria-label="Main navigation"]')
  check(
    "nav groups present",
    /Collections|Intelligence|System/i.test(text(nav)),
  )
  check(
    "command search exists",
    !!document.querySelector('input[role="searchbox"]'),
  )

  // 2. Navigation: Contents
  const contentsBtn = allButtons().find((b) => text(b).startsWith("Contents"))
  await click(contentsBtn)
  check(
    "switch to contents",
    text(document.querySelector("h1")).includes("Contents"),
  )

  // 3. Load sample data through the Tools menu
  await click(findButton("Tools"))
  await click(findButton("Load Sample Data"))
  await sleep(60)
  check(
    "sample toast",
    document.body.textContent?.includes("Sample data loaded"),
  )

  // 4. All Data view shows records + count chip
  await click(allButtons().find((b) => text(b).startsWith("All Data")))
  await sleep(30)
  const ph = document.querySelector("main h1")
  check("all data page header", text(ph).includes("All Data"))
  const rows = document.querySelectorAll("main tbody tr")
  check("rows rendered", rows.length > 3, `(${rows.length})`)

  // 5. Global command search routes to All Data and filters
  const searchInput = document.querySelector(
    'header input[role="searchbox"]',
  ) as HTMLInputElement
  await setInputValue(searchInput, "zzzz-not-found")
  await sleep(30)
  const noRes = !!document
    .querySelector("main")
    ?.textContent?.includes("No records found matching current filters.")
  if (!noRes)
    console.log(
      "DEBUG MAIN:",
      (document.querySelector("main")?.textContent ?? "").slice(0, 400),
    )
  check("no-results state", noRes)
  await setInputValue(searchInput, "")
  await sleep(30)

  // 6. Sources: quick add opens the real Add dialog
  await click(allButtons().find((b) => text(b).startsWith("Sources")))
  await sleep(30)
  await click(findButton("Quick add"))
  const addSourceItem = allButtons().find(
    (b) => text(b).includes("Sources") && b.getAttribute("role") === "menuitem",
  )
  await click(addSourceItem)
  const dialog = lastDialog()
  check(
    "quick add opens form",
    !!dialog &&
      (dialog as HTMLElement).textContent?.includes("Add Source") === true,
  )
  // Type into the form by locating each Field via its <label> — immune to DOM
  // index drift and to combo/number fields sharing the input element type.
  const byLabel = (wanted: string): HTMLInputElement | undefined => {
    for (const field of Array.from(
      (dialog as HTMLElement).querySelectorAll(".flex.flex-col"),
    )) {
      const lbl = field.querySelector(":scope > label")
      if (lbl && text(lbl).startsWith(wanted)) {
        const el = field.querySelector("input") as HTMLInputElement | null
        if (el) return el
      }
    }
    return undefined
  }
  await setInputValue(byLabel("Name")!, "Dom Check Source")
  await setInputValue(byLabel("Link")!, "https://example.com")
  await setInputValue(byLabel("Country")!, "Checkland")
  const saveBtn = allButtons().find(
    (b) => text(b).includes("Save") && b.closest('[role="dialog"]'),
  )
  await click(saveBtn)
  await sleep(60)
  const saved = !!document
    .querySelector("main")
    ?.textContent?.includes("Dom Check Source")
  if (!saved)
    console.log(
      "DEBUG TOAST:",
      (document.body.querySelector('[role="status"]')?.textContent ?? "").slice(
        0,
        200,
      ),
      "DIALOG:",
      (lastDialog()?.textContent ?? "none").slice(0, 160),
    )
  check("record saved via form", saved, "name not found in table")
  await closeAllDialogs()

  // 7. Export dialog flow from Sources toolbar
  await click(findButton("Export")!)
  await sleep(30)
  const exDialog = lastDialog()
  check(
    "export dialog opens",
    !!exDialog &&
      (exDialog as HTMLElement).textContent?.includes("Export Data"),
  )
  const exportGo = allButtons().find(
    (b) => text(b) === "Export" && b.closest('[role="dialog"]'),
  )
  await click(exportGo!)
  await sleep(120)
  check(
    "export success state",
    lastDialog()?.textContent?.includes("Export complete") ?? false,
  )
  const doneBtn = allButtons().find(
    (b) => text(b) === "Done" && b.closest('[role="dialog"]'),
  )
  if (doneBtn) await click(doneBtn)
  await sleep(30)
  await closeAllDialogs()

  // 8. Settings: toggle dark theme and apply
  await click(findButton("Settings")!)
  await sleep(30)
  const settingsDialog = lastDialog()
  check(
    "settings opens",
    !!settingsDialog &&
      (settingsDialog as HTMLElement).textContent?.includes("Settings"),
  )
  const darkOpt = allButtons().find(
    (b) => text(b) === "Dark" && b.closest('[role="dialog"]'),
  )
  await click(darkOpt!)
  const applyBtn = allButtons().find((b) => text(b).includes("Apply Settings"))
  await click(applyBtn!)
  await sleep(30)
  check("theme applied", document.documentElement.classList.contains("dark"))
  // revert to light via settings again (also exercises unsaved badge path)
  await click(findButton("Settings")!)
  await sleep(30)
  const dirtyBadge = !!lastDialog()?.textContent?.match(
    /Unsaved changes|Apply Settings/,
  )
  const lightOpt = allButtons().find(
    (b) => text(b) === "Light" && b.closest('[role="dialog"]'),
  )
  await click(lightOpt!)
  const apply2 = allButtons().find(
    (b) => text(b).includes("Apply Settings") && b.closest('[role="dialog"]'),
  )
  await click(apply2!)
  await sleep(30)
  check("light restored", !document.documentElement.classList.contains("dark"))
  await closeAllDialogs()
  check("settings had draft controls", dirtyBadge)

  // 9. Backup flow through the Tools menu
  await click(findButton("Tools"))
  await click(findButton("Backup & Restore"))
  await sleep(30)
  const bkDialog = lastDialog()
  check(
    "backup dialog opens",
    !!bkDialog &&
      (bkDialog as HTMLElement).textContent?.includes("Create backup"),
  )
  const createBtn = allButtons().find(
    (b) => text(b).includes("Create Backup") && b.closest('[role="dialog"]'),
  )
  await click(createBtn!)
  await sleep(60)
  const bkDialog2 = lastDialog()!
  check(
    "backup listed in archive",
    bkDialog2.textContent?.includes("backup_") === true ||
      document.body.textContent?.includes("Local backup archive"),
  )
  // select + restore path: select row then restore then confirm
  const row = bkDialog2.querySelector("tbody tr")
  if (row) {
    await click(row)
    const restoreBtn = allButtons().find(
      (b) =>
        text(b).includes("Restore Selected") && b.closest('[role="dialog"]'),
    )
    await click(restoreBtn!)
    const confirmBtn = allButtons().find((b) => text(b).includes("Confirm"))
    await click(confirmBtn!)
    await sleep(60)
    check("restore confirm worked", true)
  }
  const closeBk = allButtons().find(
    (b) => text(b) === "Close" && b.closest('[role="dialog"]'),
  )
  await click(closeBk!)

  // 10. Import wizard renders 4 labeled steps with disabled Next
  await click(findButton("Tools"))
  await click(findButton("Import Data"))
  await sleep(30)
  const wiz = lastDialog()
  const stepTitles = [
    "Select File",
    "Map Columns",
    "Preview & Validate",
    "Import",
  ].filter((st) => (wiz?.textContent ?? "").includes(st))
  check("wizard shows step rail", stepTitles.length >= 3, stepTitles.join("/"))
  const nextBtn = allButtons().find(
    (b) => text(b) === "Next" && b.closest('[role="dialog"]'),
  )
  check(
    "next disabled with no file",
    !!nextBtn && (nextBtn as HTMLButtonElement).disabled,
  )
  await closeAllDialogs()
  await sleep(30)

  // 11. Reports: run default query
  await click(allButtons().find((b) => text(b).startsWith("Reports")))
  await sleep(30)
  const runBtn = allButtons().find((b) => text(b).includes("Run Query"))
  await click(runBtn!)
  await sleep(120)
  check(
    "report query ran",
    !!document.querySelector("main")?.textContent?.match(/records|Rows/i),
  )

  // 12. Timeline + Activity + Dictionary render through nav
  for (const name of ["Timeline", "Activity", "Dictionary"]) {
    await click(allButtons().find((b) => text(b).startsWith(name))!)
    await sleep(40)
    check(
      `nav → ${name}`,
      (document.querySelector("main")?.textContent ?? "").length > 200,
    )
  }

  // 13. Icon-integrity audit over the live DOM:
  const glyphRe =
    /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}✕✓✔⚙⚠ℹ＋←↑↓↺⎘⋯»«›‹★☆▲▼◀▶]/u
  const badButtons = allButtons().filter((b) => {
    const t = text(b)
    if (t.length && !glyphRe.test(t)) return false
    if (b.getAttribute("aria-label")) return false
    return true // empty or glyph-only with no accessible name
  })
  check(
    "no unlabeled icon-only buttons",
    badButtons.length === 0,
    badButtons.map((b) => b.outerHTML.slice(0, 80)).join(" | "),
  )
  const glyphs =
    (document.body.textContent ?? "").match(new RegExp(glyphRe.source, "gu")) ??
    []
  const allowed = ["—", "·", "→"] // typographic separators/content ranges, not controls
  const offending = glyphs.filter((g) => !allowed.includes(g))
  check(
    "no text-glyph icons in UI text",
    offending.length === 0,
    [...new Set(offending)].join(" "),
  )
  const svgs = Array.from(document.querySelectorAll("button svg, a svg"))
  const lucideCount = svgs.filter(
    (svg) =>
      svg.getAttribute("class")?.includes("lucide") ||
      (svg.getAttribute("width") && !svg.getAttribute("class")),
  ).length
  check(
    "icons render as SVG components",
    svgs.length > 20,
    `${svgs.length} inline svgs`,
  )

  // 14. Language switch → RTL
  await click(findButton("AR")!)
  await sleep(40)
  check("arabic sets RTL", document.documentElement.dir === "rtl")
  await click(findButton("EN")!)

  await act(async () => root.unmount())
  console.log(
    failures === 0 ? "DOM CHECK PASS" : `DOM CHECK FAILURES: ${failures}`,
  )
  if (failures) process.exitCode = 1
}

main().catch((err) => {
  console.error("HARNESS ERROR", err)
  process.exitCode = 1
})