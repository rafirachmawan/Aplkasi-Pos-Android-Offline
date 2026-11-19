import { useEffect, useState } from "react";
import * as Updates from "expo-updates";
import {
  getAppUpdateState,
  subscribeAppUpdate,
  syncAppUpdateNativeContext,
  checkForAppUpdate,
  applyAppUpdate,
  dismissAppUpdateBanner,
  startAppUpdateMonitor,
  promptAndApplyAppUpdate,
} from "../services/appUpdateService";

/**
 * Hook reaktif status pembaruan OTA (EAS Update) untuk HomeScreen badge card
 * maupun tombol manual di PengaturanScreen.
 */
export default function useAppUpdate() {
  const nativeUpdates = Updates.useUpdates();
  const [status, setStatus] = useState(() => getAppUpdateState());

  useEffect(() => {
    const unsubscribe = subscribeAppUpdate(setStatus);
    const stopMonitor = startAppUpdateMonitor();
    setStatus(getAppUpdateState());
    return () => {
      stopMonitor();
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    syncAppUpdateNativeContext(nativeUpdates);
  }, [
    nativeUpdates.isUpdateAvailable,
    nativeUpdates.isUpdatePending,
    nativeUpdates.isChecking,
    nativeUpdates.isDownloading,
    nativeUpdates.isRestarting,
    nativeUpdates.availableUpdate?.updateId,
    nativeUpdates.downloadedUpdate?.updateId,
  ]);

  return {
    ...status,
    checkForUpdate: checkForAppUpdate,
    applyUpdate: applyAppUpdate,
    dismissBanner: dismissAppUpdateBanner,
    promptApplyUpdate: () =>
      promptAndApplyAppUpdate({
        isReadyToInstall: status.isReadyToInstall,
      }),
  };
}
