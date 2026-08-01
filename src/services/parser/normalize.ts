import type { Category, TransactionType } from '@/lib/db-types';
import type { ParsedTransaction } from './types';

interface CanonicalRule {
  type: TransactionType;
  category: string;
  pattern: RegExp;
}

/**
 * Strong, unambiguous keyword -> canonical category rules.
 *
 * These are applied AFTER any engine (AI or regex) produces a result, so the
 * SAME phrase always lands in the SAME category regardless of model variance.
 * This fixes the "petrol 40 -> sometimes Fuel, sometimes Transport" problem:
 * fuel words are pinned to Fuel, ride words are pinned to Transport.
 *
 * Order matters — the first matching rule wins.
 */
const CANONICAL_RULES: CanonicalRule[] = [
  {
    type: 'expense',
    category: 'Fuel',
    pattern:
      /\b(petrol|diesel|cng|fuel|gas\s?bunk|gas\s?station|fuel\s?station|petrol\s?pump|iocl|indian\s?oil|bpcl|bharat\s?petroleum|hpcl|hp\s?petrol|shell)\b/i,
  },
  {
    type: 'expense',
    category: 'Transport',
    pattern:
      /\b(uber|ola|rapido|cab|taxi|auto\s?rickshaw|rickshaw|auto|metro|local\s?train|train|bus|ride|namma\s?yatri|blusmart|share\s?auto)\b/i,
  },
];

export interface CanonicalHit {
  type: TransactionType;
  category: string;
}

/** Returns the canonical {type, category} for a phrase, or null if none apply. */
export function canonicalCategory(text: string | null | undefined): CanonicalHit | null {
  if (!text) return null;
  for (const rule of CANONICAL_RULES) {
    if (rule.pattern.test(text)) {
      return { type: rule.type, category: rule.category };
    }
  }
  return null;
}

/**
 * Force a parsed transaction onto its canonical category when a strong keyword
 * is present. Resolves the category id against the user's own category list and
 * boosts confidence so known phrases auto-save instead of asking to confirm.
 */
export function applyCanonical(
  parsed: ParsedTransaction,
  categories: Category[],
): ParsedTransaction {
  // Only re-pin plain expenses. Never hijack a lending/income/investment/
  // transfer that merely mentions a fuel/ride word ("lent Ravi 2000 for petrol").
  if (parsed.type !== 'expense') return parsed;

  const hit = canonicalCategory(`${parsed.note ?? ''} ${parsed.rawInput ?? ''}`);
  if (!hit) return parsed;

  const match = categories.find(
    (c) =>
      c.type === hit.type &&
      c.name.toLowerCase() === hit.category.toLowerCase(),
  );

  return {
    ...parsed,
    type: hit.type,
    categoryId: match?.id ?? parsed.categoryId,
    categoryName: match?.name ?? hit.category,
    confidence: Math.max(parsed.confidence, 0.95),
  };
}
