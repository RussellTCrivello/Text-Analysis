import React, { useState } from "react"
import { InfoModal } from "./FormModal"

const TOPICS = [
  {
    id: "getting-started",
    title: "Getting Started",
    content: `Welcome to Text Analysis Management System v2.1.0.

This application helps you collect, organize, and analyze research sources and content.

**Navigation**
Use the sidebar (or Ctrl+1–8) to switch between the eight main workspaces:
• Sources — Collect and organize information sources
• Contents — Manage captured content items  
• Analysis — Structured analysis records
• All Data — Unified read-only view across all records
• Timeline — Chronological view of all events
• Reports — Advanced query and chart builder
• Activity — Audit trail of every change, with undo/redo
• Dictionary — Editable gazetteer, taxonomy and extraction test bed

**Quick Add**
Click **Quick add** in the command bar (or press Ctrl+N) to create a record in the current workspace.

**Settings**
Access Settings from the sidebar Operations group or the Settings button in the command bar.`,
  },
  {
    id: "sources",
    title: "Sources Management",
    content: `The Sources workspace manages the research sources that ground your work.

**Fields**
• Name (required) — Unique source title
• Type (required) — Source category (website, person, organization, etc.)
• Link (required) — URL validated on entry
• Importance — 0–100% score (stored as 0.0–1.0)
• Country (required), City — Geographic origin
• Description, Accounts, Ownership, Note — Additional metadata
• Entry Date — User-specified date for this source

**Actions**
• Add / Edit / Delete / Duplicate — Standard record management
• Import Sources — CSV file import with column mapping
• Export — Unified export dialog (CSV, JSON, XML, JSONL, Excel, Word, PDF)
• Statistics — Aggregate stats over all loaded records
• Advanced Search — Multi-condition search with saved searches
• Bulk Operations — Delete or edit many records at once`,
  },
  {
    id: "contents",
    title: "Contents Management",
    content: `The Contents workspace manages documents and extracts belonging to sources.

**Fields**
• Source (required) — Parent source this content belongs to
• Title — Content title
• Content Data (required) — Full text of the content
• Importance — 0–100% score
• Content Date — Publication/event date of the content
• Attachments — Associated file names (semicolon-separated)
• Note — Free-text note

**Actions**
• Link to Analysis — Shortcut to create an analysis for the selected content
• Preview Content — Full-screen view of the content text
• View Attachments — Manage attached files`,
  },
  {
    id: "analysis",
    title: "Content Analysis",
    content: `The Analysis workspace holds structured analysis records linked to content.

**Fields**
• Content (required) — The content being analyzed
• Classification (required) — Analysis category
• People Names — Comma-separated list of people mentioned
• Place Names — Comma-separated list of places mentioned
• Coordinates — Lat/lon coordinate pairs
• Sides/Parties — Parties or sides involved

**Actions**
• Auto-Extract — Automatically extract entities from the linked content text
• View on Map — Open coordinates in Google Maps
• Compare — Side-by-side comparison of filtered analysis records
• Summary — Aggregate statistics over filtered records`,
  },
  {
    id: "timeline",
    title: "Timeline",
    content: `The Timeline workspace shows all records that have a date in chronological order.

**Event Cards**
Each card shows the date, type (color-coded axis node), title, summary, and context badges.
• Purple (large) — Analysis events
• Blue (medium) — Content events  
• Green (small) — Source events

**Charts**
Switch between By Type, Monthly, Day of Week, and By Classification chart views.

**Filters**
Combine date range, full-text search, people, places, and classification filters.`,
  },
  {
    id: "reports",
    title: "Reports",
    content: `The Reports workspace provides a full query builder and chart designer.

**Query Builder**
• SQL Mode — Write freeform SELECT statements with template buttons for common queries
• Visual Mode — Guided builder with table/field/filter/order/limit controls

**Chart Designer**
Configure chart type (Bar, Line, Pie, Area, Radar), aggregation, color scheme, label and value fields.

**Results**
Paginated table showing query output. Click "Create Chart" to feed results to the Chart Designer.

**Report Preview**
Live HTML preview of the report document. Set a title, toggle chart inclusion, save/load reports.`,
  },
  {
    id: "export",
    title: "Export",
    content: `The unified Export dialog is available from every table workspace.

**Formats**
• CSV — Comma-separated values
• JSON — Structured JSON with metadata
• JSON Lines — One object per line
• XML — XML with record elements
• Excel (.xlsx) — Spreadsheet (planned)
• Word (.docx) — Document (planned)
• PDF — Print-formatted PDF (planned)

**Options**
• Select which columns to include
• Toggle field name translation
• Set output filename
• Live preview of the first N rows`,
  },
  {
    id: "search",
    title: "Search & Filter",
    content: `Every table workspace supports combined text and date filtering.

**Text Search**
Applied immediately; case-insensitive substring match across all fields including joined fields.

**Date Range**
Default: today − 1 year → today. Rows without any date are always kept.

**Advanced Search**
Multi-condition builder with 10+ operators (=, !=, LIKE, >, <, IS NULL, etc.). Results replace the table view until the next Refresh. Save searches for re-use.`,
  },
  {
    id: "bulk",
    title: "Bulk Operations",
    content: `Bulk Operations allows acting on many records at once.

**Modes**
• Bulk Delete — Confirm and delete all selected records (with cascade)
• Bulk Edit — Set field values across all selected records
• Bulk Import — Append rows from a CSV file

Access from the More menu in a table toolbar or from the selection action bar when rows are selected.`,
  },
  {
    id: "activity",
    title: "Activity & Audit Trail",
    content: `Every create, update, delete, bulk, import, restore, merge and reset is recorded.

**What is stored**
• Timestamp, actor, action and entity
• Record id and title
• Field-level diffs (before → after) for updates

**Working with the log**
• Filter by action, entity, date range or free text
• Expand an entry to read the exact field changes
• Undo / Redo the most recent workspace mutations
• Export the filtered log as CSV for reporting

The log is capped at 2,000 entries and travels inside every backup envelope.`,
  },
  {
    id: "dictionary",
    title: "Data Dictionary (extensibility)",
    content: `The vocabulary behind automated extraction is user-editable — nothing is hardcoded.

**Gazetteer**
• Places, organizations and keywords used for entity matching
• Add names with kind, country, coordinates and aliases
• Adding an existing name extends it instead of replacing it
• Built-in entries can be extended but not deleted

**Taxonomy**
• Classification categories and their keyword lists
• Add, rename, edit keywords or reset to the built-in set

**Extraction test**
• Paste any document and see people, places, organizations, sides,
  coordinates, dates and the winning classification with confidence

Everything persists with the workspace and can be exported as JSON to share
one vocabulary across a team.`,
  },
]

export function HelpDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const [activeId, setActiveId] = useState("getting-started")
  const topic = TOPICS.find((t) => t.id === activeId) ?? TOPICS[0]

  return (
    <InfoModal
      isOpen={isOpen}
      title="Help — Text Analysis Management System"
      onClose={onClose}
      size="xl"
    >
      <div className="flex gap-0 h-96">
        {/* Topics tree */}
        <div
          className="w-52 shrink-0 overflow-y-auto"
          style={{ borderInlineEnd: "1px solid var(--border)" }}
        >
          {TOPICS.map((t2) => (
            <button
              key={t2.id}
              onClick={() => setActiveId(t2.id)}
              className="w-full text-start px-3 py-2 text-xs transition-colors"
              style={{
                background:
                  activeId === t2.id ? "var(--secondary-bg)" : "transparent",
                color: activeId === t2.id ? "var(--fg)" : "var(--muted-fg)",
                borderInlineStart:
                  activeId === t2.id
                    ? "3px solid var(--primary)"
                    : "3px solid transparent",
              }}
            >
              {t2.title}
            </button>
          ))}
        </div>
        {/* Content pane */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          <h3
            className="text-base font-bold mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {topic.title}
          </h3>
          <div
            className="text-sm leading-relaxed whitespace-pre-wrap"
            style={{ color: "var(--fg)" }}
          >
            {topic.content.split("\n").map((line, i) => {
              if (line.startsWith("**") && line.endsWith("**")) {
                return (
                  <p key={i} className="font-bold mt-3 mb-1">
                    {line.slice(2, -2)}
                  </p>
                )
              }
              if (line.startsWith("• ")) {
                return (
                  <p
                    key={i}
                    className="ml-3 text-xs"
                    style={{ color: "var(--muted-fg)" }}
                  >
                    {line}
                  </p>
                )
              }
              return (
                <p key={i} className={line ? "" : "h-2"}>
                  {line}
                </p>
              )
            })}
          </div>
        </div>
      </div>
      <div
        className="pt-3 text-xs text-center"
        style={{ color: "var(--muted-fg)" }}
      >
        Text Analysis Management System v2.1.0 — Press F1 to open Help at any
        time
      </div>
    </InfoModal>
  )
}