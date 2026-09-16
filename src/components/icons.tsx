/**
 * ─── Application icon system ────────────────────────────────────────────────
 *
 * `lucide-react` is the single authoritative icon library for this app, and
 * this module is the only place the front end reaches it from. Every icon the
 * UI renders is re-exported here through `createAppIcon`, which normalizes:
 *
 *   • the icon family — always the Lucide outline set, never a second library
 *                       and never hand-drawn or text-glyph "icons"
 *   • sizing          — one of six standard steps (see ICON_SIZES)
 *   • stroke weight   — one app-wide default matching the hairline design
 *   • alignment       — flexShrink + baseline correction so glyphs sit on the
 *                       surrounding text baseline inside buttons and menus
 *   • accessibility   — icons are `aria-hidden` by default (a visible label
 *                       always accompanies them); passing `aria-label`
 *                       promotes the icon to a labelled `img`
 *
 * Components import icons from `../components/icons` — not from
 * `lucide-react` directly — so these rules stay enforced from one place.
 */
import React, { forwardRef } from "react"
import {
  Accessibility,
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Asterisk,
  BarChart3,
  BookOpen,
  BookmarkPlus,
  Braces,
  CalendarRange,
  ChartPie,
  Check as CheckRaw,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleHelp,
  CircleX,
  ClipboardList,
  Clock,
  Columns3,
  Copy,
  Database,
  Download,
  Equal,
  Eye,
  ExternalLink,
  FileCode2,
  FileDown,
  FileJson2,
  FileSpreadsheet,
  FileText,
  FileUp,
  Filter,
  FolderInput,
  FolderOpen,
  Gauge,
  GitCompareArrows,
  Globe,
  HardDrive,
  History,
  Info,
  Keyboard,
  Languages,
  Layers,
  LayoutGrid,
  Link2,
  List,
  ListChecks,
  Loader,
  Lock,
  Map,
  Maximize2,
  Menu as MenuRaw,
  PanelLeft as PanelLeftRaw,
  Minimize2,
  Monitor,
  MoreHorizontal,
  MousePointerClick,
  Palette as PaletteRaw,
  Paperclip,
  Pencil as PencilRaw,
  Play,
  Plus as PlusRaw,
  Printer as PrinterRaw,
  Quote,
  Radar,
  Redo2,
  RefreshCw,
  RotateCcw,
  Rows3,
  Save as SaveRaw,
  Search as SearchRaw,
  SearchCode,
  SearchX,
  Settings,
  ShieldCheck,
  Sigma,
  SlidersHorizontal,
  Sparkles,
  SquareCheck,
  SunMoon,
  Table,
  Tag,
  Trash2,
  TriangleAlert as TriangleAlertRaw,
  Type,
  Undo2,
  Unlink,
  Unlock,
  Upload,
  Wand2,
  X,
  Zap,
  ZoomIn,
  type LucideIcon,
  type LucideProps,
} from "lucide-react"
import type { NavSection } from "../types"

/* ── Standard sizes ──────────────────────────────────────────────────────── */
export type IconSize = "xs" | "sm" | "md" | "lg" | "xl" | "hero"

/**
 * Canonical px steps: `xs` for dense table chips, `sm` for buttons and menu
 * rows, `md` for inputs and toolbar affordances, `lg` for page headers,
 * `xl` for callout markers, `hero` for empty-state artwork.
 */
export const ICON_SIZES: Record<IconSize, number> = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 24,
  hero: 40,
}

/** Single app-wide stroke weight keeps every glyph optically identical. */
const ICON_STROKE = 1.75

export interface AppIconProps
  extends LucideProps {
  /** Named size step (default `md`) or an explicit pixel override. */
  size?: IconSize | number
}

/**
 * Wrap a Lucide icon with the application defaults (size step, stroke,
 * aria-hidden unless explicitly labelled).
 */
export function createAppIcon(Base: LucideIcon, defaultSize: IconSize = "md") {
  const AppIcon = forwardRef<SVGSVGElement, AppIconProps>((props, ref) => {
    const { size = defaultSize, ...rest } = props
    const px = typeof size === "number" ? size : ICON_SIZES[size]
    const labelled = rest["aria-label"] !== undefined
    return (
      <Base
        ref={ref}
        size={px}
        strokeWidth={ICON_STROKE}
        aria-hidden={labelled ? undefined : true}
        role={labelled ? "img" : undefined}
        style={{ flexShrink: 0, verticalAlign: "-0.125em", ...rest.style }}
        {...rest}
      />
    )
  })
  AppIcon.displayName = `Icon(${Base.displayName ?? "Lucide"})`
  return AppIcon
}

/* ── Core action icons ───────────────────────────────────────────────────── */
export const Plus = createAppIcon(PlusRaw, "sm")
export const Pencil = createAppIcon(PencilRaw, "sm")
export const Trash = createAppIcon(Trash2, "sm")
export const Save = createAppIcon(SaveRaw, "sm")
export const Close = createAppIcon(X, "sm")
export const Search = createAppIcon(SearchRaw, "md")
export const FilterIcon = createAppIcon(Filter, "sm")
export const Sliders = createAppIcon(SlidersHorizontal, "sm")
export const Sort = createAppIcon(ArrowUpDown, "xs")
export const SortAsc = createAppIcon(ArrowUp, "xs")
export const SortDesc = createAppIcon(ArrowDown, "xs")
export const Refresh = createAppIcon(RefreshCw, "sm")
export const Reset = createAppIcon(RotateCcw, "sm")
export const Undo = createAppIcon(Undo2, "sm")
export const Redo = createAppIcon(Redo2, "sm")
export const UploadIcon = createAppIcon(Upload, "sm")
export const DownloadIcon = createAppIcon(Download, "sm")
export const SettingsIcon = createAppIcon(Settings, "sm")
export const Help = createAppIcon(CircleHelp, "sm")
export const InfoIcon = createAppIcon(Info, "md")
export const Printer = createAppIcon(PrinterRaw, "sm")
export const Print = Printer
export const Warning = createAppIcon(TriangleAlertRaw, "md")
export const TriangleAlert = createAppIcon(TriangleAlertRaw, "md")
export const ErrorIcon = createAppIcon(CircleAlert, "md")
export const Success = createAppIcon(CircleCheck, "md")
export const Check = createAppIcon(CheckRaw, "sm")
export const CheckSmall = createAppIcon(CheckRaw, "xs")
export const CopyIcon = createAppIcon(Copy, "sm")
export const EyeIcon = createAppIcon(Eye, "sm")
export const More = createAppIcon(MoreHorizontal, "md")
export const Expand = createAppIcon(Maximize2, "sm")
export const Collapse = createAppIcon(Minimize2, "sm")
export const ChevronL = createAppIcon(ChevronLeft, "sm")
export const ChevronR = createAppIcon(ChevronRight, "sm")
export const ChevronU = createAppIcon(ChevronUp, "sm")
export const ChevronD = createAppIcon(ChevronDown, "sm")
export const ChevronsL = createAppIcon(ChevronsLeft, "sm")
export const ChevronsR = createAppIcon(ChevronsRight, "sm")
export const LockIcon = createAppIcon(Lock, "sm")
export const UnlockIcon = createAppIcon(Unlock, "sm")
export const ExternalLinkIcon = createAppIcon(ExternalLink, "xs")
export const LinkIcon = createAppIcon(Link2, "sm")
export const UnlinkIcon = createAppIcon(Unlink, "sm")

/* ── Domain / workflow icons ─────────────────────────────────────────────── */
export const ExportFile = createAppIcon(FileDown, "md")
export const ImportFile = createAppIcon(FileUp, "md")
export const ExportArrow = createAppIcon(Download, "sm")
export const ImportArrow = createAppIcon(Upload, "sm")
export const Attachment = createAppIcon(Paperclip, "sm")
export const FileDoc = createAppIcon(FileText, "md")
export const FileSheet = createAppIcon(FileSpreadsheet, "md")
export const FileCode = createAppIcon(FileCode2, "md")
export const FileJson = createAppIcon(FileJson2, "md")
export const DatabaseIcon = createAppIcon(Database, "md")
export const Backup = createAppIcon(HardDrive, "md")
export const Restore = createAppIcon(RotateCcw, "sm")
export const Verify = createAppIcon(ShieldCheck, "md")
export const HistoryIcon = createAppIcon(History, "md")
export const Bolt = createAppIcon(Zap, "sm")
export const KeyboardIcon = createAppIcon(Keyboard, "sm")
export const ThemeToggle = createAppIcon(SunMoon, "md")
export const LanguageIcon = createAppIcon(Languages, "sm")
export const GlobeIcon = createAppIcon(Globe, "md")
export const Palette = createAppIcon(PaletteRaw, "md")
export const TypeIcon = createAppIcon(Type, "md")
export const AccessibilityIcon = createAppIcon(Accessibility, "md")
export const MonitorIcon = createAppIcon(Monitor, "md")
export const GaugeIcon = createAppIcon(Gauge, "md")
export const Spinner = createAppIcon(Loader, "md")
export const PlayIcon = createAppIcon(Play, "sm")
export const SparkleIcon = createAppIcon(Sparkles, "sm")
export const WandIcon = createAppIcon(Wand2, "sm")
export const TagIcon = createAppIcon(Tag, "xs")
export const Bookmark = createAppIcon(BookmarkPlus, "sm")
export const AsteriskIcon = createAppIcon(Asterisk, "sm")
export const Quotes = createAppIcon(Quote, "sm")
export const BracesIcon = createAppIcon(Braces, "sm")
export const EqualsIcon = createAppIcon(Equal, "sm")
export const SearchCodeIcon = createAppIcon(SearchCode, "md")
export const SearchNo = createAppIcon(SearchX, "hero")
export const Dashed = createAppIcon(CircleDashed, "md")
export const FocusIcon = createAppIcon(MousePointerClick, "md")
export const Zoom = createAppIcon(ZoomIn, "sm")
export const ClockIcon = createAppIcon(Clock, "md")
export const CalendarRangeIcon = createAppIcon(CalendarRange, "md")
export const LayersIcon = createAppIcon(Layers, "md")
export const ListIcon = createAppIcon(List, "sm")
export const Checks = createAppIcon(ListChecks, "md")
export const SquareCheckIcon = createAppIcon(SquareCheck, "sm")
export const TableIcon = createAppIcon(Table, "md")
export const ColumnsIcon = createAppIcon(Columns3, "md")
export const RowsIcon = createAppIcon(Rows3, "md")
export const LayoutGridIcon = createAppIcon(LayoutGrid, "md")
export const Clipboard = createAppIcon(ClipboardList, "md")
export const Alert = createAppIcon(AlertTriangle, "md")
export const CircleXIcon = createAppIcon(CircleX, "sm")
export const RadarIcon = createAppIcon(Radar, "hero")
export const EmptyFile = createAppIcon(FileText, "hero")
export const MenuIcon = createAppIcon(MenuRaw, "md")
export const PanelLeftIcon = createAppIcon(PanelLeftRaw, "md")

/* ── Workspace (navigation) icons ────────────────────────────────────────── */
export const NavSources = createAppIcon(Activity, "md")
export const NavContents = createAppIcon(FileText, "md")
export const NavAnalysis = createAppIcon(Wand2, "md")
export const NavAllData = createAppIcon(Database, "md")
export const NavTimeline = createAppIcon(Clock, "md")
export const NavReports = createAppIcon(BarChart3, "md")
export const NavActivity = createAppIcon(History, "md")
export const NavDictionary = createAppIcon(BookOpen, "md")

export const NAV_ICONS: Record<NavSection, React.ComponentType<AppIconProps>> =
  {
    sources: NavSources,
    contents: NavContents,
    analysis: NavAnalysis,
    allData: NavAllData,
    timeline: NavTimeline,
    reports: NavReports,
    activity: NavActivity,
    dictionary: NavDictionary,
  }

export const NAV_GROUPS: {
  id: "collections" | "intelligence" | "system"
  sections: NavSection[]
}[] = [
  { id: "collections", sections: ["sources", "contents", "analysis"] },
  { id: "intelligence", sections: ["allData", "timeline", "reports"] },
  { id: "system", sections: ["activity", "dictionary"] },
]

/* ── Charts / misc workspace icons ───────────────────────────────────────── */
export const ChartPieIcon = createAppIcon(ChartPie, "md")
export const MapPinIcon = createAppIcon(Map, "sm")
export const CompareIcon = createAppIcon(GitCompareArrows, "sm")
export const SigmaIcon = createAppIcon(Sigma, "sm")
export const FolderOpenIcon = createAppIcon(FolderOpen, "hero")
export const FolderIn = createAppIcon(FolderInput, "md")

/**
 * Format glyphs for the export dialog — one file-type icon per family so
 * every format choice carries a distinct, meaningful mark.
 */
export const FORMAT_ICONS: Record<string, React.ComponentType<AppIconProps>> = {
  xlsx: FileSheet,
  xls: FileSheet,
  csv: FileSheet,
  tsv: FileSheet,
  docx: FileDoc,
  doc: FileDoc,
  pdf: FileDoc,
  html: FileCode,
  markdown: FileCode,
  json: FileJson,
  jsonl: FileJson,
  xml: FileCode,
  txt: FileDoc,
}

export type { LucideIcon, LucideProps }
export { X as LucideX }