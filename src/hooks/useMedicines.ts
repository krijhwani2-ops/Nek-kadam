import { useState, useEffect } from 'react';
import { db } from '../lib/db';

export interface Medicine {
  code: string;
  name: string;
  stock_level?: number;
  reorder_level?: number;
}

export function useMedicines() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchMedicines() {
    setLoading(true);
    const { data, error } = await db
      .from('medicines')
      .select('*')
      .order('code');

    if (!error && data) {
      setMedicines(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchMedicines();
  }, []);

  return { medicines, loading, refetch: fetchMedicines, setMedicines, setLoading };
}
