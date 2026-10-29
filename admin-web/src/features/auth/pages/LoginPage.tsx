import { zodResolver } from '@hookform/resolvers/zod'
import { Boxes, CheckCircle2, Lock, User, Wand2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/features/auth/auth-context'
import { useLogin } from '@/features/auth/hooks/useLogin'
import { loginSchema, type LoginValues } from '@/features/auth/schema'
import { env } from '@/lib/env'

const HIGHLIGHTS = [
  'Pantau seluruh toko dalam satu dashboard.',
  'Kelola lisensi perangkat tanpa menyentuh data penjualan.',
  'Telusuri transaksi lintas toko dengan filter cepat.',
]

export function LoginPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const { submit, isPending, error } = useLogin()

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  })

  if (session) return <Navigate to="/" replace />

  const onSubmit = handleSubmit(async (values) => {
    const success = await submit(values)
    if (success) navigate('/', { replace: true })
  })

  const fillDemo = () => {
    setValue('username', 'admin', { shouldValidate: true })
    setValue('password', 'admin123', { shouldValidate: true })
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-ink p-10 lg:flex xl:p-14">
        <div
          className="pointer-events-none absolute -right-32 -top-32 size-96 rounded-full bg-emerald-500/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-40 -left-24 size-96 rounded-full bg-sky-500/10 blur-3xl"
          aria-hidden
        />

        <div className="relative flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500 text-white">
            <Boxes className="size-5" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-white">MarketPos</p>
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Admin Console
            </p>
          </div>
        </div>

        <div className="relative max-w-md">
          <span className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
            Khusus super admin
          </span>
          <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl">
            Kendali penuh atas jaringan toko Anda.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Satu tempat untuk memantau performa toko, status perangkat, dan aktivitas penjualan.
          </p>

          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[13px] text-slate-300">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[11px] text-slate-500">
          {env.isApi
            ? 'v0.1.0 · API lokal read-only · Data asli melalui admin-api'
            : 'v0.1.0 · Mode pengembangan lokal · Data contoh, bukan data produksi'}
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex size-9 items-center justify-center rounded-lg bg-ink text-white">
              <Boxes className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight text-ink">MarketPos</p>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Admin Console
              </p>
            </div>
          </div>

          <h2 className="text-xl font-bold tracking-tight text-ink">Masuk ke console</h2>
          <p className="mt-1 text-sm text-slate-500">
            Gunakan akun super admin untuk melanjutkan.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <Input
              label="Username"
              placeholder="superadmin"
              autoComplete="username"
              icon={<User className="size-4" />}
              error={errors.username?.message}
              {...register('username')}
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              icon={<Lock className="size-4" />}
              error={errors.password?.message}
              {...register('password')}
            />

            {error ? (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
              >
                {error}
              </div>
            ) : null}

            <Button type="submit" loading={isPending} className="w-full">
              {isPending ? 'Memeriksa…' : 'Masuk'}
            </Button>
          </form>

          <div className="mt-6 rounded-lg border border-dashed border-line bg-slate-50/70 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {env.isApi ? 'Akun default' : 'Akun demo'}
                </p>
                <p className="mt-1 font-mono text-xs text-slate-700">admin / admin123</p>
                {env.isApi ? (
                  <p className="mt-1 text-[10px] text-slate-500">
                    Kecuali diubah di <span className="font-mono">admin-api/.env</span>
                  </p>
                ) : null}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fillDemo}
                icon={<Wand2 className="size-3.5" />}
              >
                Isi
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
