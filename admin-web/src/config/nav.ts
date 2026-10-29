import {
  KeyRound,
  LayoutDashboard,
  ReceiptText,
  Settings,
  Store,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  end?: boolean
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Ringkasan',
    items: [{ label: 'Dashboard', to: '/', icon: LayoutDashboard, end: true }],
  },
  {
    label: 'Operasional',
    items: [
      { label: 'Toko', to: '/toko', icon: Store },
      { label: 'Transaksi', to: '/transaksi', icon: ReceiptText },
    ],
  },
  {
    label: 'Sistem',
    items: [
      { label: 'Lisensi & Perangkat', to: '/lisensi', icon: KeyRound },
      { label: 'Pengaturan', to: '/pengaturan', icon: Settings },
    ],
  },
]

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items)
