export async function parseCSV(file: File): Promise<{ uniqueSerials: string[], duplicatedSerials: string[] }> {
  const text = await file.text();
  const rawTokens = text.split(/[\r\n,;]+/).map(t => t.trim()).filter(t => t.length > 0);
  
  // Assumimos que seriais possuem formato válido (ex: C25Z...S ou alphanumeric de bom tamanho)
  const serials = rawTokens.filter(t => t.length >= 6 && /^[A-Za-z0-9]+$/.test(t));
  
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  
  for (const s of serials) {
    if (seen.has(s)) {
      duplicates.add(s);
    }
    seen.add(s);
  }
  
  return {
    uniqueSerials: Array.from(seen),
    duplicatedSerials: Array.from(duplicates)
  };
}
