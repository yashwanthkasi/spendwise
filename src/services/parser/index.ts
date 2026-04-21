import { parseWithRegex } from './regex';
import { parseWithAI, isAIEnabled } from './ai';
import type { ParseContext, ParsedTransaction } from './types';
import { PARSE_CONFIDENCE_THRESHOLD } from '@/lib/constants';

export type { ParsedTransaction, ParseContext } from './types';
export { PARSE_CONFIDENCE_THRESHOLD };

export async function parseTransaction(
  input: string,
  ctx: ParseContext,
): Promise<ParsedTransaction | null> {
  if (!input.trim()) return null;

  if (isAIEnabled()) {
    try {
      const ai = await parseWithAI(input, ctx);
      if (ai) return ai;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[parser] AI failed, falling back to regex', err);
    }
  }
  return parseWithRegex(input, ctx);
}
