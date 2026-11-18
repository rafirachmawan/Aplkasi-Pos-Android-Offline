import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import {
  UtensilsCrossed,
  ShoppingBag,
  Plus,
  Minus,
  Search,
  CheckCircle2,
  QrCode,
  Banknote,
  X,
  AlertCircle,
  Clock,
  ChevronRight,
} from 'lucide-react'
import { customerSupabase } from '@/lib/customerSupabase'
import { rupiah } from '@/lib/format'

interface ProductItem {
  id: string
  product_name: string
  selling_price: number
  category: string | null
  image_uri: string | null
  stock_quantity?: number
}

interface CartItem {
  product: ProductItem
  quantity: number
  notes: string
}

interface StoreInfo {
  id: string
  store_name: string
  qris_image_url: string | null
}

export function CustomerOrderPage() {
  const { storeId, tableNumber = '1' } = useParams<{ storeId: string; tableNumber: string }>()

  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null)
  const [products, setProducts] = useState<ProductItem[]>([])
  const [activeCategory, setActiveCategory] = useState<string>('Semua')
  const [searchQuery, setSearchQuery] = useState('')

  // Keranjang belanja
  const [cart, setCart] = useState<Record<string, CartItem>>({})
  const [showCartDrawer, setShowCartDrawer] = useState(false)

  // Form Checkout
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'qris' | 'cash_cashier'>('cash_cashier')
  const [generalNotes, setGeneralNotes] = useState('')
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null)
  const [paymentProofPreview, setPaymentProofPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState<any | null>(null)

  // Load data toko & produk
  useEffect(() => {
    async function loadStoreAndMenu() {
      if (!storeId) {
        setErrorMsg('Toko tidak ditemukan.')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setErrorMsg(null)

        // 1. Utamakan RPC menu publik (tidak membocorkan security_pin / capital_price).
        //    Fallback ke query langsung hanya bila RPC v11 belum dipasang di Supabase.
        const rpcRes = await customerSupabase.rpc('get_public_store_menu', {
          p_store_id: storeId,
        })

        const rpcErrCode = String(rpcRes.error?.code || '')
        const rpcErrMsg = String(rpcRes.error?.message || '').toLowerCase()
        const isMissingRpc =
          rpcErrCode === 'PGRST202' ||
          rpcErrCode === '42883' ||
          rpcErrMsg.includes('get_public_store_menu')

        if (!rpcRes.error && rpcRes.data?.store) {
          setStoreInfo(rpcRes.data.store as StoreInfo)
          setProducts((rpcRes.data.products as ProductItem[]) || [])
          return
        }

        if (!isMissingRpc) {
          if (rpcRes.error) {
            console.error('rpc menu error:', rpcRes.error)
          }
          setErrorMsg('Toko tidak ditemukan atau tautan meja tidak valid.')
          setLoading(false)
          return
        }

        // Fallback query langsung untuk kompatibilitas sebelum migration_v11
        const { data: store, error: storeErr } = await customerSupabase
          .from('stores')
          .select('id, store_name, qris_image_url')
          .eq('id', storeId)
          .maybeSingle()

        if (storeErr || !store) {
          setErrorMsg('Toko tidak ditemukan atau tautan meja tidak valid.')
          setLoading(false)
          return
        }

        setStoreInfo(store as StoreInfo)

        const { data: prods, error: prodErr } = await customerSupabase
          .from('products')
          .select('id, product_name, selling_price, category, image_uri, stock_quantity')
          .eq('store_id', storeId)
          .order('product_name', { ascending: true })

        if (prodErr) {
          console.error('prodErr:', prodErr)
          setErrorMsg('Gagal memuat daftar menu: ' + prodErr.message)
        } else {
          setProducts((prods as ProductItem[]) || [])
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'Terjadi kesalahan saat memuat menu.')
      } finally {
        setLoading(false)
      }
    }

    loadStoreAndMenu()
  }, [storeId])

  // Kategori unik dari produk
  const categories = useMemo(() => {
    const set = new Set<string>()
    products.forEach((p) => {
      if (p.category && p.category.trim()) {
        set.add(p.category.trim())
      }
    })
    return ['Semua', ...Array.from(set)]
  }, [products])

  // Filter produk
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat =
        activeCategory === 'Semua' || (p.category && p.category.trim() === activeCategory)
      const matchQuery =
        !searchQuery || p.product_name.toLowerCase().includes(searchQuery.toLowerCase().trim())
      return matchCat && matchQuery
    })
  }, [products, activeCategory, searchQuery])

  // Hitung total keranjang
  const cartList = useMemo(() => Object.values(cart), [cart])
  const cartTotalItems = useMemo(
    () => cartList.reduce((sum, item) => sum + item.quantity, 0),
    [cartList],
  )
  const cartTotalPrice = useMemo(
    () => cartList.reduce((sum, item) => sum + item.product.selling_price * item.quantity, 0),
    [cartList],
  )

  const handleAddToCart = (product: ProductItem) => {
    setCart((prev) => {
      const existing = prev[product.id]
      if (existing) {
        return {
          ...prev,
          [product.id]: { ...existing, quantity: existing.quantity + 1 },
        }
      }
      return {
        ...prev,
        [product.id]: { product, quantity: 1, notes: '' },
      }
    })
  }

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => {
      const existing = prev[productId]
      if (!existing) return prev
      if (existing.quantity <= 1) {
        const copy = { ...prev }
        delete copy[productId]
        return copy
      }
      return {
        ...prev,
        [productId]: { ...existing, quantity: existing.quantity - 1 },
      }
    })
  }

  const handleUpdateItemNotes = (productId: string, notes: string) => {
    setCart((prev) => {
      const existing = prev[productId]
      if (!existing) return prev
      return {
        ...prev,
        [productId]: { ...existing, notes },
      }
    })
  }

  const handleSelectProofFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPaymentProofFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      setPaymentProofPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmitOrder = async () => {
    if (!customerName.trim()) {
      alert('Silakan masukkan nama pemesan.')
      return
    }

    if (cartList.length === 0) {
      alert('Keranjang belanja masih kosong.')
      return
    }

    if (paymentMethod === 'qris' && !paymentProofFile) {
      alert('Silakan unggah foto bukti transfer QRIS terlebih dahulu.')
      return
    }

    try {
      setSubmitting(true)
      let uploadedProofUrl = ''

      // 1. Upload foto bukti transfer jika QRIS
      if (paymentMethod === 'qris' && paymentProofFile) {
        const fileExt = paymentProofFile.name.split('.').pop() || 'jpg'
        const fileName = `proof_${storeId}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`

        const { error: uploadError } = await customerSupabase.storage
          .from('payment_proofs')
          .upload(fileName, paymentProofFile, {
            cacheControl: '3600',
            upsert: false,
          })

        if (uploadError) {
          throw new Error('Gagal mengunggah foto bukti pembayaran: ' + uploadError.message)
        }

        const { data: urlData } = customerSupabase.storage
          .from('payment_proofs')
          .getPublicUrl(fileName)

        uploadedProofUrl = urlData.publicUrl
      }

      // 2. Utamakan RPC submit_public_table_order (hitung harga di server, paksa status 'pending').
      //    Fallback ke insert langsung hanya bila RPC v11 belum dipasang.
      const rpcItems = cartList.map((item) => ({
        product_id: item.product.id,
        name: item.product.product_name,
        price: item.product.selling_price,
        quantity: item.quantity,
        notes: item.notes.trim(),
      }))

      const rpcSubmit = await customerSupabase.rpc('submit_public_table_order', {
        p_store_id: storeId,
        p_table_number: String(tableNumber || '1'),
        p_customer_name: customerName.trim(),
        p_customer_phone: customerPhone.trim(),
        p_payment_method: paymentMethod,
        p_payment_proof_url: uploadedProofUrl,
        p_items: rpcItems,
        p_notes: generalNotes.trim(),
      })

      let insertedOrder: any = null
      if (!rpcSubmit.error && rpcSubmit.data) {
        insertedOrder = rpcSubmit.data
      } else {
        const errCode = String(rpcSubmit.error?.code || '')
        const errMsg = String(rpcSubmit.error?.message || '').toLowerCase()
        const isMissingRpc =
          errCode === 'PGRST202' ||
          errCode === '42883' ||
          errMsg.includes('submit_public_table_order')

        if (!isMissingRpc) {
          throw new Error(
            'Gagal mengirimkan pesanan: ' + (rpcSubmit.error?.message || 'Error server'),
          )
        }

        const orderPayload = {
          store_id: storeId,
          table_number: tableNumber,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          total_amount: cartTotalPrice,
          payment_method: paymentMethod,
          payment_proof_url: uploadedProofUrl,
          status: 'pending',
          items: rpcItems,
          notes: generalNotes.trim(),
        }

        const { data: fallbackOrder, error: insertError } = await customerSupabase
          .from('table_orders')
          .insert(orderPayload)
          .select()
          .single()

        if (insertError) {
          throw new Error('Gagal mengirimkan pesanan: ' + insertError.message)
        }
        insertedOrder = fallbackOrder
      }

      // Berhasil
      setOrderSuccess(insertedOrder)
      setCart({})
      setShowCartDrawer(false)
    } catch (err: any) {
      alert(err?.message || 'Terjadi kesalahan saat memproses pesanan.')
    } finally {
      setSubmitting(false)
    }
  }

  // Tampilan Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-600 font-medium text-sm">Menyiapkan daftar menu meja...</p>
      </div>
    )
  }

  // Tampilan Error
  if (errorMsg || !storeInfo) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">Tautan Tidak Tersedia</h2>
        <p className="text-slate-600 text-sm max-w-sm mb-6">{errorMsg}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 active:scale-95 transition"
        >
          Muat Ulang
        </button>
      </div>
    )
  }

  // Tampilan Sukses Setelah Pesan
  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-5 animate-bounce">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <span className="text-xs uppercase font-bold tracking-wider px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 mb-2">
          Pesanan Berhasil Dikirim
        </span>
        <h1 className="text-xl font-black text-slate-900 mb-1">{storeInfo.store_name}</h1>
        <p className="text-sm font-bold text-amber-600 mb-6">Meja {tableNumber}</p>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 w-full max-w-sm text-left shadow-sm mb-6">
          <div className="flex justify-between items-center text-xs text-slate-500 pb-3 border-b border-slate-100">
            <span>Pemesan: <strong className="text-slate-800">{orderSuccess.customer_name}</strong></span>
            <span>{new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          <div className="py-3 space-y-2 border-b border-slate-100">
            {orderSuccess.items?.map((it: any, idx: number) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-slate-700">
                  {it.quantity}x {it.name}
                  {it.notes ? <span className="block text-xs text-slate-400 italic">"{it.notes}"</span> : null}
                </span>
                <span className="font-semibold text-slate-900">{rupiah(it.price * it.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-3 text-sm">
            <span className="font-bold text-slate-700">Total Tagihan</span>
            <span className="font-black text-emerald-600 text-base">{rupiah(orderSuccess.total_amount)}</span>
          </div>

          <div className="mt-4 p-3 bg-slate-50 rounded-xl text-xs text-slate-600 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              {orderSuccess.payment_method === 'qris'
                ? 'Pembayaran QRIS sedang diverifikasi kasir. Pesanan Anda akan segera dimasak.'
                : 'Silakan lakukan pembayaran langsung ke meja kasir saat selesai makan.'}
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            setOrderSuccess(null)
            setCustomerName('')
            setGeneralNotes('')
            setPaymentProofFile(null)
            setPaymentProofPreview(null)
          }}
          className="w-full max-w-sm py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 active:scale-95 transition"
        >
          Pesan Menu Lainnya
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      {/* ── HEADER TOKO & MEJA ── */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3 shadow-xs">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <UtensilsCrossed className="w-4 h-4 text-emerald-600" />
              <h1 className="font-black text-slate-900 text-base leading-tight">
                {storeInfo.store_name}
              </h1>
            </div>
            <p className="text-xs text-slate-500 font-medium">Buku Menu Mandiri Meja</p>
          </div>
          <div className="bg-amber-100 text-amber-900 px-3 py-1 rounded-full font-black text-xs flex items-center gap-1 border border-amber-300 shadow-xs">
            <span>MEJA</span>
            <span className="text-sm">{tableNumber}</span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="max-w-md mx-auto mt-2.5 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari makanan atau minuman..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
          />
        </div>
      </header>

      {/* ── KATEGORI PILLS ── */}
      <div className="sticky top-[105px] z-10 bg-slate-50/95 backdrop-blur px-4 py-2 border-b border-slate-200">
        <div className="max-w-md mx-auto flex gap-2 overflow-x-auto no-scrollbar py-0.5">
          {categories.map((cat) => {
            const isActive = activeCategory === cat
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {cat}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── DAFTAR MENU ── */}
      <main className="max-w-md mx-auto px-4 pt-4 space-y-3">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            <UtensilsCrossed className="w-10 h-10 mx-auto mb-2 opacity-40" />
            Tidak ada menu yang sesuai.
          </div>
        ) : (
          filteredProducts.map((product) => {
            const inCartItem = cart[product.id]
            const qty = inCartItem?.quantity || 0

            return (
              <div
                key={product.id}
                className="bg-white border border-slate-200 rounded-2xl p-3.5 flex gap-3 shadow-xs hover:border-slate-300 transition"
              >
                {/* Gambar Produk */}
                <div className="w-20 h-20 bg-slate-100 rounded-xl overflow-hidden shrink-0 flex items-center justify-center border border-slate-100">
                  {product.image_uri ? (
                    <img
                      src={product.image_uri}
                      alt={product.product_name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        ;(e.target as HTMLElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <UtensilsCrossed className="w-7 h-7 text-slate-300" />
                  )}
                </div>

                {/* Detail Produk */}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm leading-snug">
                      {product.product_name}
                    </h3>
                    {product.category && (
                      <span className="inline-block text-[10px] font-semibold text-slate-400 mt-0.5">
                        {product.category}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <span className="font-black text-slate-900 text-sm">
                      {rupiah(product.selling_price)}
                    </span>

                    {/* Tombol Tambah / Qty Control */}
                    {qty === 0 ? (
                      <button
                        onClick={() => handleAddToCart(product)}
                        className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-xs hover:bg-emerald-700 active:scale-95 transition flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Tambah
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1 border border-slate-200">
                        <button
                          onClick={() => handleRemoveFromCart(product.id)}
                          className="w-6 h-6 bg-white rounded-md flex items-center justify-center text-slate-700 hover:bg-slate-200 active:scale-90 transition shadow-xs"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-black text-slate-900 px-1">{qty}</span>
                        <button
                          onClick={() => handleAddToCart(product)}
                          className="w-6 h-6 bg-emerald-600 rounded-md flex items-center justify-center text-white hover:bg-emerald-700 active:scale-90 transition shadow-xs"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </main>

      {/* ── BOTTOM STICKY BAR KERANJANG ── */}
      {cartTotalItems > 0 && !showCartDrawer && (
        <div className="fixed bottom-4 left-0 right-0 z-30 px-4">
          <div className="max-w-md mx-auto">
            <button
              onClick={() => setShowCartDrawer(true)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl p-3.5 flex items-center justify-between shadow-xl shadow-emerald-600/25 active:scale-98 transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center font-black text-sm">
                  {cartTotalItems}
                </div>
                <div className="text-left">
                  <p className="text-[11px] text-emerald-100 font-semibold leading-tight">Total Pesanan Meja {tableNumber}</p>
                  <p className="font-black text-base leading-tight">{rupiah(cartTotalPrice)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 font-bold text-sm bg-white/10 px-3 py-1.5 rounded-xl">
                <span>Lihat Pesanan</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL DRAWER CHECKOUT & KERANJANG ── */}
      {showCartDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end justify-center">
          <div className="bg-white w-full max-w-md max-h-[92vh] rounded-t-3xl flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200">
            {/* Header Modal */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-black text-slate-900 text-base">Konfirmasi Pesanan Meja {tableNumber}</h2>
                <p className="text-xs text-slate-500 font-medium">{storeInfo.store_name}</p>
              </div>
              <button
                onClick={() => setShowCartDrawer(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-4 overflow-y-auto space-y-4">
              {/* Daftar Item */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Daftar Menu Dipilih</h3>
                {cartList.map((item) => (
                  <div key={item.product.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{item.product.product_name}</p>
                        <p className="text-xs text-slate-500">{rupiah(item.product.selling_price)}</p>
                      </div>
                      <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-slate-200 shadow-2xs">
                        <button
                          onClick={() => handleRemoveFromCart(item.product.id)}
                          className="w-6 h-6 flex items-center justify-center text-slate-700 hover:bg-slate-100 rounded"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold px-1">{item.quantity}</span>
                        <button
                          onClick={() => handleAddToCart(item.product)}
                          className="w-6 h-6 bg-emerald-600 text-white flex items-center justify-center rounded"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Catatan Khusus per Item */}
                    <input
                      type="text"
                      placeholder="Catatan menu (misal: less sugar, pedas, tanpa es)..."
                      value={item.notes}
                      onChange={(e) => handleUpdateItemNotes(item.product.id, e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                ))}
              </div>

              {/* Form Identitas Pemesan */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Identitas Pemesan</h3>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Atas Nama Pemesan *</label>
                  <input
                    type="text"
                    placeholder="Contoh: Budi Santoso"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nomor WhatsApp (Opsional)</label>
                  <input
                    type="tel"
                    placeholder="Contoh: 08123456789"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Pilihan Metode Pembayaran */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Metode Pembayaran</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash_cashier')}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-1.5 ${
                      paymentMethod === 'cash_cashier'
                        ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-bold'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <Banknote className={`w-5 h-5 ${paymentMethod === 'cash_cashier' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <div>
                      <p className="text-xs">Bayar di Kasir</p>
                      <p className="text-[10px] text-slate-400 font-normal">Tunai / saat selesai</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('qris')}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-1.5 ${
                      paymentMethod === 'qris'
                        ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-bold'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <QrCode className={`w-5 h-5 ${paymentMethod === 'qris' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <div>
                      <p className="text-xs">QRIS Instan</p>
                      <p className="text-[10px] text-slate-400 font-normal">Scan & upload bukti</p>
                    </div>
                  </button>
                </div>

                {/* Box QRIS & Upload Bukti jika metode QRIS */}
                {paymentMethod === 'qris' && (
                  <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-3">
                    <div className="text-center">
                      <p className="text-xs font-bold text-amber-900 mb-1">Scan QRIS Resmi Toko</p>
                      <p className="text-[11px] text-amber-700">Total Transfer: <strong className="text-sm font-black text-amber-950">{rupiah(cartTotalPrice)}</strong></p>
                    </div>

                    {storeInfo.qris_image_url ? (
                      <div className="w-48 h-48 mx-auto bg-white border border-slate-200 rounded-xl overflow-hidden p-2 flex items-center justify-center shadow-xs">
                        <img
                          src={storeInfo.qris_image_url}
                          alt="QRIS Toko"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="p-4 bg-white border border-dashed border-amber-300 rounded-xl text-center text-xs text-amber-800">
                        <QrCode className="w-8 h-8 mx-auto mb-1 text-amber-600" />
                        QRIS toko tersedia di meja atau hubungi kasir.
                      </div>
                    )}

                    {/* Upload Bukti Bayar */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Foto Bukti Pembayaran *
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleSelectProofFile}
                        className="text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200 cursor-pointer"
                      />
                      {paymentProofPreview && (
                        <div className="mt-2 w-24 h-24 rounded-lg overflow-hidden border border-slate-200">
                          <img src={paymentProofPreview} alt="Bukti" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Checkout */}
            <div className="p-4 border-t border-slate-100 bg-white">
              <div className="flex justify-between items-center mb-3 text-sm">
                <span className="font-bold text-slate-600">Total Tagihan</span>
                <span className="font-black text-slate-900 text-lg">{rupiah(cartTotalPrice)}</span>
              </div>
              <button
                disabled={submitting}
                onClick={handleSubmitOrder}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl shadow-lg shadow-emerald-600/20 active:scale-98 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <span>Mengirimkan Pesanan...</span>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>Kirim Pesanan ke Dapur</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
