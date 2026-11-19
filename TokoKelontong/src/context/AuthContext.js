import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "../services/supabaseClient";
import { getProfile, clearStoreLocalSession } from "../services/authService";
import {
  getAuthSnapshot,
  saveAuthSnapshot,
  clearAuthSnapshot,
  getLastStoreId,
  setLastStoreId,
} from "../services/sessionStore";
import { startSyncEngine, stopSyncEngine } from "../services/syncService";
import {
  startPlanEngine,
  stopPlanEngine,
  refreshPlan,
  clearPlan,
} from "../services/planService";

const AuthContext = createContext(null);

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

// Kegagalan karena jaringan (bukan karena akun/sesi ditolak server).
function isNetworkFailure(err) {
  if (!err) return false;
  if (err.name === "AuthRetryableFetchError") return true;
  const msg = String(err.message || "").toLowerCase();
  return (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("abort") ||
    msg.includes("connection")
  );
}

function profileFromSnapshot(snap) {
  return {
    id: snap.user_id,
    username: snap.username,
    role: snap.role,
    store_id: snap.store_id,
    stores: {
      id: snap.store_id,
      store_name: snap.store_name,
      security_pin_hash: snap.security_pin_hash || null,
      security_pin: snap.security_pin || null,
      locked_menus: snap.locked_menus ?? null,
    },
  };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(false);
  // true bila HP offline & sesi belum bisa diperbarui, tetapi akun pernah
  // login di HP ini (data akun diambil dari salinan lokal).
  const [offlineAuthed, setOfflineAuthed] = useState(false);
  const userIdRef = useRef(null);

  // Ambil profile dengan retry kecil: saat registrasi, baris profile
  // bisa terlambat sebentar dibuat oleh rpc register_store.
  const loadProfile = useCallback(async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const p = await withTimeout(getProfile(), 10000);
        // Ganti toko di HP yang sama: bersihkan pengaturan toko sebelumnya
        // SEBELUM setProfile agar tidak menghapus plan yang baru di-refresh.
        const lastStore = await getLastStoreId();
        if (lastStore && p?.store_id && lastStore !== p.store_id) {
          await clearStoreLocalSession({ full: true });
          await clearPlan();
        }
        await saveAuthSnapshot(p);
        if (p?.store_id) await setLastStoreId(p.store_id);
        setProfile(p);
        if (p?.store_id) {
          void refreshPlan({ force: true, storeId: p.store_id });
        }
        return;
      } catch (e) {
        if (isNetworkFailure(e)) break; // offline: jangan menunggu retry
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 800));
        }
      }
    }

    // Gagal memuat dari server: pakai salinan lokal hanya bila milik user yang sama.
    const snap = await getAuthSnapshot();
    if (snap && snap.user_id && snap.user_id === userIdRef.current) {
      setProfile(profileFromSnapshot(snap));
    } else {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      let sess = null;
      let err = null;
      try {
        const res = await withTimeout(supabase.auth.getSession(), 6000);
        sess = res.data?.session || null;
        err = res.error || null;
      } catch (e) {
        err = e;
      }
      if (cancelled) return;

      if (sess) {
        userIdRef.current = sess.user?.id || null;
        setSession(sess);
        setOfflineAuthed(false);
        loadProfile();
      } else {
        // Sesi server null atau gagal jaringan/timeout:
        // Cek apakah ada snapshot akun tersimpan di HP ini (K-04, K-05, T-O-01, T-O-04).
        // Hapus snapshot HANYA saat logout eksplisit (SIGNED_OUT / signOut).
        const snap = await getAuthSnapshot();
        if (cancelled) return;
        if (snap && snap.user_id) {
          userIdRef.current = snap.user_id;
          setOfflineAuthed(true);
          setProfile(profileFromSnapshot(snap));
        } else {
          userIdRef.current = null;
          setSession(null);
          setProfile(null);
          setOfflineAuthed(false);
        }
      }
      setReady(true);
    };
    init();

    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (s) {
        const nextUid = s.user?.id || null;
        if (userIdRef.current && userIdRef.current !== nextUid) {
          setProfile(null);
        }
        userIdRef.current = nextUid;
        setSession(s);
        setOfflineAuthed(false);
        loadProfile();
      } else if (event === "SIGNED_OUT") {
        userIdRef.current = null;
        setSession(null);
        setProfile(null);
        setOfflineAuthed(false);
        clearAuthSnapshot();
        clearStoreLocalSession();
        // Hapus cache langganan milik toko lama. Outbox & katalog tidak disentuh.
        void clearPlan();
      }
      // Event lain tanpa sesi (mis. INITIAL_SESSION saat offline) diabaikan:
      // status login ditentukan oleh init() di atas.
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [loadProfile]);

  // Mesin sinkronisasi jalan selama ada akun aktif di HP ini.
  const storeId = profile?.store_id || null;
  useEffect(() => {
    if (storeId) {
      startSyncEngine();
      startPlanEngine();
      // Segarkan plan begitu toko diketahui (bisa jadi baru diaktifkan Pro).
      void refreshPlan({ force: true, storeId });
      return () => {
        stopSyncEngine();
        stopPlanEngine();
      };
    }
    return undefined;
  }, [storeId]);

  const effectiveSession =
    session || (offlineAuthed ? { offline: true, user: { id: userIdRef.current } } : null);

  return (
    <AuthContext.Provider
      value={{
        session: effectiveSession,
        profile,
        ready,
        offlineAuthed,
        refreshProfile: loadProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
