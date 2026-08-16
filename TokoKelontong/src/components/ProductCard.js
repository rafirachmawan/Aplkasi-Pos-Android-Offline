import React from "react";
import { View, StyleSheet, Image } from "react-native";
import { Card, Text, IconButton, useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { formatRupiah } from "../utils/helpers";
import { fonts } from "../theme/colors";

const ProductCard = ({ product, onEdit, onDelete }) => {
  const theme = useTheme();
  const isLowStock = product.stock_quantity <= product.min_stock_threshold;

  // Helper: Get icon name based on category
  const getPlaceholderIcon = (category) => {
    if (!category) return "package-variant";

    const categoryIcons = {
      makanan: "apple",
      minuman: "wine",
      kebersihan: "soap",
      batik: "shirt-tank-top",
      baju: "t-shirt-outlined",
      aksesoris: "ring",
      sepatu: "shoe-formal",
      tas: "bag-personal",
      elektronik: "monitor",
      "alat tulis": "pencil-box",
      lainnya: "cube-outline",
    };

    return categoryIcons[category.toLowerCase()] || "package-variant";
  };

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        <View style={styles.cardInner}>
          {/* Thumbnail Produk */}
          <View style={styles.thumbnail}>
            {product.image_uri ? (
              <Image
                source={{ uri: product.image_uri }}
                style={styles.thumbImage}
              />
            ) : (
              <MaterialCommunityIcons
                name={getPlaceholderIcon(product.category)}
                size={36}
                color={theme.colors.primary}
                style={{ opacity: 0.25 }}
              />
            )}
          </View>

          {/* Info Produk */}
          <View style={{ flex: 1 }}>
            <View style={styles.header}>
              <Text
                variant="titleMedium"
                style={{ fontFamily: fonts.bold, fontWeight: "bold", flex: 1 }}
                numberOfLines={1}
              >
                {product.product_name}
              </Text>
              {isLowStock && (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: theme.colors.error },
                  ]}
                >
                  <Text style={[styles.badgeText, { fontFamily: fonts.bold }]}>
                    Menipis
                  </Text>
                </View>
              )}
            </View>
            <Text
              variant="bodySmall"
              style={{
                fontFamily: fonts.regular,
                color: theme.colors.textSecondary,
                marginBottom: 6,
              }}
            >
              Barcode: {product.barcode || "-"}
            </Text>
            <View style={styles.row}>
              <View style={styles.infoCol}>
                <Text variant="labelSmall" style={{ fontFamily: fonts.medium }}>
                  Stok
                </Text>
                <Text
                  variant="bodyLarge"
                  style={{
                    fontFamily: fonts.bold,
                    color: isLowStock
                      ? theme.colors.error
                      : theme.colors.primary,
                    fontWeight: "bold",
                  }}
                >
                  {product.stock_quantity}{" "}
                  <Text
                    style={{
                      fontFamily: fonts.regular,
                      fontSize: 12,
                      fontWeight: "400",
                      color: theme.colors.textSecondary,
                    }}
                  >
                    {product.unit || "pcs"}
                  </Text>
                </Text>
              </View>
              <View style={styles.infoCol}>
                <Text variant="labelSmall" style={{ fontFamily: fonts.medium }}>
                  Harga Jual
                </Text>
                <Text variant="bodyLarge" style={{ fontFamily: fonts.bold }}>
                  {formatRupiah(product.selling_price)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Card.Content>
      <Card.Actions>
        <IconButton icon="pencil" size={20} onPress={onEdit} />
        <IconButton
          icon="delete"
          size={20}
          iconColor={theme.colors.error}
          onPress={onDelete}
        />
      </Card.Actions>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
  },
  cardInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  row: {
    flexDirection: "row",
    marginTop: 4,
  },
  infoCol: {
    flex: 1,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "bold",
  },
});

export default ProductCard;
