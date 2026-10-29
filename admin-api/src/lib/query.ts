import type { z } from 'zod'
import { HttpError } from './errors'

export function parseQuery<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value)

  if (!result.success) {
    const issue = result.error.issues[0]
    throw new HttpError(400, issue?.message ?? 'Parameter permintaan tidak valid.')
  }

  return result.data
}
