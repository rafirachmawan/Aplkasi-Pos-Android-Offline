import { z } from 'zod'

export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username minimal 3 karakter')
    .max(32, 'Username terlalu panjang'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
})

export type LoginValues = z.infer<typeof loginSchema>
