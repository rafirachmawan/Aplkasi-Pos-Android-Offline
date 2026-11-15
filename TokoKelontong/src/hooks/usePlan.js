import { useEffect, useState } from "react";
import {
  getPlanStatus,
  subscribePlan,
  refreshPlan,
} from "../services/planService";

/**
 * Status langganan toko: tier efektif (free/pro), tanggal berakhir,
 * dan sisa hari. Berjalan penuh offline karena dihitung lokal.
 *
 * Tier efektif dihitung ulang tiap menit supaya hitung mundur akurat
 * walau aplikasi tidak disentuh.
 */
export default function usePlan() {
  const [status, setStatus] = useState(() => getPlanStatus());

  useEffect(() => {
    const unsubscribe = subscribePlan(() => {
      setStatus(getPlanStatus());
    });
    setStatus(getPlanStatus());

    // Tarik plan terbaru dari server setiap layar dibuka.
    void refreshPlan({ force: true });

    const timer = setInterval(() => {
      setStatus(getPlanStatus());
    }, 60000);

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  return status;
}
