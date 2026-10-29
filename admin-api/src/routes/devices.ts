import { Router } from 'express'
import { asyncHandler } from '../lib/errors'
import { listDevices } from '../services/devices'

const router = Router()

router.get(
  '/devices',
  asyncHandler(async (_request, response) => {
    response.json(await listDevices())
  }),
)

export const devicesRouter = router
