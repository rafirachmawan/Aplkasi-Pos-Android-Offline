import { formatRupiah } from './helpers';

// ── WhatsApp text message generator ─────────────────────────────────────────
export const generateWAMessage = (transaction, details, storeProfile) => {
  const storeName    = storeProfile?.storeName    || 'Toko Kelontong';
  const storeAddress = storeProfile?.storeAddress || '';
  const storeContact = storeProfile?.storeContact || '';
  const footerMessage = storeProfile?.footerMessage || 'Terima kasih telah berbelanja!';

  const date = new Date(transaction.created_at).toLocaleString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const SEP  = '━━━━━━━━━━━━━━━━━━━━━━';
  const LINE = '─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─';

  const itemLines = details.map(item => {
    const subtotal = formatRupiah(item.quantity * item.price_at_sale);
    const price    = formatRupiah(item.price_at_sale);
    return `  ${item.product_name}\n  ${item.quantity} pcs × ${price} = *${subtotal}*`;
  }).join('\n');

  const discountLine = transaction.discount_amount > 0
    ? `\n🏷️ Diskon       : -${formatRupiah(transaction.discount_amount)}` : '';

  const paymentMethod = String(transaction.payment_method || 'cash').toUpperCase();
  let paymentLines = [];
  if (paymentMethod === 'CASH' || paymentMethod === 'TUNAI') {
    paymentLines = [
      `💵 Tunai      : ${formatRupiah(transaction.cash_received)}`,
      `🔄 Kembalian  : *${formatRupiah(transaction.cash_return)}*`,
    ];
  } else {
    paymentLines = [
      `💳 Metode     : *${paymentMethod}*`,
      `💵 Bayar      : ${formatRupiah(transaction.grand_total)} (Lunas)`,
    ];
  }

  // Info meja & tipe pesanan jika mode Kafe/F&B
  const fnbLines = [];
  if (transaction.table_number) {
    fnbLines.push(`🪑 Meja        : *${transaction.table_number}*`);
  }
  if (transaction.order_type && transaction.order_type !== 'retail') {
    const typeLabel = transaction.order_type === 'dine_in' ? 'Makan di Tempat (Dine In)' : 'Bawa Pulang (Take Away)';
    fnbLines.push(`🍽️ Pesanan     : ${typeLabel}`);
  }

  const lines = [
    `🧾 *NOTA BELANJA RESMI*`,
    `*${storeName.toUpperCase()}*`,
    storeAddress ? `📍 ${storeAddress}` : null,
    storeContact ? `📞 ${storeContact}` : null,
    SEP,
    `📋 No. Nota  : *${transaction.invoice_number}*`,
    `📅 Tanggal   : ${date}`,
    ...fnbLines,
    SEP,
    `*📦 DETAIL PEMBELIAN:*`,
    LINE,
    itemLines,
    LINE,
    `💰 Subtotal   : ${formatRupiah(transaction.total_price)}${discountLine}`,
    ``,
    `✅ *TOTAL BAYAR : ${formatRupiah(transaction.grand_total)}*`,
    ``,
    ...paymentLines,
    SEP,
    `_${footerMessage}_`,
    ``,
    `_Dikirim otomatis dari Aplikasi Kasir MarketPos_`,
  ].filter(l => l !== null);

  return lines.join('\n');
};

// ── WhatsApp Kitchen Ticket (Struk Dapur) ────────────────────────────────────
export const generateKitchenWAMessage = (transaction, details, storeProfile) => {
  const storeName = storeProfile?.storeName || 'MarketPos Resto';
  const SEP  = '━━━━━━━━━━━━━━━━━━━━━━';
  const LINE = '─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─';

  const date = new Date(transaction.created_at).toLocaleString('id-ID', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    day: 'numeric', month: 'numeric', year: 'numeric',
  });

  const orderType = transaction.order_type === 'dine_in'
    ? '🍽️ DINE IN (Makan di Tempat)'
    : (transaction.order_type === 'take_away' ? '🥡 TAKE AWAY (Bungkus)' : 'PESANAN');

  const itemLines = (details || []).map((it, idx) => {
    return `${idx + 1}. *[ ${it.quantity}x ]* ${it.product_name}`;
  }).join('\n');

  const lines = [
    `🍳 *PESANAN DAPUR / KITCHEN TICKET*`,
    `*${storeName.toUpperCase()}*`,
    SEP,
    `📋 No. Order : *${transaction.invoice_number}*`,
    `🕒 Jam       : ${date}`,
    transaction.table_number ? `🪑 Meja      : *${transaction.table_number}*` : null,
    `📌 Tipe      : *${orderType}*`,
    SEP,
    `*MENU YANG DIMASAK:*`,
    LINE,
    itemLines,
    LINE,
    transaction.payment_notes ? `📝 Catatan : _${transaction.payment_notes}_` : null,
    SEP,
    `_Harap segera diproses staf dapur_`,
  ].filter(Boolean);

  return lines.join('\n');
};

// ── WhatsApp daily closing report generator ─────────────────────────────────
export const generateDailyClosingWAMessage = (summary, storeProfile, dateStr) => {
  const storeName = storeProfile?.storeName || storeProfile?.name || 'Toko Kelontong';
  const SEP  = '━━━━━━━━━━━━━━━━━━━━━━';
  const LINE = '─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─';

  const dateDisplay = dateStr || new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const topItemsText = (summary?.top_products || []).length > 0
    ? summary.top_products.map((p, idx) => `  ${idx + 1}. ${p.name} (${p.qty} terjual)`).join('\n')
    : '  Belum ada penjualan';

  const lines = [
    `📊 *LAPORAN PENJUALAN HARIAN*`,
    `*${storeName.toUpperCase()}*`,
    `📅 ${dateDisplay}`,
    SEP,
    `💰 *RINGKASAN OMZET & KEUANGAN:*`,
    `• Total Omzet      : *${formatRupiah(summary?.omzet || 0)}*`,
    `• Uang Tunai (Laci): ${formatRupiah(summary?.omzet_tunai || 0)}`,
    `• Non-Tunai (QRIS/TF): ${formatRupiah(summary?.omzet_non_tunai || 0)}`,
    `• Total Transaksi  : ${summary?.count || 0} Nota`,
    `• Estimasi Laba    : *${formatRupiah(summary?.laba || 0)}*`,
    SEP,
    `⭐ *PRODUK TERLARIS:*`,
    LINE,
    topItemsText,
    SEP,
    `_Laporan resmi dari Aplikasi Kasir MarketPos_`,
  ];

  return lines.join('\n');
};

// ── HTML receipt generator for Printing / PDF ────────────────────────────────
export const generateReceiptHTML = (transaction, details, storeProfile) => {
  const storeName    = storeProfile?.storeName    || 'MarketPos';
  const storeAddress = storeProfile?.storeAddress || '';
  const storeContact = storeProfile?.storeContact || '';
  const footerMessage = storeProfile?.footerMessage || 'Terima kasih telah berbelanja!';

  const date = new Date(transaction.created_at).toLocaleString('id-ID', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const detailsHTML = details.map(item => `
    <div class="item">
      <div class="item-name">${item.product_name}</div>
      <div class="item-row-detail">
        <span class="item-qty">${item.quantity} × ${formatRupiah(item.price_at_sale)}</span>
        <span class="item-subtotal">${formatRupiah(item.quantity * item.price_at_sale)}</span>
      </div>
    </div>
  `).join('');

  const discountHTML = transaction.discount_amount > 0 ? `
    <div class="calc-row discount">
      <span class="calc-label">Diskon Toko</span>
      <span class="calc-val">-${formatRupiah(transaction.discount_amount)}</span>
    </div>
  ` : '';

  const fnbBadgeHTML = (transaction.table_number || (transaction.order_type && transaction.order_type !== 'retail')) ? `
    <div class="fnb-card">
      ${transaction.table_number ? `<div><strong>Meja:</strong> ${transaction.table_number}</div>` : ''}
      ${transaction.order_type ? `<div><strong>Tipe:</strong> ${transaction.order_type === 'dine_in' ? 'Dine In' : 'Take Away'}</div>` : ''}
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: #EDEEF2;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 28px 16px 48px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt {
      background: #fff;
      border-radius: 20px;
      width: 100%;
      max-width: 400px;
      overflow: hidden;
      box-shadow: 0 12px 48px rgba(0,0,0,0.12);
    }
    .receipt-top {
      background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #0EA5E9 100%);
      padding: 28px 28px 24px;
      text-align: center;
      color: #fff;
    }
    .store-name { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 4px; }
    .store-info { font-size: 13px; opacity: 0.88; line-height: 1.6; margin-top: 2px; }

    .receipt-body { padding: 4px 28px 28px; }

    .meta-card {
      background: #F8FAFC;
      border-radius: 12px;
      border: 1px solid #E5E7EB;
      padding: 14px 16px;
      margin: 16px 0 8px;
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
    .meta-label { font-size: 12px; font-weight: 700; color: #4B5563; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 4px; }
    .meta-value { font-size: 14px; font-weight: 800; color: #111827; }
    .meta-block:last-child { text-align: right; }

    .fnb-card {
      background: #EFF6FF;
      border: 1px dashed #93C5FD;
      border-radius: 8px;
      padding: 8px 12px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: #1D4ED8;
    }

    .section-heading {
      font-size: 14px; font-weight: 800; color: #1F2937;
      text-transform: uppercase; letter-spacing: 0.8px;
      margin-bottom: 10px; margin-top: 4px;
      padding-bottom: 6px; border-bottom: 2px solid #F3F4F6;
    }

    .item { padding: 12px 0; border-bottom: 1px solid #F3F4F6; }
    .item:last-child { border-bottom: none; }
    .item-name { font-size: 15px; font-weight: 600; color: #111827; margin-bottom: 5px; }
    .item-row-detail { display: flex; justify-content: space-between; align-items: center; }
    .item-qty { font-size: 13px; color: #6B7280; }
    .item-subtotal { font-size: 14px; color: #374151; font-weight: 600; }

    .dashed { border-top: 2px dashed #E5E7EB; margin: 16px 0; }

    .calc-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; }
    .calc-label { font-size: 14px; color: #6B7280; }
    .calc-val   { font-size: 14px; color: #374151; font-weight: 500; }
    .discount .calc-label, .discount .calc-val { color: #EF4444; }

    .grand-total {
      background: linear-gradient(135deg, #EDE9FE, #DBEAFE);
      border-radius: 12px; padding: 14px 16px;
      margin: 12px 0;
      display: flex; justify-content: space-between; align-items: center;
    }
    .grand-label { font-size: 16px; font-weight: 700; color: #4F46E5; }
    .grand-value { font-size: 22px; font-weight: 800; color: #4F46E5; }

    .payment-box {
      background: #F8FAFC; border: 1px solid #E5E7EB;
      border-radius: 12px; padding: 12px 16px; margin-top: 4px;
    }
    .pay-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; }
    .pay-label { font-size: 14px; color: #6B7280; }
    .pay-val   { font-size: 14px; color: #374151; font-weight: 500; }
    .pay-row.kembali .pay-val { font-size: 16px; font-weight: 800; color: #059669; }
    .pay-divider { height: 1px; background: #E5E7EB; margin: 4px 0; }

    .receipt-footer { text-align: center; padding: 20px 28px 28px; border-top: 2px dashed #E5E7EB; margin-top: 16px; }
    .footer-msg { font-size: 14px; color: #6B7280; font-style: italic; line-height: 1.6; }
    .footer-dots { margin-top: 14px; font-size: 20px; color: #D1D5DB; letter-spacing: 6px; }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="receipt-top">
      <div class="store-name">${storeName}</div>
      ${storeAddress ? `<div class="store-info">📍 ${storeAddress}</div>` : ''}
      ${storeContact ? `<div class="store-info">📞 ${storeContact}</div>` : ''}
    </div>

    <div class="receipt-body">
      <div class="meta-card">
        <div class="meta-block">
          <div class="meta-label">No. Nota</div>
          <div class="meta-value">${transaction.invoice_number}</div>
        </div>
        <div class="meta-block">
          <div class="meta-label">Tanggal</div>
          <div class="meta-value">${date}</div>
        </div>
      </div>

      ${fnbBadgeHTML}

      <div class="section-heading">Detail Pembelian</div>
      <div class="items-list">${detailsHTML}</div>

      <div class="dashed"></div>
      ${discountHTML}

      <div class="grand-total">
        <span class="grand-label">TOTAL</span>
        <span class="grand-value">${formatRupiah(transaction.grand_total)}</span>
      </div>

      ${(() => {
        const method = String(transaction.payment_method || 'cash').toUpperCase();
        if (method === 'CASH' || method === 'TUNAI') {
          return `
          <div class="payment-box">
            <div class="pay-row">
              <span class="pay-label">Tunai</span>
              <span class="pay-val">${formatRupiah(transaction.cash_received)}</span>
            </div>
            <div class="pay-divider"></div>
            <div class="pay-row kembali">
              <span class="pay-label">Kembalian</span>
              <span class="pay-val">${formatRupiah(transaction.cash_return)}</span>
            </div>
          </div>`;
        }
        return `
        <div class="payment-box">
          <div class="pay-row">
            <span class="pay-label">Metode Bayar</span>
            <span class="pay-val" style="font-weight: 700; color: #0284C7;">${method}</span>
          </div>
          <div class="pay-divider"></div>
          <div class="pay-row kembali">
            <span class="pay-label">Status</span>
            <span class="pay-val" style="color: #059669;">LUNAS (${formatRupiah(transaction.grand_total)})</span>
          </div>
        </div>`;
      })()}
    </div>

    <div class="receipt-footer">
      <div class="footer-msg">${footerMessage}</div>
      <div class="footer-dots">• • •</div>
    </div>
  </div>
</body>
</html>`;
};

// ── HTML Kitchen Ticket generator (Khusus Staf Dapur: Tanpa Harga) ──────────
export const generateKitchenReceiptHTML = (transaction, details, storeProfile) => {
  const storeName = storeProfile?.storeName || 'MarketPos Resto';
  const date = new Date(transaction.created_at).toLocaleString('id-ID', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    day: 'numeric', month: 'short', year: 'numeric',
  });

  const orderType = transaction.order_type === 'dine_in'
    ? 'DINE IN'
    : (transaction.order_type === 'take_away' ? 'TAKE AWAY' : 'PESANAN');

  const itemsListHTML = (details || []).map(item => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px dashed #ccc;">
      <span style="font-size: 18px; font-weight: 700; color: #111;">${item.product_name}</span>
      <span style="font-size: 20px; font-weight: 900; background: #000; color: #fff; padding: 2px 10px; border-radius: 6px;">${item.quantity}x</span>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: monospace, sans-serif; background: #fff; padding: 20px; max-width: 380px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
    .title { font-size: 22px; font-weight: 900; letter-spacing: 1px; }
    .table-box { background: #f3f4f6; border: 2px solid #000; padding: 12px; text-align: center; margin: 12px 0; border-radius: 8px; }
    .table-num { font-size: 28px; font-weight: 900; }
    .order-type { font-size: 16px; font-weight: 700; color: #444; margin-top: 4px; }
    .notes-box { background: #fffbeb; border: 1px solid #f59e0b; padding: 8px; margin-top: 14px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">*** STRUK DAPUR ***</div>
    <div>${storeName}</div>
    <div style="font-size: 12px; margin-top: 4px;">No: ${transaction.invoice_number} | ${date}</div>
  </div>

  <div class="table-box">
    <div class="table-num">MEJA: ${transaction.table_number || '-'}</div>
    <div class="order-type">[ ${orderType} ]</div>
  </div>

  <div style="margin: 16px 0;">
    ${itemsListHTML}
  </div>

  ${transaction.payment_notes ? `
    <div class="notes-box">
      <strong>Catatan Pesanan:</strong> ${transaction.payment_notes}
    </div>
  ` : ''}

  <div style="text-align: center; margin-top: 20px; font-size: 12px; border-top: 1px dashed #000; padding-top: 8px;">
    Segera Diproses Staf Dapur
  </div>
</body>
</html>`;
};
