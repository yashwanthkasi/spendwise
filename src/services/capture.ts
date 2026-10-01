import { supabase } from "@/lib/supabase";
import type { TransactionInput } from "@/hooks/useTransactions";
export type CaptureResult =
  | { status: "saved"; ids: string[] }
  | { status: "clarify"; questions: string[]; items: TransactionInput[] }
  | { status: "review"; items: TransactionInput[] };
export async function capture(
  text: string,
  source: "text_nl" | "voice_nl" | "import",
  requestId: string,
): Promise<CaptureResult> {
  const { data, error } = await supabase.functions.invoke("capture", {
    body: { text, source, requestId, preview: source === "import" },
  });
  if (error) {
    let message =
      "Smart entry is unavailable. Your draft is safe; retry or use the form.";
    try {
      const body = await error.context.json();
      message = body.error ?? message;
    } catch {
      /* network failure */
    }
    throw new Error(message);
  }
  if (data.status === "error") throw new Error(data.error);
  return data;
}
