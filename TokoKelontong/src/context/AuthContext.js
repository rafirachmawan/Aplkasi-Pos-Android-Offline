import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { supabase } from "../services/supabaseClient";
import { getProfile } from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(false);

  // Ambil profile dengan retry kecil: saat registrasi, baris profile
  // bisa terlambat sebentar dibuat oleh rpc register_store.
  const loadProfile = useCallback(async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const p = await getProfile();
        setProfile(p);
        return;
      } catch (e) {
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 800));
        } else {
          setProfile(null);
        }
      }
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadProfile();
      setReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (s) {
        loadProfile();
      } else {
        setProfile(null);
      }
    });

    return () => data.subscription.unsubscribe();
  }, [loadProfile]);

  return (
    <AuthContext.Provider
      value={{ session, profile, ready, refreshProfile: loadProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
