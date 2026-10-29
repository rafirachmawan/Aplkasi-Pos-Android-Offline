import cors, { type CorsOptions } from 'cors'
import express, { type ErrorRequestHandler } from 'express'
import { env } from './env'
import { HttpError } from './lib/errors'
import { readOnlyGuard, requireApiToken } from './middleware/auth'
import { authRouter } from './routes/auth'
import { devicesRouter } from './routes/devices'
import { kpiRouter } from './routes/kpi'
import { licensesRouter } from './routes/licenses'
import { storesRouter } from './routes/stores'
import { transactionsRouter } from './routes/transactions'

const app = express()

app.disable('x-powered-by')

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || env.allowedOrigins.includes(origin)) {
      callback(null, true)
      return
    }
    callback(new HttpError(403, `Origin ${origin} tidak diizinkan.`))
  },
  methods: ['GET', 'HEAD', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-token'],
  maxAge: 600,
}

app.use(cors(corsOptions))
app.use(express.json({ limit: '16kb' }))

app.get('/health', (_request, response) => {
  response.json({
    ok: true,
    service: 'marketpos-admin-api',
    mode: 'option-b-read-only',
    now: new Date().toISOString(),
    cacheTtlMs: env.cacheTtlMs,
  })
})

app.get('/', (_request, response) => {
  response.json({
    service: 'MarketPos Admin API',
    mode: 'read-only',
    docs: 'Lihat admin-api/README.md',
    health: '/health',
    login: 'POST /api/auth/login',
  })
})

// Login harus dapat diakses sebelum guard token.
app.use('/api/auth', authRouter)

// Semua endpoint data: wajib token + hanya baca.
app.use('/api', requireApiToken)
app.use('/api', readOnlyGuard)

app.use('/api', kpiRouter)
app.use('/api', storesRouter)
app.use('/api', transactionsRouter)
app.use('/api', licensesRouter)
app.use('/api', devicesRouter)

app.use((_request, response) => {
  response.status(404).json({ error: 'Endpoint tidak ditemukan.' })
})

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: error.message })
    return
  }

  if (error instanceof SyntaxError && 'body' in error) {
    response.status(400).json({ error: 'Body JSON tidak valid.' })
    return
  }

  console.error('[admin-api] Kesalahan tak terduga:', error)
  response.status(500).json({ error: 'Terjadi kesalahan pada server lokal.' })
}

app.use(errorHandler)

const server = app.listen(env.port, env.host, () => {
  const url = `http://${env.host}:${env.port}`

  console.log('\n[admin-api] MarketPos Admin API (Opsi B)')
  console.log(`  URL    : ${url}`)
  console.log('  Akses  : read-only (GET), service_role tetap di server')
  console.log(`  Cache  : ${env.cacheTtlMs} ms`)
  console.log(`  Login  : ${env.adminUsername}`)
  console.log('  Health : /health')

  if (env.tokenGenerated) {
    console.log('  Token  : dibuat otomatis dan diberikan ke console saat login')
  }
  if (env.isDefaultPassword) {
    console.warn('  PERINGATAN: ADMIN_PASSWORD masih default (admin123). Ganti di .env.')
  }
  if (env.host !== '127.0.0.1' && env.host !== 'localhost') {
    console.warn(`  PERINGATAN: server mendengarkan ${env.host}, bukan loopback saja.`)
  }
  console.log('')
})

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `\n[admin-api] Port ${env.port} sudah dipakai. Hentikan proses lain atau ubah PORT di .env.\n`,
    )
    process.exit(1)
  }

  console.error('[admin-api] Gagal menjalankan server:', error)
  process.exit(1)
})

function shutdown(): void {
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
