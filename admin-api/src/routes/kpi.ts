import { Router } from 'express'
import { asyncHandler } from '../lib/errors'
import { getKpi } from '../services/kpi'

const router = Router()

router.get(
  '/kpi',
  asyncHandler(async (_request, response) => {
    response.json(await getKpi())
  }),
)

export const kpiRouter = router
