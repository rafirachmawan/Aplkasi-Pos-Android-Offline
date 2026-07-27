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

  const lines = [
    `🧾 *NOTA BELANJA RESMI*`,
    `*${storeName.toUpperCase()}*`,
    storeAddress ? `📍 ${storeAddress}` : null,
    storeContact ? `📞 ${storeContact}` : null,
    SEP,
    `📋 No. Nota  : *${transaction.invoice_number}*`,
    `📅 Tanggal   : ${date}`,
    SEP,
    `*📦 DETAIL PEMBELIAN:*`,
    LINE,
    itemLines,
    LINE,
    `💰 Subtotal   : ${formatRupiah(transaction.total_price)}${discountLine}`,
    ``,
    `✅ *TOTAL BAYAR : ${formatRupiah(transaction.grand_total)}*`,
    ``,
    `💵 Tunai      : ${formatRupiah(transaction.cash_received)}`,
    `🔄 Kembalian  : *${formatRupiah(transaction.cash_return)}*`,
    SEP,
    `_${footerMessage}_`,
    ``,
    `_Dikirim otomatis dari Aplikasi Kasir_`,
  ].filter(l => l !== null);

  return lines.join('\n');
};

// ── HTML receipt PDF generator ───────────────────────────────────────────────
export const generateReceiptHTML = (transaction, details, storeProfile) => {
  const date = new Date(transaction.created_at).toLocaleString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const storeName    = storeProfile?.storeName    || 'Toko Kelontong';
  const storeAddress = storeProfile?.storeAddress || '';
  const storeContact = storeProfile?.storeContact || '';
  const footerMessage = storeProfile?.footerMessage || 'Terima Kasih Atas Kunjungan Anda!';

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
    <div class="calc-row">
      <span class="calc-label">Subtotal</span>
      <span class="calc-val">${formatRupiah(transaction.total_price)}</span>
    </div>
    <div class="calc-row discount">
      <span class="calc-label">Diskon</span>
      <span class="calc-val">− ${formatRupiah(transaction.discount_amount)}</span>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    /* Force background colors to print in PDF */
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }

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
      margin: 16px 0;
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
    .meta-label { font-size: 12px; font-weight: 700; color: #4B5563; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 4px; }
    .meta-value { font-size: 14px; font-weight: 800; color: #111827; }
    .meta-block:last-child { text-align: right; }

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

      <div class="section-heading">Detail Pembelian</div>
      <div class="items-list">${detailsHTML}</div>

      <div class="dashed"></div>
      ${discountHTML}

      <div class="grand-total">
        <span class="grand-label">TOTAL</span>
        <span class="grand-value">${formatRupiah(transaction.grand_total)}</span>
      </div>

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
      </div>
    </div>

    <div class="receipt-footer">
      <div class="footer-msg">${footerMessage}</div>
      <div class="footer-dots">• • •</div>
    </div>
  </div>
</body>
</html>`;
};
