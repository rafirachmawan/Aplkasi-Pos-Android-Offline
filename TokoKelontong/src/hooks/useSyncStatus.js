import { useEffect, useState } from "react";
import {
  getSyncState,
  subscribeSync,
  refreshSyncCounts,
  checkConnectivity,
} from "../services/syncService";

// Status sinkronisasi (jumlah transaksi belum terkirim, offline, dll.)
// yang otomatis diperbarui di layar.
export default function useSyncStatus() {
  const [status, setStatus] = useState(getSyncState());

  useEffect(() => {
    const unsubscribe = subscribeSync(setStatus);
    setStatus(getSyncState());
    refreshSyncCounts();
    const interval = setInterval(() => {
      void checkConnectivity();
    }, 5000);
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  return status;
}
