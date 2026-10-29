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
 * Lapisan pengaman tambahan: service_role punya akses penuh, jadi server ini
 * menolak semua metode tulis kecuali endpoint login yang sudah ditangani
 * sebelum middleware ini.
 */
export const readOnlyGuard: RequestHandler = (request, response, next) => {
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
    next()
    return
  }

  response.status(405).json({
    error: 'Admin API berjalan dalam mode baca (Opsi B).',
    code: 'read_only',
  })
}
