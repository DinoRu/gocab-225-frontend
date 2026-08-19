export const SALES_UNITS = [
  "pièce", "jeu", "paire", "litre", "kg",
  "mètre", "boîte", "lot", "rouleau", "sachet",
];
export const DEFAULT_UNIT = "pièce";

// Pluriels explicites (le « +s » automatique ne marche pas pour "jeu"→"jeux", "kg" invariable…)
const UNIT_PLURALS: Record<string, string> = {
  "pièce": "pièces",
  "jeu": "jeux",
  "paire": "paires",
  "litre": "litres",
  "kg": "kg",           // symbole → invariable
  "mètre": "mètres",
  "boîte": "boîtes",
  "lot": "lots",
  "rouleau": "rouleaux",
  "sachet": "sachets",
};

// Accorde l'unité selon la quantité. En français, 0 et 1 → singulier ; ≥ 2 → pluriel.
export function formatUnit(quantity: number, unit: string): string {
  if (quantity >= 2) return UNIT_PLURALS[unit] ?? unit;
  return unit;
}

// Pratique : "2 pièces", "1 litre", "5 jeux"
export function formatQtyUnit(quantity: number, unit: string): string {
  return `${quantity} ${formatUnit(quantity, unit)}`;
}