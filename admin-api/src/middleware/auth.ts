import type { RequestHandler } from 'express'
import { env } from '../env'
import { safeEqual } from '../lib/secureCompare'

export const requireApiToken: RequestHandler = (request, response, next) => {
  const token = request.header('x-api-token')

  if (!token || !safeEqual(token, env.apiToken)) {
    response.status(401).json({
      error: 'Sesi API tidak valid. Silakan login ulang.',
      code: 'unauthorized',
    })
    return
  }

  next()
}

/**
 * Endpoint yang boleh menulis data. Semua metode tulis lain tetap ditolak.
 *
 * Daftar ini sengaja dibuat sempit: service_role punya akses penuh, jadi
 * satu path yang salah izinkan bisa berarti perubahan data tak terduga.
 * Setiap entri wajib diawali `/` dan menunjuk ke router yang sudah
 * dipasang setelah `requireApiToken`.
 */
const WRITE_ALLOWLIST: readonly RegExp[] = [
  // Aktifkan / perpanjang / kembalikan tier langganan toko (migrasi v9).
  // Pola `/api` opsional supaya tetap cocok bila Express tidak memotong
  // mount path saat membaca `request.path`.
  /^(\/api)?\/stores\/[0-9a-fA-F-]{36}\/plan$/,
]

export const readOnlyGuard: RequestHandler = (request, response, next) => {
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
    next()
    return
  }

  if (WRITE_ALLOWLIST.some((pattern) => pattern.test(request.path))) {
    next()
    return
  }

  response.status(405).json({
    error: 'Admin API hanya mengizinkan pembacaan, kecuali pengaturan langganan.',
    code: 'read_only',
  })
}
