import { Platform, AppState, Alert } from "react-native";
import * as Updates from "expo-updates";

export const AUTO_UPDATE_CHECK_INTERVAL_MS = 60 * 1000;

function defaultIsDevEnv() {
  return typeof __DEV__ !== "undefined" && Boolean(__DEV__);
}

function getEffectiveUpdateId(candidateId) {
  return candidateId ? String(candidateId) : null;
}

/**
 * Factory state-machine pembaruan aplikasi OTA (expo-updates) yang terisolasi
 * agar dapat diuji penuh secara unit test tanpa dependensi runtime native.
 */
export function createAppUpdateManager({
  updatesApi = Updates,
  platformOs = Platform.OS,
  isDev = defaultIsDevEnv(),
  now = () => Date.now(),
  appState = AppState,
} = {}) {
  const isSupported =
    platformOs !== "web" && Boolean(updatesApi?.isEnabled) && !isDev;

  let manualHasUpdate = false;
  let manualReadyToInstall = false;
  let isChecking = false;
  let isUpdating = false;
  let nativeAvailable = false;
  let nativePending = false;
  let nativeChecking = false;
  let nativeDownloading = false;
  let nativeRestarting = false;
  let availableUpdateId = null;
  let updateCreatedAt = null;
  let lastCheckedAt = 0;
  let lastError = null;

  let inFlightCheck = null;
  let inFlightApply = null;
  const listeners = new Set();

  let monitorRefCount = 0;
  let appStateSubscription = null;

  const getSnapshot = () => {
    const hasUpdate = Boolean(
      isSupported &&
        (nativeAvailable ||
          nativePending ||
          manualHasUpdate ||
          manualReadyToInstall),
    );
    const isReadyToInstall = Boolean(
      isSupported && (nativePending || manualReadyToInstall),
    );

    return {
      isSupported,
      isChecking: Boolean(isChecking || nativeChecking),
      isUpdating: Boolean(isUpdating || nativeDownloading || nativeRestarting),
      hasUpdate,
      isReadyToInstall,
      shouldShowBanner: hasUpdate,
      availableUpdateId,
      updateCreatedAt,
      error: lastError,
      lastCheckedAt,
    };
  };

  const notify = () => {
    const snap = getSnapshot();
    listeners.forEach((fn) => {
      try {
        fn(snap);
      } catch (e) {
        console.warn("appUpdate listener error:", e?.message || e);
      }
    });
  };

  const subscribe = (listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const syncFromNativeContext = (nativeCtx = {}) => {
    if (!isSupported) return getSnapshot();

    const nextAvailable = Boolean(nativeCtx.isUpdateAvailable);
    const nextPending = Boolean(nativeCtx.isUpdatePending);
    const nextChecking = Boolean(nativeCtx.isChecking);
    const nextDownloading = Boolean(nativeCtx.isDownloading);
    const nextRestarting = Boolean(nativeCtx.isRestarting);

    const downloaded = nativeCtx.downloadedUpdate;
    const available = nativeCtx.availableUpdate;
    const nextId =
      getEffectiveUpdateId(downloaded?.updateId) ||
      getEffectiveUpdateId(available?.updateId) ||
      availableUpdateId;
    const nextCreatedAt =
      downloaded?.createdAt || available?.createdAt || updateCreatedAt;

    const changed =
      nativeAvailable !== nextAvailable ||
      nativePending !== nextPending ||
      nativeChecking !== nextChecking ||
      nativeDownloading !== nextDownloading ||
      nativeRestarting !== nextRestarting ||
      availableUpdateId !== nextId;

    nativeAvailable = nextAvailable;
    nativePending = nextPending;
    nativeChecking = nextChecking;
    nativeDownloading = nextDownloading;
    nativeRestarting = nextRestarting;
    availableUpdateId = nextId;
    updateCreatedAt = nextCreatedAt;

    if (changed) notify();
    return getSnapshot();
  };

  const checkForUpdate = async ({ silent = false, force = false } = {}) => {
    if (!isSupported) {
      return {
        supported: false,
        hasUpdate: false,
        isReadyToInstall: false,
      };
    }

    const currentSnap = getSnapshot();
    if (currentSnap.isReadyToInstall) {
      return {
        supported: true,
        ...currentSnap,
      };
    }

    const elapsed = now() - lastCheckedAt;
    if (!force && lastCheckedAt > 0 && elapsed < AUTO_UPDATE_CHECK_INTERVAL_MS) {
      return {
        supported: true,
        ...currentSnap,
        throttled: true,
      };
    }

    if (inFlightCheck) {
      return inFlightCheck;
    }

    inFlightCheck = (async () => {
      isChecking = true;
      lastError = null;
      notify();

      try {
        const result = await updatesApi.checkForUpdateAsync();
        lastCheckedAt = now();

        if (result?.isAvailable) {
          manualHasUpdate = true;
          const manifestId = getEffectiveUpdateId(result.manifest?.id);
          if (manifestId) {
            availableUpdateId = manifestId;
          }
          if (result.manifest?.createdAt) {
            updateCreatedAt = result.manifest.createdAt;
          }
        } else if (!nativeAvailable && !nativePending && !manualReadyToInstall) {
          manualHasUpdate = false;
        }

        const updatedSnap = getSnapshot();
        notify();
        return {
          supported: true,
          ...updatedSnap,
        };
      } catch (err) {
        lastError = err?.message || "Gagal memeriksa update.";
        notify();
        if (!silent) {
          throw err;
        }
        return {
          supported: true,
          ...getSnapshot(),
          error: lastError,
        };
      } finally {
        isChecking = false;
        inFlightCheck = null;
        notify();
      }
    })();

    return inFlightCheck;
  };

  const applyUpdate = async () => {
    if (!isSupported) {
      throw new Error("Update OTA hanya tersedia di build APK produksi.");
    }

    if (inFlightApply) {
      return inFlightApply;
    }

    inFlightApply = (async () => {
      isUpdating = true;
      lastError = null;
      notify();

      try {
        if (!nativePending && !manualReadyToInstall) {
          await updatesApi.fetchUpdateAsync();
          manualReadyToInstall = true;
          manualHasUpdate = true;
          notify();
        }
        await updatesApi.reloadAsync();
        return { applied: true };
      } catch (err) {
        lastError = err?.message || "Gagal memasang update.";
        notify();
        throw err;
      } finally {
        isUpdating = false;
        inFlightApply = null;
        notify();
      }
    })();

    return inFlightApply;
  };

  const startMonitor = () => {
    monitorRefCount += 1;
    if (!isSupported) {
      return () => {
        monitorRefCount = Math.max(0, monitorRefCount - 1);
      };
    }

    if (monitorRefCount === 1) {
      void checkForUpdate({ silent: true });

      if (typeof appState?.addEventListener === "function") {
        appStateSubscription = appState.addEventListener(
          "change",
          (nextState) => {
            if (nextState === "active") {
              void checkForUpdate({ silent: true });
            }
          },
        );
      }
    }

    return () => {
      monitorRefCount = Math.max(0, monitorRefCount - 1);
      if (monitorRefCount === 0 && appStateSubscription) {
        appStateSubscription.remove?.();
        appStateSubscription = null;
      }
    };
  };

  return {
    getState: getSnapshot,
    subscribe,
    syncFromNativeContext,
    checkForUpdate,
    applyUpdate,
    startMonitor,
  };
}

const defaultManager = createAppUpdateManager();

export const getAppUpdateState = defaultManager.getState;
export const subscribeAppUpdate = defaultManager.subscribe;
export const syncAppUpdateNativeContext = defaultManager.syncFromNativeContext;
export const checkForAppUpdate = defaultManager.checkForUpdate;
export const applyAppUpdate = defaultManager.applyUpdate;
export const startAppUpdateMonitor = defaultManager.startMonitor;

/**
 * Menampilkan dialog konfirmasi update yang seragam untuk HomeScreen dan PengaturanScreen,
 * lalu mengunduh (jika perlu) dan memuat ulang aplikasi tanpa menghapus data lokal.
 */
export function promptAndApplyAppUpdate({ isReadyToInstall } = {}) {
  const title = isReadyToInstall ? "Update Siap Dipasang" : "Update Tersedia";
  const message = isReadyToInstall
    ? "Pembaruan aplikasi sudah selesai diunduh. Muat ulang sekarang untuk memasangnya? Data transaksi & toko tetap aman."
    : "Versi terbaru aplikasi tersedia. Unduh dan pasang sekarang? Aplikasi akan restart sebentar setelah selesai, data transaksi & toko tetap aman.";
  const actionLabel = isReadyToInstall ? "Pasang Sekarang" : "Update";

  Alert.alert(title, message, [
    { text: "Nanti", style: "cancel" },
    {
      text: actionLabel,
      onPress: async () => {
        try {
          await applyAppUpdate();
        } catch (e) {
          Alert.alert(
            "Gagal Update",
            "Gagal mengunduh atau memasang pembaruan. Pastikan koneksi internet stabil lalu coba lagi.",
          );
        }
      },
    },
  ]);
}
