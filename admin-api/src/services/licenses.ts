import { buildStoreNameMap, mapLicense } from '../lib/mapping'
import type { LicenseDto, LicenseStatus } from '../types'
import { loadDataset } from './dataset'

export interface LicenseListQuery {
  search: string
  status: LicenseStatus | 'all'
}

export async function listLicenses({ search, status }: LicenseListQuery): Promise<LicenseDto[]> {
  const dataset = await loadDataset()
  const storeNameById = buildStoreNameMap(dataset.stores)
  const keyword = search.trim().toLowerCase()

  return dataset.licenses
    .map((license) => mapLicense(license, storeNameById))
    .filter((license) => {
      const matchKeyword =
        !keyword ||
        license.deviceId.toLowerCase().includes(keyword) ||
        license.storeName.toLowerCase().includes(keyword)
      const matchStatus = status === 'all' || license.status === status
      return matchKeyword && matchStatus
    })
}
