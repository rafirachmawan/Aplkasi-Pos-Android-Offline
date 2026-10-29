import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'

const schema = z.object({
  SUPABASE_URL: z.string().url('SUPABASE_URL harus berupa URL valid.'),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(20, 'SUPABASE_SERVICE_ROLE_KEY belum diisi.'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(8787),
  ALLOWED_ORIGIN: z
    .string()
    .default('http://localhost:5173,http://127.0.0.1:5173'),
  ADMIN_USERNAME: z.string().min(1).default('admin'),
  ADMIN_PASSWORD: z.string().min(6, 'ADMIN_PASSWORD minimal 6 karakter.').default('admin123'),
  ADMIN_NAME: z.string().min(1).default('Super Admin'),
  API_TOKEN: z.string().min(16).optional(),
  CACHE_TTL_MS: z.coerce.number().int().min(0).default(30_000),
  MAX_SCAN_ROWS: z.coerce.number().int().positive().default(20_000),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  console.error('\n[admin-api] Konfigurasi .env tidak valid:')
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.') || 'env'}: ${issue.message}`)
  }
  console.error('\nSalin admin-api/.env.example menjadi admin-api/.env lalu isi nilainya.\n')
  process.exit(1)
}

const data = parsed.data

/** Membaca klaim `role` dari JWT Supabase tanpa memverifikasi tanda tangan. */
function jwtRole(key: string): string | null {
  const parts = key.split('.')
  if (parts.length !== 3) return null

  const payload = parts[1]
  if (!payload) return null

  try {
    const parsedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      role?: unknown
    }
    return typeof parsedPayload.role === 'string' ? parsedPayload.role : null
  } catch {
    return null
  }
}

const role = jwtRole(data.SUPABASE_SERVICE_ROLE_KEY)
if (role && role !== 'service_role') {
  console.error(
    '\n[admin-api] SUPABASE_SERVICE_ROLE_KEY bukan service_role key.\n' +
      'Kunci anon tidak bisa membaca data lintas toko. Ambil service_role key dari\n' +
      'Supabase Dashboard -> Project Settings -> API -> Project API keys.\n',
  )
  process.exit(1)
}

const generatedToken = !data.API_TOKEN

export const env = {
  supabaseUrl: data.SUPABASE_URL.replace(/\/$/, ''),
  supabaseServiceRoleKey: data.SUPABASE_SERVICE_ROLE_KEY,
  host: data.HOST,
  port: data.PORT,
  allowedOrigins: data.ALLOWED_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  adminUsername: data.ADMIN_USERNAME,
  adminPassword: data.ADMIN_PASSWORD,
  adminName: data.ADMIN_NAME,
  apiToken: data.API_TOKEN ?? randomBytes(24).toString('hex'),
  tokenGenerated: generatedToken,
  cacheTtlMs: data.CACHE_TTL_MS,
  maxScanRows: data.MAX_SCAN_ROWS,
  isDefaultPassword: data.ADMIN_PASSWORD === 'admin123',
} as const
