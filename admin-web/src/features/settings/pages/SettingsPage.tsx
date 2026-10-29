import { Database, Info, KeyRound, ShieldCheck, UserCog } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/features/auth/auth-context'
import { env } from '@/lib/env'
import { formatDateTime } from '@/lib/format'

const MODE_LABEL = env.isApi
  ? 'API lokal (read-only)'
  : env.isMock
    ? 'Mock (localhost)'
    : 'Supabase'

const BACKEND_LABEL = env.isApi ? 'admin-api (server lokal)' : 'Supabase (belum aktif)'
const SECURITY_LABEL = env.isApi ? 'Token API + read-only' : 'Anon key + RLS'

const INFO_TEXT = env.isApi
  ? 'Console membaca data asli melalui admin-api di localhost. Server memegang service_role, seluruh endpoint hanya GET, dan browser tidak pernah menerima kunci tersebut.'
  : env.isMock
    ? 'Console berjalan dengan data contoh dan tidak terhubung ke database produksi. Integrasi Supabase baru dijalankan setelah migrasi role super_admin dan kebijakan RLS disetujui.'
    : 'Mode Supabase belum diaktifkan. Jalankan migrasi Opsi C terlebih dahulu, lalu ganti VITE_DATA_MODE.'

export function SettingsPage() {
  const { session } = useAuth()
  const toast = useToast()

  const [name, setName] = useState(session?.name ?? 'Super Admin')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const handleProfileSubmit = (event: FormEvent) => {
    event.preventDefault()
    toast.success('Profil admin disimpan (belum tersimpan ke server).')
  }

  const handlePasswordSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (!currentPassword) {
      setPasswordError('Password saat ini wajib diisi.')
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('Password baru minimal 8 karakter.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Konfirmasi password tidak sama.')
      return
    }

    setPasswordError(null)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    toast.success('Password diperbarui (belum tersimpan ke server).')
  }

  return (
    <>
      <PageHeader
        title="Pengaturan"
        description="Kelola profil admin dan preferensi console."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Profil admin" description="Informasi akun yang sedang aktif" />
          <form onSubmit={handleProfileSubmit} className="space-y-3 p-5">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <UserCog className="size-4" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-ink">{session?.username}</p>
                <p className="text-[11px] text-slate-500">Login {formatDateTime(session?.loggedInAt ?? null)}</p>
              </div>
            </div>

            <Input label="Nama tampilan" value={name} onChange={(event) => setName(event.target.value)} />
            <Input label="Username" value={session?.username ?? ''} disabled />
            <Input label="Peran" value="super_admin" disabled />

            <div className="pt-1">
              <Button type="submit" size="sm">
                Simpan profil
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader title="Keamanan" description="Ganti password akun super admin" />
          <form onSubmit={handlePasswordSubmit} className="space-y-3 p-5">
            <Input
              label="Password saat ini"
              type="password"
              placeholder="••••••••"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
            />
            <Input
              label="Password baru"
              type="password"
              placeholder="Minimal 8 karakter"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
            />
            <Input
              label="Konfirmasi password baru"
              type="password"
              placeholder="Ulangi password baru"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              error={passwordError ?? undefined}
              autoComplete="new-password"
            />

            <div className="pt-1">
              <Button type="submit" size="sm" icon={<KeyRound className="size-3.5" />}>
                Perbarui password
              </Button>
            </div>
          </form>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Informasi sistem" description="Status lingkungan pengembangan" />
          <div className="grid gap-4 p-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Mode data</p>
              <p className="mt-1 inline-flex items-center gap-1.5 font-medium text-ink">
                <Database className="size-3.5 text-emerald-600" /> {MODE_LABEL}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Versi console</p>
              <p className="mt-1 font-medium text-ink">v0.1.0</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Backend</p>
              <p className="mt-1 font-medium text-ink">{BACKEND_LABEL}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Keamanan</p>
              <p className="mt-1 inline-flex items-center gap-1.5 font-medium text-ink">
                <ShieldCheck className="size-3.5 text-emerald-600" /> {SECURITY_LABEL}
              </p>
            </div>
          </div>

          <div className="mx-5 mb-5 flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-3 text-[12px] leading-relaxed text-sky-900">
            <Info className="mt-0.5 size-4 shrink-0 text-sky-600" />
            <p>{INFO_TEXT}</p>
          </div>
        </Card>
      </div>
    </>
  )
}
