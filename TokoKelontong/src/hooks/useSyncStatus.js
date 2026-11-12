import { useEffect, useState } from "react";
import {
  getSyncState,
  subscribeSync,
  refreshSyncCounts,
} from "../services/syncService";

// Status sinkronisasi (jumlah transaksi belum terkirim, offline, dll.)
// yang otomatis diperbarui di layar.
export default function useSyncStatus() {
  const [status, setStatus] = useState(getSyncState());

  useEffect(() => {
    const unsubscribe = subscribeSync(setStatus);
    setStatus(getSyncState());
    refreshSyncCounts();
    return unsubscribe;
  }, []);

  return status;
}
