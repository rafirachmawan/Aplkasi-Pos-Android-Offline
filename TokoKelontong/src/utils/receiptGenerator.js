import {
  formatRupiah,
  escapeHtml,
  normalizePaperSize,
  getPaperSpec,
  getReceiptPaymentSummary,
} from './helpers';

export { getReceiptPaymentSummary };

export const FREE_RECEIPT_DEFAULTS = {
  storeName: 'MarketPos',
  storeAddress: '',
  storeContact: '',
  footerMessage: 'Terima kasih telah berbelanja!',
};

/**
 * Menyelesaikan profil nota berdasarkan paket aktif toko.
 * Pada paket Gratis (`!isPro`), nota selalu memakai nama "MarketPos",
 * tanpa alamat/telepon toko, dan pesan penutup bawaan tanpa menghapus
 * data profil tersimpan apabila sebelumnya pernah memakai paket Pro.
 * Ukuran kertas printer (`paperSize`) tetap bebas diatur di semua paket.
 */
export const resolveReceiptProfile = (storeProfile = {}, isPro = false) => {
  const safe =
    storeProfile && typeof storeProfile === 'object' ? storeProfile : {};
  const paperSize = normalizePaperSize(safe.paperSize);
  if (!isPro) {
    return {
      ...safe,
      paperSize,
      storeName: FREE_RECEIPT_DEFAULTS.storeName,
      name: FREE_RECEIPT_DEFAULTS.storeName,
      storeAddress: FREE_RECEIPT_DEFAULTS.storeAddress,
      storeContact: FREE_RECEIPT_DEFAULTS.storeContact,
      footerMessage: FREE_RECEIPT_DEFAULTS.footerMessage,
    };
  }
  const resolvedName =
    String(safe.storeName || safe.name || '').trim() ||
    FREE_RECEIPT_DEFAULTS.storeName;
  return {
    ...safe,
    paperSize,
    storeName: resolvedName,
    name: resolvedName,
    storeAddress: String(safe.storeAddress || '').trim(),
    storeContact: String(safe.storeContact || '').trim(),
    footerMessage:
      String(safe.footerMessage || '').trim() ||
      FREE_RECEIPT_DEFAULTS.footerMessage,
  };
};

// ── WhatsApp text message generator ─────────────────────────────────────────
export const generateWAMessage = (transaction, details, storeProfile) => {
  const storeName     = storeProfile?.storeName    || storeProfile?.name || FREE_RECEIPT_DEFAULTS.storeName;
  const storeAddress  = storeProfile?.storeAddress || '';
  const storeContact  = storeProfile?.storeContact || '';
  const footerMessage = storeProfile?.footerMessage || FREE_RECEIPT_DEFAULTS.footerMessage;

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

  const payInfo = getReceiptPaymentSummary(transaction);
  let paymentLines = [];
  if (payInfo.kind === 'cash') {
    paymentLines = [
      `💵 Tunai      : ${formatRupiah(payInfo.cashReceived)}`,
      `🔄 Kembalian  : *${formatRupiah(payInfo.cashReturn)}*`,
    ];
  } else if (payInfo.kind === 'kasbon') {
    paymentLines = [
      `💳 Metode     : *KASBON*`,
      `💵 DP / Bayar : ${formatRupiah(payInfo.dpAmount)}`,
      `⏳ Sisa Kasbon: *${formatRupiah(payInfo.remainingDebt)}*`,
      `📌 Status     : *${payInfo.statusLabel}*`,
    ];
  } else {
    paymentLines = [
      `💳 Metode     : *${payInfo.methodLabel}*`,
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
  const storeName = storeProfile?.storeName || storeProfile?.name || FREE_RECEIPT_DEFAULTS.storeName;
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
    ...((summary?.omzet_kasbon || 0) > 0
      ? [`• Kasbon / Piutang : ${formatRupiah(summary.omzet_kasbon)}`]
      : []),
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
  const spec = getPaperSpec(storeProfile?.paperSize);
  const is58 = spec.id === '58mm';
  const thermalOverrideCSS = spec.isThermalHtml
    ? `
    @page { size: ${spec.htmlPageCss}; margin: ${spec.htmlPageMargin}; }
    body {
      font-family: 'Courier New', Courier, monospace;
      background: #fff;
      min-height: auto;
      padding: 10px 6px;
    }
    .receipt {
      max-width: ${spec.htmlPreviewWidth};
      border-radius: 0;
      box-shadow: none;
      border: 1px dashed #CBD5E1;
      color: #000;
    }
    .receipt-top {
      background: #fff;
      color: #000;
      padding: 12px 10px 10px;
      border-bottom: 1px dashed #000;
    }
    .store-name { font-size: ${is58 ? '16px' : '18px'}; color: #000; letter-spacing: 0.4px; }
    .store-info { font-size: ${is58 ? '11px' : '12px'}; color: #111827; opacity: 1; }
    .receipt-body { padding: 6px 10px 10px; }
    .meta-card {
      background: transparent;
      border: none;
      border-bottom: 1px dashed #000;
      border-radius: 0;
      padding: 6px 0;
      margin: 4px 0 8px;
    }
    .meta-label { font-size: 10px; color: #4B5563; }
    .meta-value { font-size: ${is58 ? '11px' : '12px'}; color: #000; }
    .section-heading { font-size: ${is58 ? '11px' : '12px'}; border-bottom-color: #9CA3AF; color: #000; }
    .item { padding: 5px 0; border-bottom: 1px dotted #9CA3AF; }
    .item-name { font-size: ${is58 ? '12px' : '13px'}; color: #000; margin-bottom: 2px; }
    .item-qty, .item-subtotal { font-size: ${is58 ? '11px' : '12px'}; color: #111827; }
    .dashed { border-top: 1px dashed #000; margin: 8px 0; }
    .calc-label, .calc-val { font-size: ${is58 ? '11px' : '12px'}; color: #000; }
    .grand-total {
      background: transparent;
      border-top: 1px dashed #000;
      border-bottom: 1px dashed #000;
      border-radius: 0;
      padding: 8px 0;
      margin: 8px 0;
    }
    .grand-label { font-size: ${is58 ? '13px' : '15px'}; color: #000; }
    .grand-value { font-size: ${is58 ? '15px' : '18px'}; color: #000; }
    .payment-box { background: transparent; border: none; padding: 2px 0; }
    .pay-label, .pay-val { font-size: ${is58 ? '11px' : '12px'}; color: #000 !important; }
    .pay-row.kembali .pay-val { font-size: ${is58 ? '12px' : '14px'}; color: #000 !important; }
    .receipt-footer { padding: 10px 8px 12px; border-top: 1px dashed #000; margin-top: 8px; }
    .footer-msg { font-size: ${is58 ? '11px' : '12px'}; color: #111827; font-style: normal; }
    .footer-dots { display: none; }
    @media print {
      body { padding: 0; background: #fff; }
      .receipt { max-width: ${spec.htmlMaxWidth}; border: none; }
    }
  `
    : `
    @page { size: ${spec.htmlPageCss}; margin: ${spec.htmlPageMargin}; }
    @media print { body { background: #fff; padding: 0; } .receipt { box-shadow: none; } }
  `;

  const safeStoreName = escapeHtml(
    storeProfile?.storeName || storeProfile?.name || FREE_RECEIPT_DEFAULTS.storeName,
  );
  const safeStoreAddress = escapeHtml(storeProfile?.storeAddress || '');
  const safeStoreContact = escapeHtml(storeProfile?.storeContact || '');
  const safeFooterMessage = escapeHtml(
    storeProfile?.footerMessage || FREE_RECEIPT_DEFAULTS.footerMessage,
  );

  const date = new Date(transaction.created_at).toLocaleString('id-ID', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const detailsHTML = details.map(item => `
    <div class="item">
      <div class="item-name">${escapeHtml(item.product_name)}</div>
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
      ${transaction.table_number ? `<div><strong>Meja:</strong> ${escapeHtml(transaction.table_number)}</div>` : ''}
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
    ${thermalOverrideCSS}
  </style>
</head>
<body>
  <div class="receipt">
    <div class="receipt-top">
      <div class="store-name">${safeStoreName}</div>
      ${safeStoreAddress ? `<div class="store-info">📍 ${safeStoreAddress}</div>` : ''}
      ${safeStoreContact ? `<div class="store-info">📞 ${safeStoreContact}</div>` : ''}
    </div>

    <div class="receipt-body">
      <div class="meta-card">
        <div class="meta-block">
          <div class="meta-label">No. Nota</div>
          <div class="meta-value">${escapeHtml(transaction.invoice_number)}</div>
        </div>
        <div class="meta-block">
          <div class="meta-label">Tanggal</div>
          <div class="meta-value">${escapeHtml(date)}</div>
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
        const payInfo = getReceiptPaymentSummary(transaction);
        const safeMethod = escapeHtml(payInfo.methodLabel);
        if (payInfo.kind === 'cash') {
          return `
          <div class="payment-box">
            <div class="pay-row">
              <span class="pay-label">Tunai</span>
              <span class="pay-val">${formatRupiah(payInfo.cashReceived)}</span>
            </div>
            <div class="pay-divider"></div>
            <div class="pay-row kembali">
              <span class="pay-label">Kembalian</span>
              <span class="pay-val">${formatRupiah(payInfo.cashReturn)}</span>
            </div>
          </div>`;
        }
        if (payInfo.kind === 'kasbon') {
          const statusColor = payInfo.isPaidOff ? '#059669' : '#DC2626';
          return `
          <div class="payment-box">
            <div class="pay-row">
              <span class="pay-label">Metode Bayar</span>
              <span class="pay-val" style="font-weight: 700; color: #B45309;">${safeMethod}</span>
            </div>
            <div class="pay-row">
              <span class="pay-label">DP / Dibayar</span>
              <span class="pay-val">${formatRupiah(payInfo.dpAmount)}</span>
            </div>
            <div class="pay-row">
              <span class="pay-label">Sisa Kasbon</span>
              <span class="pay-val" style="font-weight: 700; color: ${statusColor};">${formatRupiah(payInfo.remainingDebt)}</span>
            </div>
            <div class="pay-divider"></div>
            <div class="pay-row kembali">
              <span class="pay-label">Status</span>
              <span class="pay-val" style="color: ${statusColor};">${escapeHtml(payInfo.statusLabel)}</span>
            </div>
          </div>`;
        }
        return `
        <div class="payment-box">
          <div class="pay-row">
            <span class="pay-label">Metode Bayar</span>
            <span class="pay-val" style="font-weight: 700; color: #0284C7;">${safeMethod}</span>
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
      <div class="footer-msg">${safeFooterMessage}</div>
      <div class="footer-dots">• • •</div>
    </div>
  </div>
</body>
</html>`;
};

// ── HTML Kitchen Ticket generator (Khusus Staf Dapur: Tanpa Harga) ──────────
export const generateKitchenReceiptHTML = (transaction, details, storeProfile) => {
  const spec = getPaperSpec(storeProfile?.paperSize);
  const kitchenMaxWidth = spec.isThermalHtml ? spec.htmlPreviewWidth : '420px';
  const safeStoreName = escapeHtml(storeProfile?.storeName || 'MarketPos Resto');
  const date = new Date(transaction.created_at).toLocaleString('id-ID', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    day: 'numeric', month: 'short', year: 'numeric',
  });

  const orderType = transaction.order_type === 'dine_in'
    ? 'DINE IN'
    : (transaction.order_type === 'take_away' ? 'TAKE AWAY' : 'PESANAN');

  const itemsListHTML = (details || []).map(item => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px dashed #ccc;">
      <span style="font-size: 18px; font-weight: 700; color: #111;">${escapeHtml(item.product_name)}</span>
      <span style="font-size: 20px; font-weight: 900; background: #000; color: #fff; padding: 2px 10px; border-radius: 6px;">${item.quantity}x</span>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @page { size: ${spec.htmlPageCss}; margin: ${spec.htmlPageMargin}; }
    body { font-family: monospace, sans-serif; background: #fff; padding: ${spec.id === '58mm' ? '8px' : '20px'}; max-width: ${kitchenMaxWidth}; margin: 0 auto; }
    @media print { body { padding: 0; max-width: ${spec.htmlMaxWidth}; } }
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
    <div>${safeStoreName}</div>
    <div style="font-size: 12px; margin-top: 4px;">No: ${escapeHtml(transaction.invoice_number)} | ${escapeHtml(date)}</div>
  </div>

  <div class="table-box">
    <div class="table-num">MEJA: ${escapeHtml(transaction.table_number || '-')}</div>
    <div class="order-type">[ ${orderType} ]</div>
  </div>

  <div style="margin: 16px 0;">
    ${itemsListHTML}
  </div>

  ${transaction.payment_notes ? `
    <div class="notes-box">
      <strong>Catatan Pesanan:</strong> ${escapeHtml(transaction.payment_notes)}
    </div>
  ` : ''}

  <div style="text-align: center; margin-top: 20px; font-size: 12px; border-top: 1px dashed #000; padding-top: 8px;">
    Segera Diproses Staf Dapur
  </div>
</body>
</html>`;
};
