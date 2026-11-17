import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../lib/errors'
import { normalizePagination } from '../lib/pagination'
import { parseQuery } from '../lib/query'
import { listTransactions } from '../services/transactions'

const router = Router()

const optionalDateKey = z.preprocess(
  (value) => (value === '' || value === undefined ? undefined : value),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal harus berformat YYYY-MM-DD.')
    .optional(),
)

const optionalUuid = z.preprocess(
  (value) => (value === '' || value === undefined ? undefined : value),
  z.string().uuid('ID toko tidak valid.').optional(),
)

const optionalMethod = z.preprocess(
  (value) => (value === '' || value === 'all' || value === undefined ? undefined : value),
  z.enum(['cash', 'qris', 'transfer', 'debit', 'kasbon']).optional(),
)

const optionalOrderType = z.preprocess(
  (value) => (value === '' || value === 'all' || value === undefined ? undefined : value),
  z.enum(['retail', 'dine_in', 'take_away']).optional(),
)

const listQuerySchema = z.object({
  search: z.string().trim().max(120).default(''),
  storeId: optionalUuid,
  paymentMethod: optionalMethod,
  orderType: optionalOrderType,
  from: optionalDateKey,
  to: optionalDateKey,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(8),
})

router.get(
  '/transactions',
  asyncHandler(async (request, response) => {
    const query = parseQuery(listQuerySchema, request.query)
    const pagination = normalizePagination(query.page, query.pageSize)

    response.json(
      await listTransactions({
        search: query.search,
        storeId: query.storeId,
        paymentMethod: query.paymentMethod,
        orderType: query.orderType,
        from: query.from,
        to: query.to,
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
    )
  }),
)

export const transactionsRouter = router
