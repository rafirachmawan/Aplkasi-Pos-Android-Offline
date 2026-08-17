import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config/supabaseConfig";

// Client Supabase tunggal untuk seluruh aplikasi.
// Sesi login disimpan di AsyncStorage sehingga setelah login sekali,
// aplikasi tetap mengenali akun walau dibuka lagi kemudian.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
