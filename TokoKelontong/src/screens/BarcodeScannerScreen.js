import React, {
  useState,
  useEffect,
  useRef,
  useContext,
  useMemo,
  useCallback,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking,
  FlatList,
  Image,
  Vibration,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppContext } from "../context/AppContext";
import usePlan from "../hooks/usePlan";
import ProductRepository from "../database/productRepository";
import { colors, fonts } from "../theme/colors";
import { formatRupiah } from "../utils/helpers";

const GLOBAL_SCAN_COOLDOWN_MS = 750;
const SAME_CODE_COOLDOWN_MS = 2000;
const NOT_FOUND_COOLDOWN_MS = 2800;
const FEEDBACK_HIDE_MS = 2400;

/**
 * Hitung harga satuan item (termasuk aturan grosir untuk tier Pro).
 */
export const resolveScannerUnitPrice = (item, isPro) => {
  const rules = isPro
    ? (item?.wholesale_rules || [])
        .filter((r) => r && r.min_qty && r.price)
        .sort((a, b) => b.min_qty - a.min_qty)
    : [];
  const qty = Number(item?.quantity || 0);
  const matched = rules.find((r) => qty >= r.min_qty);
  if (matched) {
    return {
      unitPrice: matched.price,
      isWholesale: true,
      ruleMinQty: matched.min_qty,
    };
  }
  return {
    unitPrice: Number(item?.selling_price || 0),
    isWholesale: false,
    ruleMinQty: null,
  };
};

/**
 * BarcodeScannerScreen
 * Mendukung dua mode:
 * 1) multiScan (Kasir): scan banyak barang beruntun dengan daftar produk ter-scan di dalam layar kamera.
 * 2) autoClose (Tambah Produk): scan satu kali lalu langsung kembali ke layar sebelumnya.
 */
const BarcodeScannerScreen = ({ navigation, route }) => {
  const { onBarcodeScanned, autoClose, multiScan } = route.params || {};
  const isMultiMode = Boolean(multiScan && !autoClose);

  const insets = useSafeAreaInsets();
  const { state, dispatch } = useContext(AppContext);
  const cart = state?.cart || [];
  const plan = usePlan();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [scanFeedback, setScanFeedback] = useState(null);
  const [lastScannedId, setLastScannedId] = useState(null);
  const [sessionScanCount, setSessionScanCount] = useState(0);

  const isSingleDoneRef = useRef(false);
  const isProcessingRef = useRef(false);
  const isMountedRef = useRef(true);
  const cooldownUntilRef = useRef(0);
  const lastCodeRef = useRef({ code: "", until: 0 });
  const feedbackTimerRef = useRef(null);
  const flatListRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const showTemporaryFeedback = useCallback((feedback) => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
    setScanFeedback(feedback);
    if (feedback && feedback.status !== "searching") {
      feedbackTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setScanFeedback(null);
        }
      }, FEEDBACK_HIDE_MS);
    }
  }, []);

  const displayCart = useMemo(() => [...cart].reverse(), [cart]);
  const displayCartRef = useRef(displayCart);
  useEffect(() => {
    displayCartRef.current = displayCart;
  }, [displayCart]);

  const { totalUnits, totalAmount } = useMemo(() => {
    return cart.reduce(
      (acc, item) => {
        const qty = Number(item.quantity || 0);
        const { unitPrice } = resolveScannerUnitPrice(item, plan.isPro);
        acc.totalUnits += qty;
        acc.totalAmount += unitPrice * qty;
        return acc;
      },
      { totalUnits: 0, totalAmount: 0 },
    );
  }, [cart, plan.isPro]);

  const scanProductLocally = useCallback(
    async (code) => {
      const product = await ProductRepository.getProductByBarcode(code, {
        localFirst: true,
      });
      if (product) {
        dispatch({
          type: "ADD_TO_CART",
          payload: {
            product_id: product.id,
            product_name: product.product_name,
            selling_price: product.selling_price,
            capital_price: product.capital_price,
            stock_quantity: product.stock_quantity,
            category: product.category,
            image_uri: product.image_uri,
            wholesale_rules: product.wholesale_rules || [],
          },
        });
        return { status: "added", product };
      }
      return {
        status: "not_found",
        code,
        message: `Barcode ${code} belum terdaftar di gudang.`,
      };
    },
    [dispatch],
  );

  const handleBarCodeScanned = useCallback(
    async ({ data }) => {
      const code = String(data || "").trim();
      if (!code) return;

      if (!isMultiMode) {
        if (isSingleDoneRef.current) return;
        isSingleDoneRef.current = true;
        setScanned(true);
        if (onBarcodeScanned) {
          onBarcodeScanned(code);
        }
        if (autoClose) {
          navigation.goBack();
        }
        return;
      }

      const now = Date.now();
      if (isProcessingRef.current) return;
      if (now < cooldownUntilRef.current) return;
      if (
        lastCodeRef.current.code === code &&
        now < lastCodeRef.current.until
      ) {
        return;
      }

      isProcessingRef.current = true;
      showTemporaryFeedback({
        status: "searching",
        text: `Mencari barcode ${code}...`,
      });

      try {
        const result = onBarcodeScanned
          ? await onBarcodeScanned(code)
          : await scanProductLocally(code);
        if (!isMountedRef.current) return;

        if (result && result.status === "added") {
          const addedName =
            result?.product?.product_name || `Produk (${code})`;
          const addedId = result?.product?.id || null;

          if (Platform.OS !== "web") {
            try {
              Vibration.vibrate(45);
            } catch (_) {
              // Abaikan jika perangkat tidak mendukung getar
            }
          }

          setSessionScanCount((prev) => prev + 1);
          if (addedId) {
            setLastScannedId(addedId);
          }

          showTemporaryFeedback({
            status: "added",
            text: `${addedName} ditambahkan`,
          });

          cooldownUntilRef.current = Date.now() + GLOBAL_SCAN_COOLDOWN_MS;
          lastCodeRef.current = {
            code,
            until: Date.now() + SAME_CODE_COOLDOWN_MS,
          };

          if (flatListRef.current && addedId) {
            const idx = displayCartRef.current.findIndex(
              (i) => i.product_id === addedId,
            );
            if (idx <= 0) {
              flatListRef.current.scrollToOffset({ offset: 0, animated: true });
            } else {
              try {
                flatListRef.current.scrollToIndex({
                  index: idx,
                  animated: true,
                  viewPosition: 0.25,
                });
              } catch (_) {
                // Tetap aman bila layout item belum terukur
              }
            }
          }
        } else if (result?.status === "not_found") {
          showTemporaryFeedback({
            status: "not_found",
            text: result.message || `Barcode ${code} belum terdaftar`,
          });
          cooldownUntilRef.current = Date.now() + GLOBAL_SCAN_COOLDOWN_MS;
          lastCodeRef.current = {
            code,
            until: Date.now() + NOT_FOUND_COOLDOWN_MS,
          };
        } else {
          showTemporaryFeedback({
            status: "error",
            text: result?.message || "Gagal memindai produk",
          });
          cooldownUntilRef.current = Date.now() + GLOBAL_SCAN_COOLDOWN_MS;
          lastCodeRef.current = {
            code,
            until: Date.now() + SAME_CODE_COOLDOWN_MS,
          };
        }
      } catch (err) {
        if (!isMountedRef.current) return;
        showTemporaryFeedback({
          status: "error",
          text: err?.message || "Gagal mencari produk",
        });
        cooldownUntilRef.current = Date.now() + 1000;
      } finally {
        isProcessingRef.current = false;
      }
    },
    [
      isMultiMode,
      onBarcodeScanned,
      scanProductLocally,
      autoClose,
      navigation,
      showTemporaryFeedback,
    ],
  );

  const handleUpdateQty = (item, nextQty) => {
    if (nextQty <= 0) {
      dispatch({
        type: "REMOVE_FROM_CART",
        payload: { product_id: item.product_id },
      });
      lastCodeRef.current = { code: "", until: 0 };
      if (lastScannedId === item.product_id) {
        setLastScannedId(null);
      }
      return;
    }
    dispatch({
      type: "UPDATE_CART_QTY",
      payload: { product_id: item.product_id, quantity: nextQty },
    });
  };

  if (Platform.OS === "web") {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons
          name="camera-off"
          size={64}
          color={colors.textSecondary}
        />
        <Text style={styles.errorText}>
          Scan barcode tidak tersedia di versi web.
        </Text>
        <Text style={styles.subText}>
          Gunakan perangkat Android untuk memindai barcode dengan kamera.
        </Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
        >
          <Text style={styles.backBtnText}>Keluar Kamera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons
          name="camera"
          size={48}
          color={colors.textSecondary}
        />
        <Text style={styles.errorText}>Meminta izin kamera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons
          name="camera-off"
          size={64}
          color={colors.error}
        />
        <Text style={styles.errorText}>Izin kamera diperlukan.</Text>
        <Text style={styles.subText}>
          Aktifkan akses kamera di Pengaturan HP untuk memindai barcode produk.
        </Text>
        <View style={styles.permissionActions}>
          <TouchableOpacity
            style={styles.secondaryOutlineBtn}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryOutlineBtnText}>Kembali</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => Linking.openSettings()}
            accessibilityRole="button"
          >
            <Text style={styles.backBtnText}>Buka Pengaturan</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const topSafePadding = Math.max(insets.top, 14) + 6;
  const bottomSafePadding =
    Platform.OS === "android"
      ? Math.max(insets.bottom, 36) + 10
      : Math.max(insets.bottom, 16);

  // Mode Kasir: Split-Screen Kamera + Daftar Produk Ter-scan + Tombol Keluar Jelas
  if (isMultiMode) {
    const feedbackBgStyle =
      scanFeedback?.status === "added"
        ? styles.feedbackAdded
        : scanFeedback?.status === "not_found"
          ? styles.feedbackNotFound
          : scanFeedback?.status === "error"
            ? styles.feedbackError
            : styles.feedbackSearching;

    return (
      <View style={styles.container}>
        {/* ── Bagian Atas: Viewport Kamera ── */}
        <View style={styles.cameraSection}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            enableTorch={torchOn}
            onBarcodeScanned={handleBarCodeScanned}
          />

          <View style={styles.cameraScrimLayer}>
            {/* Top Bar di atas Kamera */}
            <View style={[styles.cameraTopBar, { paddingTop: topSafePadding }]}>
              <View style={styles.statusPill}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        scanFeedback?.status === "searching"
                          ? colors.primaryBright
                          : colors.success,
                    },
                  ]}
                />
                <Text style={styles.statusPillText}>
                  {scanFeedback?.status === "searching"
                    ? "Memeriksa..."
                    : "Scan Otomatis Aktif"}
                </Text>
              </View>

              <View style={styles.topRightActions}>
                <TouchableOpacity
                  style={styles.torchBtn}
                  onPress={() => setTorchOn((prev) => !prev)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={
                    torchOn ? "Matikan senter kamera" : "Nyalakan senter kamera"
                  }
                >
                  <MaterialCommunityIcons
                    name={torchOn ? "flashlight" : "flashlight-off"}
                    size={20}
                    color={colors.onPrimary}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.topExitBtn}
                  onPress={() => navigation.goBack()}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Keluar dari kamera"
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={18}
                    color={colors.onPrimary}
                  />
                  <Text style={styles.topExitBtnText}>Keluar</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Bingkai Reticle Barcode */}
            <View style={styles.reticleArea}>
              <View style={styles.scanFrameMulti}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
                <View style={styles.scanLaserLine} />
              </View>
              <Text style={styles.multiHintText}>
                Arahkan barcode kemasan ke dalam kotak
              </Text>
            </View>

            {/* Banner Hasil Scan Melayang (tidak menggeser reticle) */}
            {scanFeedback && (
              <View style={styles.feedbackAnchor}>
                <View style={[styles.feedbackPill, feedbackBgStyle]}>
                  {scanFeedback.status === "searching" ? (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <MaterialCommunityIcons
                      name={
                        scanFeedback.status === "added"
                          ? "check-circle"
                          : scanFeedback.status === "not_found"
                            ? "alert-circle-outline"
                            : "close-circle-outline"
                      }
                      size={18}
                      color={colors.onPrimary}
                    />
                  )}
                  <Text style={styles.feedbackText} numberOfLines={2}>
                    {scanFeedback.text}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* ── Bagian Bawah: Daftar Produk Ter-scan ── */}
        <View style={styles.listSheetSection}>
          <View style={styles.listHeader}>
            <View style={styles.listHeaderLeft}>
              <Text style={styles.listTitle}>Produk Di-scan</Text>
              <Text style={styles.listSubtitle}>
                {cart.length} produk • {totalUnits} unit di keranjang
              </Text>
            </View>
            {sessionScanCount > 0 && (
              <View style={styles.sessionBadge}>
                <MaterialCommunityIcons
                  name="barcode-scan"
                  size={14}
                  color={colors.primaryDark}
                />
                <Text style={styles.sessionBadgeText}>
                  {sessionScanCount}× scan
                </Text>
              </View>
            )}
          </View>

          <FlatList
            ref={flatListRef}
            data={displayCart}
            keyExtractor={(item) => String(item.product_id)}
            contentContainerStyle={
              displayCart.length === 0
                ? styles.emptyListContent
                : styles.scannedListContent
            }
            showsVerticalScrollIndicator={false}
            onScrollToIndexFailed={() => {}}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <View style={styles.emptyIconCircle}>
                  <MaterialCommunityIcons
                    name="barcode-scan"
                    size={28}
                    color={colors.primaryDark}
                  />
                </View>
                <Text style={styles.emptyTitle}>Belum ada produk di-scan</Text>
                <Text style={styles.emptySubtitle}>
                  Arahkan kamera ke barcode produk. Barang yang cocok otomatis masuk daftar ini.
                </Text>
              </View>
            }
            renderItem={({ item, index }) => {
              const { unitPrice, isWholesale, ruleMinQty } =
                resolveScannerUnitPrice(item, plan.isPro);
              const lineSubtotal = unitPrice * Number(item.quantity || 0);
              const isJustScanned = item.product_id === lastScannedId;
              const isLastRow = index === displayCart.length - 1;

              return (
                <View
                  style={[
                    styles.scannedRow,
                    isJustScanned && styles.scannedRowHighlight,
                    !isLastRow && styles.scannedRowDivider,
                  ]}
                >
                  {item.image_uri ? (
                    <Image
                      source={{ uri: item.image_uri }}
                      style={styles.itemThumb}
                    />
                  ) : (
                    <View style={styles.itemThumbPlaceholder}>
                      <MaterialCommunityIcons
                        name="package-variant-closed"
                        size={20}
                        color={colors.primaryDark}
                      />
                    </View>
                  )}

                  <View style={styles.itemInfoCol}>
                    <View style={styles.itemTitleRow}>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {item.product_name}
                      </Text>
                      {isJustScanned && (
                        <View style={styles.newTag}>
                          <Text style={styles.newTagText}>Baru</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.itemPriceRow}>
                      <Text
                        style={[
                          styles.itemUnitPrice,
                          isWholesale && { color: colors.successDark },
                        ]}
                      >
                        {formatRupiah(unitPrice)}
                      </Text>
                      {item.quantity > 1 && (
                        <Text style={styles.itemLineSubtotal}>
                          • {formatRupiah(lineSubtotal)}
                        </Text>
                      )}
                      {isWholesale && (
                        <View style={styles.wholesaleTag}>
                          <Text style={styles.wholesaleTagText}>
                            Grosir ≥{ruleMinQty}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.qtyStepper}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => handleUpdateQty(item, item.quantity - 1)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel={`Kurangi ${item.product_name}`}
                    >
                      <MaterialCommunityIcons
                        name={
                          item.quantity <= 1 ? "trash-can-outline" : "minus"
                        }
                        size={15}
                        color={colors.errorDark}
                      />
                    </TouchableOpacity>

                    <Text style={styles.stepperQtyText}>{item.quantity}</Text>

                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => handleUpdateQty(item, item.quantity + 1)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel={`Tambah ${item.product_name}`}
                    >
                      <MaterialCommunityIcons
                        name="plus"
                        size={15}
                        color={colors.primaryDark}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />

          {/* ── Dock Footer: Ringkasan & Tombol Keluar Kamera ── */}
          <View
            style={[styles.scannerFooter, { paddingBottom: bottomSafePadding }]}
          >
            {cart.length > 0 && (
              <View style={styles.footerSummaryRow}>
                <Text style={styles.footerSummaryLabel}>Total Belanja</Text>
                <Text style={styles.footerSummaryValue}>
                  {formatRupiah(totalAmount)}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.exitCameraBtn,
                cart.length === 0 && styles.exitCameraBtnEmpty,
              ]}
              onPress={() => navigation.goBack()}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel="Keluar kamera dan kembali ke kasir"
            >
              <MaterialCommunityIcons
                name={cart.length > 0 ? "check-circle" : "arrow-left"}
                size={20}
                color={colors.onPrimary}
              />
              <Text style={styles.exitCameraBtnText}>
                {cart.length > 0
                  ? `Keluar Kamera & Selesai (${totalUnits} Item)`
                  : "Keluar Kamera"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Mode Sekali Scan (Tambah / Edit Produk dengan autoClose: true)
  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torchOn}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      <View style={styles.singleOverlay}>
        <View style={[styles.cameraTopBar, { paddingTop: topSafePadding }]}>
          <TouchableOpacity
            style={styles.torchBtn}
            onPress={() => setTorchOn((prev) => !prev)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={
              torchOn ? "Matikan senter kamera" : "Nyalakan senter kamera"
            }
          >
            <MaterialCommunityIcons
              name={torchOn ? "flashlight" : "flashlight-off"}
              size={20}
              color={colors.onPrimary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.topExitBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Keluar dari kamera"
          >
            <MaterialCommunityIcons
              name="close"
              size={18}
              color={colors.onPrimary}
            />
            <Text style={styles.topExitBtnText}>Keluar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.singleCenterArea}>
          <View style={styles.scanFrameSingle}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            <View style={styles.scanLaserLine} />
          </View>
          <Text style={styles.multiHintText}>
            Arahkan kamera ke barcode produk
          </Text>

          {scanned && (
            <TouchableOpacity
              style={styles.rescanBtn}
              onPress={() => {
                setScanned(false);
                isSingleDoneRef.current = false;
              }}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons
                name="barcode-scan"
                size={18}
                color={colors.onPrimary}
              />
              <Text style={styles.rescanText}>Scan Lagi</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const CORNER_SIZE = 24;
const CORNER_THICKNESS = 4;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cameraBg,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: colors.background,
  },
  errorText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.text,
    marginTop: 16,
    textAlign: "center",
  },
  subText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 19,
  },
  permissionActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  backBtn: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
  },
  backBtnText: {
    color: colors.onPrimary,
    fontFamily: fonts.bold,
    fontSize: 13.5,
  },
  secondaryOutlineBtn: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
  },
  secondaryOutlineBtnText: {
    color: colors.textDark,
    fontFamily: fonts.bold,
    fontSize: 13.5,
  },

  // ── Multi-Scan Kamera (Atas) ──
  cameraSection: {
    flex: 0.44,
    backgroundColor: colors.cameraBg,
    overflow: "hidden",
  },
  cameraScrimLayer: {
    flex: 1,
    backgroundColor: colors.cameraScrim,
    justifyContent: "space-between",
    paddingBottom: 24,
  },
  cameraTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: colors.cameraPillBg,
    borderWidth: 1,
    borderColor: colors.cameraPillBorder,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPillText: {
    color: colors.onPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  topRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  torchBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.cameraPillBg,
    borderWidth: 1,
    borderColor: colors.cameraPillBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  topExitBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: colors.cameraPillBg,
    borderWidth: 1,
    borderColor: colors.cameraPillBorder,
  },
  topExitBtnText: {
    color: colors.onPrimary,
    fontFamily: fonts.bold,
    fontSize: 13,
  },

  reticleArea: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  scanFrameMulti: {
    width: 244,
    height: 116,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  scanFrameSingle: {
    width: 248,
    height: 160,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  corner: {
    position: "absolute",
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: colors.onPrimary,
    borderWidth: CORNER_THICKNESS,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 6,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 6,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 6,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 6,
  },
  scanLaserLine: {
    width: "84%",
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.primaryBright,
  },
  multiHintText: {
    color: colors.onPrimary,
    fontFamily: fonts.medium,
    fontSize: 12.5,
    marginTop: 12,
    backgroundColor: colors.cameraPillBg,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    overflow: "hidden",
    textAlign: "center",
  },

  feedbackAnchor: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 22,
    alignItems: "center",
  },
  feedbackPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    maxWidth: "100%",
    elevation: 4,
  },
  feedbackAdded: {
    backgroundColor: colors.successButtonDark,
  },
  feedbackNotFound: {
    backgroundColor: colors.warningTextDark,
  },
  feedbackError: {
    backgroundColor: colors.errorDark,
  },
  feedbackSearching: {
    backgroundColor: colors.secondary,
  },
  feedbackText: {
    color: colors.onPrimary,
    fontFamily: fonts.bold,
    fontSize: 13,
    flexShrink: 1,
  },

  // ── Daftar Produk Di-scan (Bawah) ──
  listSheetSection: {
    flex: 0.56,
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -16,
    overflow: "hidden",
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listHeaderLeft: {
    flex: 1,
    marginRight: 8,
  },
  listTitle: {
    fontSize: 15,
    fontFamily: fonts.extraBold,
    color: colors.text,
  },
  listSubtitle: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginTop: 1,
  },
  sessionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.primaryContainer,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  sessionBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.primaryDark,
  },

  scannedListContent: {
    padding: 12,
    paddingBottom: 16,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  emptyBox: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 22,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryContainer,
    borderWidth: 1,
    borderColor: colors.primaryBorderSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 12.5,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },

  scannedRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scannedRowHighlight: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primaryBorder,
  },
  scannedRowDivider: {
    marginBottom: 8,
  },
  itemThumb: {
    width: 40,
    height: 40,
    borderRadius: 9,
    marginRight: 10,
  },
  itemThumbPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 9,
    marginRight: 10,
    backgroundColor: colors.primaryContainer,
    borderWidth: 1,
    borderColor: colors.primaryBorderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  itemInfoCol: {
    flex: 1,
    marginRight: 8,
  },
  itemTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  itemName: {
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: colors.text,
    flexShrink: 1,
  },
  newTag: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 5,
  },
  newTagText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.primaryTextDark,
  },
  itemPriceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  itemUnitPrice: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: colors.primaryDark,
  },
  itemLineSubtotal: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.textBodySecondary,
  },
  wholesaleTag: {
    backgroundColor: colors.successBadgeBg,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 5,
  },
  wholesaleTagText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.successDark,
  },

  qtyStepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperQtyText: {
    fontSize: 13.5,
    fontFamily: fonts.bold,
    color: colors.text,
    minWidth: 24,
    textAlign: "center",
    marginHorizontal: 4,
  },

  // ── Footer Dock & Tombol Keluar Kamera ──
  scannerFooter: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  footerSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  footerSummaryLabel: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.textBodySecondary,
  },
  footerSummaryValue: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: colors.primaryDark,
  },
  exitCameraBtn: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.primaryDark,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  exitCameraBtnEmpty: {
    backgroundColor: colors.secondary,
  },
  exitCameraBtnText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.onPrimary,
  },

  // ── Single-Scan Mode Overlay ──
  singleOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.cameraScrim,
  },
  singleCenterArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  rescanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 18,
  },
  rescanText: {
    color: colors.onPrimary,
    fontFamily: fonts.bold,
    fontSize: 13.5,
  },
});

export default BarcodeScannerScreen;
