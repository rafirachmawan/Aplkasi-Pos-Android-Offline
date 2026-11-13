import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../lib/errors'
import { parseQuery } from '../lib/query'
import { activatePlan, listSubscriptions, resetPlan } from '../services/subscriptions'

const router = Router()

const listQuerySchema = z.object({
  search: z.string().trim().max(120).default(''),
  plan: z.enum(['all', 'free', 'pro']).default('all'),
})

const paramSchema = z.object({
  id: z.string().uuid('ID toko tidak valid.'),
})

const activateBodySchema = z.object({
  days: z.coerce
    .number({ invalid_type_error: 'Durasi harus berupa angka.' })
    .int('Durasi harus berupa bilangan bulat.')
    .min(1, 'Durasi minimal 1 hari.')
    .max(3650, 'Durasi maksimal 3650 hari.')
    .default(30),
  actor: z.string().trim().max(80, 'Nama aktor terlalu panjang.').default('admin'),
  note: z.string().trim().max(240, 'Catatan terlalu panjang.').default(''),
})

const resetBodySchema = z.object({
  actor: z.string().trim().max(80).default('admin'),
  note: z.string().trim().max(240).default(''),
})

router.get(
  '/subscriptions',
  asyncHandler(async (request, response) => {
    const query = parseQuery(listQuerySchema, request.query)
    response.json(await listSubscriptions(query))
  }),
)

router.post(
  '/stores/:id/plan',
  asyncHandler(async (request, response) => {
    const { id } = parseQuery(paramSchema, request.params)
    const body = parseQuery(activateBodySchema, request.body ?? {})

    response.status(200).json(await activatePlan(id, body.days, body.actor, body.note))
  }),
)

router.delete(
  '/stores/:id/plan',
  asyncHandler(async (request, response) => {
    const { id } = parseQuery(paramSchema, request.params)
    const body = parseQuery(resetBodySchema, request.body ?? {})

    response.json(await resetPlan(id, body.actor, body.note))
  }),
)

export const subscriptionsRouter = router
