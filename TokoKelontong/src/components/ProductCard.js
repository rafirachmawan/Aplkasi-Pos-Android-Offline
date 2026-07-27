import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Card, Text, IconButton, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { formatRupiah } from '../utils/helpers';

const ProductCard = ({ product, onEdit, onDelete }) => {
  const theme = useTheme();
  const isLowStock = product.stock_quantity <= product.min_stock_threshold;
  
  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        <View style={styles.cardInner}>
          {/* Thumbnail Produk */}
          <View style={styles.thumbnail}>
            {product.image_uri ? (
              <Image source={{ uri: product.image_uri }} style={styles.thumbImage} />
            ) : (
              <MaterialCommunityIcons name="package-variant" size={32} color={theme.colors.primary} />
            )}
          </View>

          {/* Info Produk */}
          <View style={{ flex: 1 }}>
            <View style={styles.header}>
              <Text variant="titleMedium" style={{ fontWeight: 'bold', flex: 1 }} numberOfLines={1}>{product.product_name}</Text>
              {isLowStock && (
                <View style={[styles.badge, { backgroundColor: theme.colors.error }]}>
                  <Text style={styles.badgeText}>Menipis</Text>
                </View>
              )}
            </View>
            <Text variant="bodySmall" style={{ color: theme.colors.textSecondary, marginBottom: 6 }}>
              Barcode: {product.barcode || '-'}
            </Text>
            <View style={styles.row}>
              <View style={styles.infoCol}>
                <Text variant="labelSmall">Stok</Text>
                <Text variant="bodyLarge" style={{ color: isLowStock ? theme.colors.error : theme.colors.primary, fontWeight: 'bold' }}>
                  {product.stock_quantity} <Text style={{ fontSize: 12, fontWeight: '400', color: theme.colors.textSecondary }}>{product.unit || 'pcs'}</Text>
                </Text>
              </View>
              <View style={styles.infoCol}>
                <Text variant="labelSmall">Harga Jual</Text>
                <Text variant="bodyLarge">{formatRupiah(product.selling_price)}</Text>
              </View>
            </View>
          </View>
        </View>
      </Card.Content>
      <Card.Actions>
        <IconButton icon="pencil" size={20} onPress={onEdit} />
        <IconButton icon="delete" size={20} iconColor={theme.colors.error} onPress={onDelete} />
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumbnail: {
    width: 64, height: 64, borderRadius: 12,
    backgroundColor: '#E0E7FF',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  thumbImage: {
    width: '100%', height: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
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
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  }
});

export default ProductCard;
