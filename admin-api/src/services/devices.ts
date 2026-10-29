import type { DeviceDto } from '../types'

/**
 * Heartbeat perangkat belum ada di aplikasi client, jadi console tidak
 * menampilkan status online/offline palsu. Kolom "terakhir aktif" akan kosong.
 */
export async function listDevices(): Promise<DeviceDto[]> {
  return []
}
