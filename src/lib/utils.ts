import { db } from './db';

export async function parseMedicines(input: string) {
  if (!input) return [];
  
  // Split by '+' or ',' and trim
  const codes = input.split(/[+,]/).map(c => c.trim().toUpperCase()).filter(Boolean);
  
  if (codes.length === 0) return [];

  // Fetch from db
  const { data, error } = await db
    .from('medicines')
    .select('*')
    .in('code', codes);

  if (error) {
    console.error("Error fetching medicines:", error);
    return [];
  }

  // Map to format
  return codes.map(code => {
    const med = data.find(m => m.code.toUpperCase() === code);
    return {
      code,
      name: med ? med.name : 'Unknown Medicine',
      found: !!med
    };
  });
}

