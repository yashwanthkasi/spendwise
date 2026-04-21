import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ParsedTransaction } from '@/services/parser';
import type { TransactionInput } from '@/hooks/useTransactions';

export interface LogArgs {
  parsed: ParsedTransaction;
  accepted: boolean;
  final?: TransactionInput | null;
}

export function useLogParse() {
  return useMutation({
    mutationFn: async ({ parsed, accepted, final }: LogArgs) => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return;

      const corrected =
        accepted && final
          ? {
              type: final.type,
              amount: final.amount,
              category_id: final.category_id,
              group_id: final.group_id,
              note: final.note,
              lending: final.lending ?? null,
            }
          : null;

      const { error } = await supabase.from('parse_logs').insert({
        user_id: user.id,
        raw_input: parsed.rawInput,
        parsed: {
          type: parsed.type,
          amount: parsed.amount,
          category_id: parsed.categoryId,
          group_id: parsed.groupId,
          note: parsed.note,
          lending: parsed.lending,
          confidence: parsed.confidence,
          engine: parsed.engine,
        },
        accepted,
        corrected,
        model: parsed.engine,
      });
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('[parse_log] insert failed', error);
      }
    },
  });
}
