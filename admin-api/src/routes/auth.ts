import { Router } from 'express'
import { z } from 'zod'
import { env } from '../env'
import { asyncHandler } from '../lib/errors'
import { safeEqual } from '../lib/secureCompare'
import type { AdminSessionDto } from '../types'
import { requireApiToken } from '../middleware/auth'

const router = Router()

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username wajib diisi.'),
  password: z.string().min(1, 'Password wajib diisi.'),
})

interface Attempt {
  count: number
  resetAt: number
}

const attempts = new Map<string, Attempt>()
const WINDOW_MS = 5 * 60_000
const MAX_ATTEMPTS = 10

function clientKey(ip: string | undefined): string {
  return ip ?? 'unknown'
}

function isRateLimited(key: string): boolean {
  const attempt = attempts.get(key)
  if (!attempt) return false
  if (attempt.resetAt <= Date.now()) {
    attempts.delete(key)
    return false
  }
  return attempt.count >= MAX_ATTEMPTS
}

function registerFailure(key: string): void {
  const now = Date.now()
  const attempt = attempts.get(key)

  if (!attempt || attempt.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return
  }

  attempt.count += 1
}

function currentSession(): AdminSessionDto {
  return {
    name: env.adminName,
    username: env.adminUsername,
    role: 'super_admin',
    loggedInAt: new Date().toISOString(),
  }
}

router.post(
  '/login',
  asyncHandler(async (request, response) => {
    const key = clientKey(request.ip)

    if (isRateLimited(key)) {
      response.status(429).json({
        error: 'Terlalu banyak percobaan login. Coba lagi dalam 5 menit.',
      })
      return
    }

    const parsed = loginSchema.safeParse(request.body)

    if (!parsed.success) {
      response.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Data login tidak valid.' })
      return
    }

    const { username, password } = parsed.data
    const validUsername = safeEqual(username.toLowerCase(), env.adminUsername.toLowerCase())
    const validPassword = safeEqual(password, env.adminPassword)

    if (!validUsername || !validPassword) {
      registerFailure(key)
      response.status(401).json({ error: 'Username atau password salah.' })
      return
    }

    attempts.delete(key)
    response.setHeader('Cache-Control', 'no-store')
    response.json({
      token: env.apiToken,
      session: currentSession(),
    })
  }),
)

router.get('/session', requireApiToken, (_request, response) => {
  response.setHeader('Cache-Control', 'no-store')
  response.json({ session: currentSession() })
})

export const authRouter = router
