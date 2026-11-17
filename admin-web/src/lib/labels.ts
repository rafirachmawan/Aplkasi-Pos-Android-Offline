import type {
  DebtStatus,
  DeviceRow,
  LicenseStatus,
  LicenseType,
  Plan,
  ShiftStatus,
  StoreStatus,
  TableOrderStatus,
} from '@/types/domain'

export type LabelTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info' | 'accent'

export const STORE_STATUS_LABEL: Record<StoreStatus, string> = {
  active: 'Aktif',
  trial: 'Trial',
  inactive: 'Nonaktif',
}

export const STORE_STATUS_TONE: Record<StoreStatus, LabelTone> = {
  active: 'success',
  trial: 'warning',
  inactive: 'neutral',
}

export const LICENSE_STATUS_LABEL: Record<LicenseStatus, string> = {
  active: 'Aktif',
  expired: 'Kedaluwarsa',
  revoked: 'Dicabut',
}

export const LICENSE_STATUS_TONE: Record<LicenseStatus, LabelTone> = {
  active: 'success',
  expired: 'danger',
  revoked: 'neutral',
}

export const LICENSE_TYPE_LABEL: Record<LicenseType, string> = {
  lifetime: 'Lifetime',
  trial: 'Trial',
  subscription: 'Langganan',
}

export const DEVICE_STATUS_LABEL: Record<DeviceRow['status'], string> = {
  online: 'Online',
  idle: 'Idle',
  offline: 'Offline',
}

export const PLAN_LABEL: Record<Plan, string> = {
  free: 'Gratis',
  pro: 'Pro',
}

export const PLAN_TONE: Record<Plan, LabelTone> = {
  free: 'neutral',
  pro: 'success',
}

export const DEVICE_STATUS_TONE: Record<DeviceRow['status'], LabelTone> = {
  online: 'success',
  idle: 'warning',
  offline: 'neutral',
}

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Tunai',
  qris: 'QRIS',
  transfer: 'Transfer Bank',
  debit: 'Debit / EDC',
  kasbon: 'Kasbon',
  cash_cashier: 'Bayar di Kasir',
}

const PAYMENT_TONE: Record<string, LabelTone> = {
  cash: 'success',
  qris: 'info',
  transfer: 'info',
  debit: 'info',
  kasbon: 'warning',
  cash_cashier: 'neutral',
}

const ORDER_TYPE_LABEL: Record<string, string> = {
  retail: 'Retail',
  dine_in: 'Dine in',
  take_away: 'Take away',
}

export const DEBT_STATUS_LABEL: Record<DebtStatus, string> = {
  unpaid: 'Belum lunas',
  partially_paid: 'Cicilan',
  paid: 'Lunas',
}

export const DEBT_STATUS_TONE: Record<DebtStatus, LabelTone> = {
  unpaid: 'danger',
  partially_paid: 'warning',
  paid: 'success',
}

export const TABLE_ORDER_STATUS_LABEL: Record<TableOrderStatus, string> = {
  pending: 'Menunggu',
  accepted: 'Diproses',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
}

export const TABLE_ORDER_STATUS_TONE: Record<TableOrderStatus, LabelTone> = {
  pending: 'warning',
  accepted: 'info',
  completed: 'success',
  cancelled: 'neutral',
}

export const SHIFT_STATUS_LABEL: Record<ShiftStatus, string> = {
  open: 'Sedang berjalan',
  closed: 'Ditutup',
}

export const SHIFT_STATUS_TONE: Record<ShiftStatus, LabelTone> = {
  open: 'info',
  closed: 'neutral',
}

const EXPENSE_CATEGORY_LABEL: Record<string, string> = {
  operasional: 'Operasional',
  belanja: 'Belanja',
  kebersihan: 'Kebersihan',
  lainnya: 'Lainnya',
}

export function paymentLabel(method: string): string {
  return PAYMENT_LABEL[method] ?? method
}

export function paymentTone(method: string): LabelTone {
  return PAYMENT_TONE[method] ?? 'neutral'
}

export function orderTypeLabel(orderType: string): string {
  return ORDER_TYPE_LABEL[orderType] ?? orderType
}

export function expenseCategoryLabel(category: string): string {
  return EXPENSE_CATEGORY_LABEL[category] ?? category
}
