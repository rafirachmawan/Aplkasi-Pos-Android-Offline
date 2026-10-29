import { delay, devices } from '@/mocks'
import { apiRequest } from '@/lib/adminApi'
import { env } from '@/lib/env'
import { supabaseNotReady } from '@/lib/notReady'
import type { DeviceRow } from '@/types/domain'

export async function fetchDevices(): Promise<DeviceRow[]> {
  if (env.isApi) {
    return apiRequest<DeviceRow[]>('/api/devices')
  }

  if (!env.isMock) supabaseNotReady()
  await delay(220)
  return devices.map((row) => ({ ...row }))
}
