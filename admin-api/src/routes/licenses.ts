import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../lib/errors'
import { parseQuery } from '../lib/query'
import { listLicenses } from '../services/licenses'

const router = Router()

const listQuerySchema = z.object({
  search: z.string().trim().max(120).default(''),
  status: z.enum(['all', 'active', 'expired', 'revoked']).default('all'),
})

router.get(
  '/licenses',
  asyncHandler(async (request, response) => {
    const query = parseQuery(listQuerySchema, request.query)
    response.json(await listLicenses(query))
  }),
)

export const licensesRouter = router
