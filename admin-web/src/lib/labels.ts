import type { DeviceRow, LicenseStatus, LicenseType, StoreStatus } from '@/types/domain'

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

export const DEVICE_STATUS_TONE: Record<DeviceRow['status'], LabelTone> = {
  online: 'success',
  idle: 'warning',
  offline: 'neutral',
}

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Tunai',
  qris: 'QRIS',
  transfer: 'Transfer',
}

const ORDER_TYPE_LABEL: Record<string, string> = {
  retail: 'Retail',
  dine_in: 'Dine in',
  take_away: 'Take away',
}

export function paymentLabel(method: string): string {
  return PAYMENT_LABEL[method] ?? method
}

export function orderTypeLabel(orderType: string): string {
  return ORDER_TYPE_LABEL[orderType] ?? orderType
}
