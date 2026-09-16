/**
 * ============================================================================
 * APPLICATION ICON SYSTEM — single authoritative icon module
 * ============================================================================
 * Lucide (lucide-react) is the only icon library used in this application.
 * Every UI icon must be rendered through this module so the whole app shares
 * one stroke family, one sizing scale, one alignment behaviour and one
 * accessibility contract.
 *
 * Rules:
 *  - Never use text characters, emoji or ad-hoc inline SVGs as icons.
 *  - Always size icons with the IconSize tokens ('xs' | 'sm' | 'md' | 'lg' |
 *    'xl' | 'hero') — or an explicit pixel number only for exceptional,
 *    layout-driven cases.
 *  - Icons inside labelled controls are decorative (aria-hidden by default).
 *    Icon-only controls must be wrapped in IconButton / a labelled button that
 *    supplies the accessible name.
 *  - Icons inherit `currentColor`; apply semantic colour on the parent, not
 *    the icon, so hover/disabled states keep working.
 * ============================================================================
 */
import {
  Activity,
  ArchiveRestore,
  ArrowDown,
  ArrowLeftRight,
  ArrowUpDown,
  ArrowUp,
  BarChart3,
  Bookmark,
  BookOpen,
  Check,
  CheckCheck,
  Check as CheckRaw,
  LoaderCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  ChevronsLeft,
  ChevronsRight,
  CircleAlert,
  CircleCheck,
  CircleCheckBig,
  CircleHelp,
  CircleX,
  Clock,
  Copy,
  Database,
  DatabaseBackup,
  Download,
  Ellipsis,
  Eraser,
  Eye,
  FileCode,
  FileJson,
  FileSpreadsheet,
  FileText,
  FileUp,
  Filter,
  FolderOpen,
  Gauge,
  HardDriveDownload,
  Hexagon,
  Inbox,
  Info,
  Keyboard,
  LayoutGrid,
  LineChart,
  Link2,
  Lock,
  Map,
  MapPin,
  Paperclip,
  Pencil,
  Play,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Search,
  SearchX,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Moon,
  Trash2,
  TriangleAlert,
  Upload,
  Wand2,
  X,
  Zap,
  Accessibility,
  type LucideIcon,
} from 'lucide-react';
import type { CSSProperties } from 'react';

/** Standard icon sizes (px). One scale for the entire application. */
export const IconSize = {
  /** Dense metadata, inline status, table action glyphs */
  xs: 12,
  /** Compact buttons, menu items, chips */
  sm: 14,
  /** Standard buttons and controls (default) */
  md: 16,
  /** Page header tiles, prominent actions */
  lg: 20,
  /** Dialog/section prominence */
  xl: 26,
  /** Empty states and hero presentation */
  hero: 36,
} as const;

export type IconSizeName = keyof typeof IconSize;
export type IconSizeProp = IconSizeName | number;

export interface IconProps {
  size?: IconSizeProp;
  /** Stroke width override — the default keeps Lucide's visual weight consistent at small sizes. */
  strokeWidth?: number;
  className?: string;
  /** Decorative by default. Set false only when the icon alone carries meaning. */
  'aria-hidden'?: boolean;
  'aria-label'?: string;
  style?: CSSProperties;
}

const px = (size: IconSizeProp): number => (typeof size === 'number' ? size : IconSize[size]);

/** Factory: binds an app-wide default size + stroke + a11y contract to a Lucide icon. */
function makeIcon(Icon: LucideIcon, defaultSize: IconSizeProp = 'md') {
  const Component = ({ size = defaultSize, strokeWidth = 1.75, className = '', ...rest }: IconProps) => (
    <Icon
      width={px(size)}
      height={px(size)}
      strokeWidth={strokeWidth}
      className={`shrink-0 inline-block align-[-0.15em] ${className}`}
      aria-hidden={rest['aria-label'] ? undefined : rest['aria-hidden'] ?? true}
      {...rest}
    />
  );
  Component.displayName = `Icon(${Icon.displayName ?? 'Lucide'})`;
  return Component;
}

/* ── Actions ─────────────────────────────────────────────────────────── */
export const IconAdd = makeIcon(Plus, 'sm');
export const IconEdit = makeIcon(Pencil, 'sm');
export const IconDelete = makeIcon(Trash2, 'sm');
export const IconSave = makeIcon(Save, 'sm');
export const IconClose = makeIcon(X, 'sm');
export const IconSearch = makeIcon(Search, 'sm');
export const IconFilter = makeIcon(Filter, 'sm');
export const IconSort = makeIcon(ArrowUpDown, 'xs');
export const IconSortAsc = makeIcon(ArrowUp, 'xs');
export const IconSortDesc = makeIcon(ArrowDown, 'xs');
export const IconSortNeutral = makeIcon(ChevronsUpDown, 'xs');
export const IconRefresh = makeIcon(RotateCcw, 'sm');
export const IconImport = makeIcon(Upload, 'sm');
export const IconExport = makeIcon(Download, 'sm');
export const IconPrint = makeIcon(Printer, 'sm');
export const IconCopy = makeIcon(Copy, 'sm');
export const IconView = makeIcon(Eye, 'sm');
export const IconPlay = makeIcon(Play, 'sm');
export const IconCompare = makeIcon(ArrowLeftRight, 'sm');
export const IconLink = makeIcon(Link2, 'sm');
export const IconAttach = makeIcon(Paperclip, 'sm');
export const IconMore = makeIcon(Ellipsis, 'sm');

/* ── Navigation / chrome ─────────────────────────────────────────────── */
export const IconExpandMore = makeIcon(ChevronDown, 'sm');
export const IconChevronLeft = makeIcon(ChevronLeft, 'sm');
export const IconChevronRight = makeIcon(ChevronRight, 'sm');
export const IconChevronsLeft = makeIcon(ChevronsLeft, 'xs');
export const IconChevronsRight = makeIcon(ChevronsRight, 'xs');
export const IconChevronUp = makeIcon(ChevronUp, 'sm');
export const IconCollapseSidebar = makeIcon(ChevronLeft, 'sm');
export const IconBack = makeIcon(ChevronLeft, 'sm');
export const IconNext = makeIcon(ChevronRight, 'sm');

/* ── Surfaces / sections ─────────────────────────────────────────────── */
export const IconSources = makeIcon(FolderOpen, 'md');
export const IconContents = makeIcon(FileText, 'md');
export const IconAnalysis = makeIcon(LineChart, 'md');
export const IconAllData = makeIcon(LayoutGrid, 'md');
export const IconTimeline = makeIcon(Clock, 'md');
export const IconReports = makeIcon(BarChart3, 'md');
export const IconActivity = makeIcon(Activity, 'md');
export const IconDictionary = makeIcon(BookOpen, 'md');
export const IconBrand = makeIcon(Hexagon, 'md');
export const IconChart = makeIcon(BarChart3, 'sm');
export const IconDatabase = makeIcon(Database, 'sm');

/* ── System / menus ──────────────────────────────────────────────────── */
export const IconSettings = makeIcon(Settings, 'sm');
export const IconHelp = makeIcon(CircleHelp, 'sm');
export const IconShortcuts = makeIcon(Keyboard, 'sm');
export const IconBackup = makeIcon(DatabaseBackup, 'sm');
export const IconRestore = makeIcon(ArchiveRestore, 'sm');
export const IconBackupFile = makeIcon(HardDriveDownload, 'sm');
export const IconShieldCheck = makeIcon(ShieldCheck, 'sm');
export const IconGauge = makeIcon(Gauge, 'sm');
export const IconThemeLight = makeIcon(Sun, 'sm');
export const IconThemeDark = makeIcon(Moon, 'sm');
export const IconSliders = makeIcon(SlidersHorizontal, 'sm');
export const IconAccessibility = makeIcon(Accessibility, 'sm');
export const IconLock = makeIcon(Lock, 'sm');
export const IconWand = makeIcon(Wand2, 'sm');
export const IconEraser = makeIcon(Eraser, 'sm');
export const IconBookmark = makeIcon(Bookmark, 'sm');
export const IconHistory = makeIcon(Clock, 'sm');
export const IconZap = makeIcon(Zap, 'sm');
export const IconFolderUp = makeIcon(FileUp, 'sm');

/* ── Status semantics ────────────────────────────────────────────────── */
export const IconWarning = makeIcon(TriangleAlert, 'sm');
export const IconError = makeIcon(CircleAlert, 'sm');
export const IconSuccess = makeIcon(CircleCheck, 'sm');
export const IconSuccessBig = makeIcon(CircleCheckBig, 'md');
export const IconInfo = makeIcon(Info, 'sm');
export const IconStatusX = makeIcon(CircleX, 'sm');
export const IconCheck = makeIcon(Check, 'xs');
export const IconCheckGlyph = makeIcon(CheckRaw, 'xs');
export const IconLoader = makeIcon(LoaderCircle, 'md');
export const IconAllChecked = makeIcon(CheckCheck, 'sm');

/* ── Content / geography ─────────────────────────────────────────────── */
export const IconMapRegion = makeIcon(Map, 'sm');
export const IconMapPin = makeIcon(MapPin, 'xs');

/* ── File formats (export groups) ────────────────────────────────────── */
export const IconFileSheet = makeIcon(FileSpreadsheet, 'sm');
export const IconFileDoc = makeIcon(FileText, 'sm');
export const IconFileJson = makeIcon(FileJson, 'sm');
export const IconFileCode = makeIcon(FileCode, 'sm');

/* ── State illustration (empty / no-results) ─────────────────────────── */
export const IconInbox = makeIcon(Inbox, 'hero');
export const IconNoResults = makeIcon(SearchX, 'hero');
export const IconUploadZone = makeIcon(Upload, 'lg');
