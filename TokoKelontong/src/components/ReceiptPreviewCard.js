import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";
import { formatRupiah, getReceiptPaymentSummary } from "../utils/helpers";

const MONO_FONT = Platform.OS === "ios" ? "Courier" : "monospace";

/**
 * Formats a transaction timestamp to match SettingNotaScreen's compact thermal
 * notation (`dd/mm/yy HH.MM`).
 */
export const formatReceiptPreviewDate = (createdAt) => {
  if (!createdAt) return "";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  const datePart = date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
  const timePart = date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${datePart} ${timePart}`;
};

/**
 * Normalizes stored receipt paper size strings to supported thermal / A4 variants.
 */
export const resolvePreviewPaperSize = (paperSize) => {
  const normalized = String(paperSize || "58mm").trim().toLowerCase();
  if (normalized === "80mm" || normalized === "a4") {
    return normalized;
  }
  return "58mm";
};

/**
 * Shared thermal/A4 receipt preview card matching SettingNotaScreen styling.
 * Wraps long header metadata (`No :` + date) so narrow 58mm strips never clip text.
 */
const ReceiptPreviewCard = ({
  tx,
  details = [],
  storeProfile = {},
  paymentSummary,
  dateText,
  showSubtotal = true,
  showCashMethodRow = false,
  cashPaidLabel = "Tunai",
  seamless = false,
  headerSlot = null,
  style,
}) => {
  if (!tx) return null;

  const paperSize = resolvePreviewPaperSize(storeProfile?.paperSize);
  const payInfo = paymentSummary || getReceiptPaymentSummary(tx);
  const resolvedDate =
    dateText !== undefined ? dateText : formatReceiptPreviewDate(tx.created_at);
  const safeDetails = Array.isArray(details) ? details : [];
  const hasDiscount = Number(tx.discount_amount || 0) > 0;
  const hasOrderMeta = Boolean(
    tx.table_number || (tx.order_type && tx.order_type !== "retail"),
  );

  return (
    <View
      style={[
        seamless
          ? [styles.receiptSeamless, paperSize === "a4" && styles.receiptPaperA4]
          : [
              styles.receiptPaper,
              paperSize === "58mm" && styles.receiptPaper58,
              paperSize === "80mm" && styles.receiptPaper80,
              paperSize === "a4" && styles.receiptPaperA4,
            ],
        style,
      ]}
    >
      {headerSlot}
      <Text style={styles.receiptStoreName}>
        {storeProfile?.storeName || "MarketPos"}
      </Text>
      {!!storeProfile?.storeAddress && (
        <Text style={styles.receiptMetaCenter}>
          {storeProfile.storeAddress}
        </Text>
      )}
      {!!storeProfile?.storeContact && (
        <Text style={styles.receiptMetaCenter}>
          Telp/WA: {storeProfile.storeContact}
        </Text>
      )}

      <View style={styles.receiptDash} />

      <View style={styles.receiptHeaderMetaRow}>
        <Text style={[styles.receiptMeta, styles.receiptRowLeft]}>
          No : {tx.invoice_number || "-"}
        </Text>
        {!!resolvedDate && (
          <Text style={[styles.receiptMeta, styles.receiptDateText]}>
            {resolvedDate}
          </Text>
        )}
      </View>
      {hasOrderMeta && (
        <View style={styles.receiptMetaRow}>
          <Text style={[styles.receiptMeta, styles.receiptRowLeft]}>
            Meja : {tx.table_number || "-"}
          </Text>
          <Text style={[styles.receiptMeta, styles.receiptBoldMeta]}>
            {tx.order_type === "dine_in" ? "Dine In" : "Take Away"}
          </Text>
        </View>
      )}

      <View style={styles.receiptDash} />

      {safeDetails.map((item, index) => {
        const qty = Number(item?.quantity || 0);
        const price = Number(item?.price_at_sale || 0);
        return (
          <View key={item?.id || index} style={styles.receiptItem}>
            <Text style={styles.receiptItemName}>{item?.product_name}</Text>
            <View style={styles.receiptMetaRow}>
              <Text style={[styles.receiptMeta, styles.receiptRowLeft]}>
                {qty} x {formatRupiah(price)}
              </Text>
              <Text style={styles.receiptItemTotal}>
                {formatRupiah(qty * price)}
              </Text>
            </View>
          </View>
        );
      })}

      <View style={styles.receiptDash} />

      {showSubtotal && (
        <View style={styles.receiptMetaRow}>
          <Text style={styles.receiptMeta}>Subtotal</Text>
          <Text style={styles.receiptMeta}>
            {formatRupiah(tx.total_price || 0)}
          </Text>
        </View>
      )}
      {hasDiscount && (
        <View style={styles.receiptMetaRow}>
          <Text style={styles.receiptMeta}>Diskon</Text>
          <Text style={[styles.receiptMeta, { color: colors.errorDark }]}>
            -{formatRupiah(tx.discount_amount)}
          </Text>
        </View>
      )}
      <View
        style={[
          styles.receiptMetaRow,
          styles.receiptTotalRow,
          !(showSubtotal || hasDiscount) && { marginTop: 2 },
        ]}
      >
        <Text style={styles.receiptTotalLabel}>TOTAL</Text>
        <Text style={styles.receiptTotalValue}>
          {formatRupiah(tx.grand_total || 0)}
        </Text>
      </View>

      {payInfo.kind === "cash" && (
        <>
          {showCashMethodRow && (
            <View style={styles.receiptMetaRow}>
              <Text style={[styles.receiptMeta, styles.receiptRowLeft]}>
                Metode
              </Text>
              <Text style={[styles.receiptMeta, styles.receiptBoldMeta]}>
                {payInfo.methodLabel}
              </Text>
            </View>
          )}
          <View style={styles.receiptMetaRow}>
            <Text style={styles.receiptMeta}>{cashPaidLabel}</Text>
            <Text style={styles.receiptMeta}>
              {formatRupiah(payInfo.cashReceived)}
            </Text>
          </View>
          <View style={styles.receiptMetaRow}>
            <Text style={styles.receiptMeta}>Kembalian</Text>
            <Text style={[styles.receiptMeta, styles.receiptBoldMeta]}>
              {formatRupiah(payInfo.cashReturn)}
            </Text>
          </View>
        </>
      )}

      {payInfo.kind === "kasbon" && (
        <>
          <View style={styles.receiptMetaRow}>
            <Text style={[styles.receiptMeta, styles.receiptRowLeft]}>
              Metode Pembayaran
            </Text>
            <Text style={[styles.receiptMeta, styles.receiptBoldMeta]}>
              {payInfo.methodLabel}
            </Text>
          </View>
          <View style={styles.receiptMetaRow}>
            <Text style={styles.receiptMeta}>DP / Dibayar</Text>
            <Text style={styles.receiptMeta}>
              {formatRupiah(payInfo.dpAmount)}
            </Text>
          </View>
          <View style={styles.receiptMetaRow}>
            <Text style={styles.receiptMeta}>Sisa Kasbon</Text>
            <Text
              style={[
                styles.receiptMeta,
                styles.receiptBoldMeta,
                {
                  color: payInfo.isPaidOff
                    ? colors.successText
                    : colors.errorDark,
                },
              ]}
            >
              {formatRupiah(payInfo.remainingDebt)}
            </Text>
          </View>
          <View style={styles.receiptMetaRow}>
            <Text style={styles.receiptMeta}>Status</Text>
            <Text
              style={[
                styles.receiptMeta,
                styles.receiptBoldMeta,
                {
                  color: payInfo.isPaidOff
                    ? colors.successText
                    : colors.errorDark,
                },
              ]}
            >
              {payInfo.statusLabel}
            </Text>
          </View>
        </>
      )}

      {payInfo.kind !== "cash" && payInfo.kind !== "kasbon" && (
        <>
          <View style={styles.receiptMetaRow}>
            <Text style={[styles.receiptMeta, styles.receiptRowLeft]}>
              Metode Pembayaran
            </Text>
            <Text style={[styles.receiptMeta, styles.receiptBoldMeta]}>
              {payInfo.methodLabel}
            </Text>
          </View>
          <View style={styles.receiptMetaRow}>
            <Text style={styles.receiptMeta}>Status</Text>
            <Text
              style={[
                styles.receiptMeta,
                styles.receiptBoldMeta,
                { color: colors.successText },
              ]}
            >
              {payInfo.statusLabel}
            </Text>
          </View>
        </>
      )}

      <View style={styles.receiptDash} />

      <Text style={styles.receiptFooter}>
        {storeProfile?.footerMessage || "Terima kasih telah berbelanja!"}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  receiptSeamless: {
    backgroundColor: colors.surface,
    width: "100%",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
  },
  receiptPaper: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    padding: 16,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  receiptPaper58: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 268,
  },
  receiptPaper80: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 360,
  },
  receiptPaperA4: {
    width: "100%",
    borderTopWidth: 4,
    borderTopColor: colors.info,
  },
  receiptStoreName: {
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    color: colors.text,
    letterSpacing: 0.7,
    marginBottom: 3,
    fontFamily: MONO_FONT,
  },
  receiptMetaCenter: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    color: colors.textBodySecondary,
    fontFamily: MONO_FONT,
  },
  receiptDash: {
    borderBottomWidth: 1,
    borderBottomColor: colors.textMuted,
    borderStyle: "dashed",
    marginVertical: 10,
  },
  receiptHeaderMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "flex-start",
    columnGap: 10,
    rowGap: 2,
    marginTop: 2,
  },
  receiptMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    columnGap: 8,
    rowGap: 2,
    marginTop: 3,
  },
  receiptRowLeft: {
    flexShrink: 1,
  },
  receiptDateText: {
    flexShrink: 0,
  },
  receiptMeta: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.textBodySecondary,
    fontFamily: MONO_FONT,
  },
  receiptBoldMeta: {
    fontWeight: "bold",
  },
  receiptItem: {
    marginBottom: 6,
  },
  receiptItemName: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 1,
    fontFamily: MONO_FONT,
  },
  receiptItemTotal: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.text,
    fontFamily: MONO_FONT,
  },
  receiptTotalRow: {
    marginTop: 6,
    marginBottom: 4,
    paddingVertical: 4,
  },
  receiptTotalLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
    fontFamily: MONO_FONT,
  },
  receiptTotalValue: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.2,
    fontFamily: MONO_FONT,
  },
  receiptFooter: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    color: colors.textBodySecondary,
    marginTop: 2,
    paddingHorizontal: 6,
    fontFamily: MONO_FONT,
  },
});

export default ReceiptPreviewCard;
