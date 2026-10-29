import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../lib/errors'
import { normalizePagination } from '../lib/pagination'
import { parseQuery } from '../lib/query'
import { getStoreDetail, listStores } from '../services/stores'

const router = Router()

const listQuerySchema = z.object({
  search: z.string().trim().max(120).default(''),
  status: z.enum(['all', 'active', 'trial', 'inactive']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(8),
})

const paramSchema = z.object({
  id: z.string().uuid('ID toko tidak valid.'),
})

router.get(
  '/stores',
  asyncHandler(async (request, response) => {
    const query = parseQuery(listQuerySchema, request.query)
    const pagination = normalizePagination(query.page, query.pageSize)

    response.json(
      await listStores({
        search: query.search,
        status: query.status,
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
    )
  }),
)

router.get(
  '/stores/:id',
  asyncHandler(async (request, response) => {
    const { id } = parseQuery(paramSchema, request.params)
    response.json(await getStoreDetail(id))
  }),
)

export const storesRouter = router
