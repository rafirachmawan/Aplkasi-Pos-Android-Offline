import { env } from '../env'
import { HttpError } from './errors'

interface QueryPage {
  data: unknown[] | null
  error: { message: string } | null
}

const PAGE_SIZE = 1_000

/**
 * Mengambil seluruh baris dengan pagination PostgREST.
 *
 * Batas `maxRows` mencegah query tak terduga menarik seluruh tabel produksi.
 * Jika batas terlampaui, console menerima pesan yang mengarahkan ke Opsi C.
 */
export async function fetchAll<T>(
  label: string,
  fetchPage: (from: number, to: number) => PromiseLike<QueryPage>,
  maxRows = env.maxScanRows,
): Promise<T[]> {
  const rows: T[] = []
  let from = 0

  for (;;) {
    const to = Math.min(from + PAGE_SIZE - 1, maxRows - 1)
    const { data, error } = await fetchPage(from, to)

    if (error) {
      throw new HttpError(502, `Gagal membaca ${label}: ${error.message}`)
    }

    const batch = (data ?? []) as T[]
    rows.push(...batch)

    if (batch.length < to - from + 1) return rows

    from += PAGE_SIZE

    if (from >= maxRows) {
      throw new HttpError(
        413,
        `Data ${label} melebihi batas ${maxRows.toLocaleString('id-ID')} baris. ` +
          'Naikkan MAX_SCAN_ROWS bila perlu, atau gunakan Opsi C (RPC) untuk data besar.',
      )
    }
  }
}
