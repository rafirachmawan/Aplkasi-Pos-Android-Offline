export { stores, products, transactions, licenses, devices, mockNow } from './dataset'

/** Simulasi latensi jaringan agar skeleton & loading state benar-benar teruji. */
export function delay(ms = 260): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export const sleep = delay
