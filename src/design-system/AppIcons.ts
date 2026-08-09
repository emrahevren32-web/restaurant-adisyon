import type { LucideIcon } from 'lucide-react'
import {
  Archive,
  Barcode,
  BellRing,
  Bot,
  Boxes,
  BrainCircuit,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheckBig,
  CircleDashed,
  CircleUserRound,
  CircleX,
  ClipboardCheck,
  ClipboardList,
  Eye,
  EyeOff,
  Factory,
  FileDown,
  FileSpreadsheet,
  FileText,
  FileUp,
  Filter,
  Flame,
  HelpCircle,
  History,
  Home,
  Landmark,
  Layers,
  LayoutDashboard,
  Lock,
  LogOut,
  Minus,
  MonitorSmartphone,
  Package,
  PackageCheck,
  PackageOpen,
  PackagePlus,
  Palette,
  PanelsTopLeft,
  Plus,
  Printer,
  Puzzle,
  QrCode,
  RefreshCw,
  Save,
  ScanBarcode,
  Search,
  Settings,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  TestTubeDiagonal,
  Trash2,
  Truck,
  Upload,
  UserCog,
  Users,
  Warehouse,
  WalletCards,
  Wrench,
  X
} from 'lucide-react'

export type AppIconName =
  | 'dashboard'
  | 'stock'
  | 'warehouse'
  | 'purchase'
  | 'production'
  | 'shipment'
  | 'quality'
  | 'waste'
  | 'sample'
  | 'personnel'
  | 'reports'
  | 'finance'
  | 'notification'
  | 'settings'
  | 'search'
  | 'filter'
  | 'print'
  | 'excel'
  | 'qr'
  | 'barcode'
  | 'mobile'
  | 'theme'
  | 'user'
  | 'company'
  | 'recipe'
  | 'lot'
  | 'workspace'
  | 'marketplace'
  | 'integration'
  | 'ai'
  | 'calendar'
  | 'history'
  | 'home'
  | 'module'
  | 'document'
  | 'template'
  | 'device'
  | 'maintenance'
  | 'approval'
  | 'success'
  | 'info'
  | 'warning'
  | 'error'
  | 'critical'
  | 'empty'
  | 'plus'
  | 'minus'
  | 'close'
  | 'lock'
  | 'chevronDown'
  | 'chevronLeft'
  | 'chevronRight'
  | 'hide'
  | 'show'
  | 'remove'
  | 'archive'
  | 'refresh'
  | 'save'
  | 'upload'
  | 'download'
  | 'help'
  | 'logout'
  | 'fallback'

export type AppIconResolveInput = {
  name?: AppIconName
  source?: string
  label?: string
  context?: string
}

export const APP_ICON_REGISTRY: Record<AppIconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  stock: Boxes,
  warehouse: Warehouse,
  purchase: ShoppingCart,
  production: Factory,
  shipment: Truck,
  quality: ShieldCheck,
  waste: Flame,
  sample: TestTubeDiagonal,
  personnel: Users,
  reports: ChartNoAxesCombined,
  finance: WalletCards,
  notification: BellRing,
  settings: Settings,
  search: Search,
  filter: Filter,
  print: Printer,
  excel: FileSpreadsheet,
  qr: QrCode,
  barcode: ScanBarcode,
  mobile: MonitorSmartphone,
  theme: Palette,
  user: CircleUserRound,
  company: Building2,
  recipe: ClipboardList,
  lot: PackageCheck,
  workspace: PanelsTopLeft,
  marketplace: Store,
  integration: Puzzle,
  ai: Bot,
  calendar: CalendarDays,
  history: History,
  home: Home,
  module: PackageOpen,
  document: FileText,
  template: Layers,
  device: MonitorSmartphone,
  maintenance: Wrench,
  approval: ClipboardCheck,
  success: CircleCheckBig,
  info: CircleAlert,
  warning: CircleAlert,
  error: CircleX,
  critical: CircleAlert,
  empty: CircleDashed,
  plus: Plus,
  minus: Minus,
  close: X,
  lock: Lock,
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  hide: EyeOff,
  show: Eye,
  remove: Trash2,
  archive: Archive,
  refresh: RefreshCw,
  save: Save,
  upload: FileUp,
  download: FileDown,
  help: HelpCircle,
  logout: LogOut,
  fallback: Settings2
}

const ICON_ALIAS_MAP: Record<string, AppIconName> = {
  AA: 'ai',
  AB: 'finance',
  AD: 'approval',
  AG: 'reports',
  AI: 'ai',
  AL: 'notification',
  AP: 'approval',
  AR: 'archive',
  BD: 'notification',
  BK: 'barcode',
  BR: 'reports',
  BS: 'reports',
  BV: 'company',
  CF: 'finance',
  DB: 'dashboard',
  DP: 'warehouse',
  E3: 'settings',
  EN: 'integration',
  FR: 'company',
  FT: 'finance',
  GI: 'purchase',
  IM: 'module',
  IS: 'company',
  IY: 'company',
  KL: 'quality',
  KP: 'dashboard',
  KS: 'stock',
  KW: 'workspace',
  KY: 'quality',
  LS: 'finance',
  MA: 'module',
  MD: 'module',
  MI: 'reports',
  ML: 'user',
  MP: 'marketplace',
  MS: 'mobile',
  MT: 'maintenance',
  OB: 'approval',
  PL: 'finance',
  QR: 'qr',
  RN: 'recipe',
  RS: 'reports',
  RZ: 'recipe',
  SA: 'purchase',
  SC: 'settings',
  SD: 'notification',
  SM: 'sample',
  SP: 'shipment',
  ST: 'stock',
  SV: 'shipment',
  TN: 'company',
  TR: 'shipment',
  UA: 'user',
  UR: 'production',
  WE: 'workspace',
  WG: 'dashboard',
  WS: 'workspace',
  WW: 'workspace',
  XL: 'excel',
  YM: 'settings'
}

const normalizeText = (value: string) => (
  value
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
)

const CONTEXT_RULES: Array<{ patterns: string[]; icon: AppIconName }> = [
  { patterns: ['barcode', 'barkod', 'scan-barcode'], icon: 'barcode' },
  { patterns: ['qr', 'scan-qr'], icon: 'qr' },
  { patterns: ['mobile', 'mobil', 'device', 'cihaz'], icon: 'mobile' },
  { patterns: ['theme', 'tema', 'palette'], icon: 'theme' },
  { patterns: ['notification', 'bildirim', 'alert', 'alarm', 'duyuru'], icon: 'notification' },
  { patterns: ['integration', 'entegrasyon', 'webhook', 'api', 'connector'], icon: 'integration' },
  { patterns: ['marketplace', 'magaza', 'katalog'], icon: 'marketplace' },
  { patterns: ['workspace', 'calisma', 'onboarding', 'welcome'], icon: 'workspace' },
  { patterns: ['dashboard', 'summary', 'kontrol', 'kpi'], icon: 'dashboard' },
  { patterns: ['report', 'rapor', 'analytics', 'analiz', 'istatistik'], icon: 'reports' },
  { patterns: ['stock', 'stok', 'hammadde', 'material', 'product'], icon: 'stock' },
  { patterns: ['warehouse', 'depo'], icon: 'warehouse' },
  { patterns: ['purchase', 'satinalma', 'procurement', 'supplier', 'tedarik', 'rfq'], icon: 'purchase' },
  { patterns: ['recipe', 'recete'], icon: 'recipe' },
  { patterns: ['production', 'uretim', 'work-order', 'capacity', 'machine', 'scheduling'], icon: 'production' },
  { patterns: ['shipment', 'sevkiyat', 'delivery', 'waybill', 'vehicle', 'pallet'], icon: 'shipment' },
  { patterns: ['quality', 'kalite', 'haccp', 'traceability', 'recall'], icon: 'quality' },
  { patterns: ['waste', 'fire'], icon: 'waste' },
  { patterns: ['sample', 'numune', 'witness'], icon: 'sample' },
  { patterns: ['personnel', 'personel', 'staff', 'workforce', 'attendance', 'shift'], icon: 'personnel' },
  { patterns: ['finance', 'finans', 'billing', 'fatura', 'cash', 'payment', 'debt', 'revenue', 'cost'], icon: 'finance' },
  { patterns: ['company', 'firma', 'tenant', 'business', 'isletme', 'sector'], icon: 'company' },
  { patterns: ['user', 'kullanici', 'customer', 'musteri', 'profile'], icon: 'user' },
  { patterns: ['filter', 'filtre'], icon: 'filter' },
  { patterns: ['search', 'arama', 'ara'], icon: 'search' },
  { patterns: ['print', 'yazdir'], icon: 'print' },
  { patterns: ['excel', 'spreadsheet'], icon: 'excel' },
  { patterns: ['settings', 'ayar'], icon: 'settings' },
  { patterns: ['history', 'gecmis', 'log'], icon: 'history' },
  { patterns: ['calendar', 'takvim', 'date', 'tarih'], icon: 'calendar' }
]

export const resolveAppIconName = (input: AppIconResolveInput | AppIconName | string): AppIconName => {
  if(typeof input === 'string'){
    if(input in APP_ICON_REGISTRY) return input as AppIconName
    return ICON_ALIAS_MAP[input.toLocaleUpperCase('en-US')] || 'fallback'
  }

  if(input.name) return input.name

  const source = input.source?.trim()
  if(source){
    if(source in APP_ICON_REGISTRY) return source as AppIconName
    const alias = ICON_ALIAS_MAP[source.toLocaleUpperCase('en-US')]
    if(alias) return alias
  }

  const context = normalizeText([input.context, input.label, source].filter(Boolean).join(' '))
  const match = CONTEXT_RULES.find(rule => rule.patterns.some(pattern => context.includes(pattern)))
  return match?.icon || 'fallback'
}
