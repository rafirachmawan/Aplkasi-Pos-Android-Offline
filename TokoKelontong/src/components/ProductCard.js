import React from "react";
import { View, StyleSheet, Image, Text, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { formatRupiah } from "../utils/helpers";
import { colors, fonts } from "../theme/colors";

const ProductCard = ({ product, onEdit, onDelete, readOnly = false }) => {
  const isOutOfStock = product.stock_quantity <= 0;
  const isLowStock =
    !isOutOfStock &&
    product.stock_quantity <= (product.min_stock_threshold || 5);

  // Helper: Icon placeholder berdasarkan kategori
  const getPlaceholderIcon = (category) => {
    if (!category) return "package-variant";
    const cat = category.toLowerCase();
    const categoryIcons = {
      makanan: "noodles",
      minuman: "cup-water",
      kebersihan: "soap",
      batik: "tshirt-crew",
      baju: "tshirt-crew-outline",
      aksesoris: "watch",
      sepatu: "shoe-formal",
      tas: "bag-personal",
      elektronik: "devices",
      "alat tulis": "pencil-ruler",
      sembako: "rice",
      snack: "food-croissant",
    };
    return categoryIcons[cat] || "package-variant";
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardInner}>
        {/* Thumbnail Produk */}
        <View style={styles.thumbnail}>
          {product.image_uri ? (
            <Image
              source={{ uri: product.image_uri }}
              style={styles.thumbImage}
            />
          ) : (
            <View style={styles.placeholderBox}>
              <MaterialCommunityIcons
                name={getPlaceholderIcon(product.category)}
                size={30}
                color={colors.primary}
                style={{ opacity: 0.35 }}
              />
            </View>
          )}
          {product.category ? (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText} numberOfLines={1}>
                {product.category}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Info Produk */}
        <View style={styles.contentWrap}>
          {/* Header Baris: Nama & Tombol Aksi */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1, paddingRight: 6 }}>
              <Text style={styles.productName} numberOfLines={2}>
                {product.product_name}
              </Text>
              <View style={styles.metaRow}>
                {product.barcode ? (
                  <View style={styles.barcodeWrap}>
                    <MaterialCommunityIcons
                      name="barcode-scan"
                      size={13}
                      color="#64748B"
                    />
                    <Text style={styles.barcodeText}>{product.barcode}</Text>
                  </View>
                ) : (
                  <Text style={styles.barcodeTextMuted}>Tanpa Barcode</Text>
                )}

                {isOutOfStock ? (
                  <View style={styles.badgeOut}>
                    <Text style={styles.badgeTextOut}>
                      {product.stock_quantity < 0
                        ? `Habis (${product.stock_quantity})`
                        : "Habis"}
                    </Text>
                  </View>
                ) : isLowStock ? (
                  <View style={styles.badgeLow}>
                    <Text style={styles.badgeTextLow}>Menipis</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Action Buttons (Edit & Delete) */}
            <View style={styles.actionsWrap}>
              <TouchableOpacity
                style={[
                  styles.actionBtnEdit,
                  readOnly && styles.actionBtnDisabled,
                ]}
                onPress={onEdit}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                <MaterialCommunityIcons
                  name="pencil-outline"
                  size={16}
                  color="#334155"
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionBtnDelete,
                  readOnly && styles.actionBtnDisabled,
                ]}
                onPress={onDelete}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                <MaterialCommunityIcons
                  name="trash-can-outline"
                  size={16}
                  color="#EF4444"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Garis Pemisah Halus */}
          <View style={styles.dividerLine} />

          {/* Baris Bawah: Harga Jual & Kuantitas Stok */}
          <View style={styles.bottomRow}>
            <View>
              <Text style={styles.priceLabel}>HARGA JUAL</Text>
              <Text style={styles.priceValue}>
                {formatRupiah(product.selling_price)}
              </Text>
            </View>

            <View
              style={[
                styles.stockPill,
                isOutOfStock
                  ? styles.stockPillOut
                  : isLowStock
                    ? styles.stockPillLow
                    : styles.stockPillNormal,
              ]}
            >
              <MaterialCommunityIcons
                name={
                  isOutOfStock
                    ? "close-circle-outline"
                    : isLowStock
                      ? "alert-circle-outline"
                      : "package-variant-closed"
                }
                size={13}
                color={
                  isOutOfStock
                    ? "#DC2626"
                    : isLowStock
                      ? "#D97706"
                      : "#059669"
                }
              />
              <Text
                style={[
                  styles.stockPillText,
                  isOutOfStock
                    ? styles.stockPillTextOut
                    : isLowStock
                      ? styles.stockPillTextLow
                      : styles.stockPillTextNormal,
                ]}
              >
                {product.stock_quantity} {product.unit || "pcs"}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 5,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    overflow: "hidden",
  },
  cardInner: {
    flexDirection: "row",
    padding: 12,
    alignItems: "center",
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    position: "relative",
    marginRight: 12,
  },
  thumbImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  placeholderBox: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  categoryBadge: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(15, 23, 42, 0.78)",
    paddingVertical: 2,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  categoryBadgeText: {
    fontSize: 8,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  contentWrap: {
    flex: 1,
    justifyContent: "space-between",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  productName: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: "#0F172A",
    lineHeight: 18,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  barcodeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  barcodeText: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: "#64748B",
  },
  barcodeTextMuted: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: "#94A3B8",
  },
  badgeOut: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  badgeTextOut: {
    fontSize: 9,
    fontFamily: fonts.bold,
    color: "#DC2626",
    textTransform: "uppercase",
  },
  badgeLow: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  badgeTextLow: {
    fontSize: 9,
    fontFamily: fonts.bold,
    color: "#B45309",
    textTransform: "uppercase",
  },
  actionsWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionBtnEdit: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnDelete: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  dividerLine: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 8,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  priceLabel: {
    fontSize: 9,
    fontFamily: fonts.bold,
    color: "#64748B",
    letterSpacing: 0.5,
  },
  priceValue: {
    fontSize: 14,
    fontFamily: fonts.extraBold,
    color: colors.primary,
    marginTop: 1,
  },
  stockPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stockPillNormal: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  stockPillLow: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  stockPillOut: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  stockPillText: {
    fontSize: 11,
    fontFamily: fonts.bold,
  },
  stockPillTextNormal: {
    color: "#065F46",
  },
  stockPillTextLow: {
    color: "#92400E",
  },
  stockPillTextOut: {
    color: "#991B1B",
  },
});

export default ProductCard;
