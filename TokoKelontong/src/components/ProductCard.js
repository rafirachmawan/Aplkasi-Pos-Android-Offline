import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, IconButton, useTheme } from 'react-native-paper';
import { formatRupiah } from '../utils/helpers';

const ProductCard = ({ product, onEdit, onDelete }) => {
  const theme = useTheme();
  const isLowStock = product.stock_quantity <= product.min_stock_threshold;
  
  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        <View style={styles.header}>
          <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{product.product_name}</Text>
          {isLowStock && (
            <View style={[styles.badge, { backgroundColor: theme.colors.error }]}>
              <Text style={styles.badgeText}>Stok Menipis</Text>
            </View>
          )}
        </View>
        <Text variant="bodySmall" style={{ color: theme.colors.textSecondary, marginBottom: 8 }}>
          Barcode: {product.barcode || '-'}
        </Text>
        
        <View style={styles.row}>
          <View style={styles.infoCol}>
            <Text variant="labelSmall">Stok</Text>
            <Text variant="bodyLarge" style={{ color: isLowStock ? theme.colors.error : theme.colors.primary, fontWeight: 'bold' }}>
              {product.stock_quantity}
            </Text>
          </View>
          <View style={styles.infoCol}>
            <Text variant="labelSmall">Harga Jual</Text>
            <Text variant="bodyLarge">{formatRupiah(product.selling_price)}</Text>
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
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    marginTop: 8,
  },
  infoCol: {
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  }
});

export default ProductCard;
