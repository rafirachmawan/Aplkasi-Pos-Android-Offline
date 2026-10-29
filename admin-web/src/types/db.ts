// Tipe minimal tabel Supabase yang dipakai admin.
// Dipakai pada fase integrasi; tidak aktif selama mode mock.
export interface Database {
  public: {
    Tables: {
      stores: {
        Row: {
          id: string
          store_name: string
          created_at: string
        }
      }
      profiles: {
        Row: {
          id: string
          username: string
          role: 'kasir' | 'super_admin'
          store_id: string
          created_at: string
        }
      }
      app_licenses: {
        Row: {
          id: string
          device_id: string
          store_id: string | null
          license_key: string
          license_type: string
          status: string
          activated_at: string
          expires_at: string | null
          notes: string
        }
      }
      transactions: {
        Row: {
          id: string
          store_id: string
          invoice_number: string
          grand_total: number
          payment_method: string
          created_at: string
        }
      }
      products: {
        Row: {
          id: string
          store_id: string
          product_name: string
          category: string
          unit: string
          stock_quantity: number
          min_stock_threshold: number
          selling_price: number
        }
      }
    }
  }
}
