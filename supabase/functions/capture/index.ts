import { headers, json, userClient, modelJSON } from "../_shared/runtime.ts";
import {
  parserPrompt,
  validatePayload,
  type Context,
} from "../_shared/validation.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const { client, user } = await userClient(req);
    const body = await req.json();
    if (
      typeof body.text !== "string" ||
      !body.text.trim() ||
      body.text.length > 20000 ||
      !["text_nl", "voice_nl", "import"].includes(body.source)
    )
      return json(
        { error: "Enter a transaction description (up to 20,000 characters)." },
        400,
      );
    if (!/^[0-9a-f-]{36}$/i.test(body.requestId ?? ""))
      return json({ error: "Request ID required" }, 400);
    const { data: previous, error: previousError } = await client
      .from("capture_requests")
      .select("transaction_ids")
      .eq("user_id", user.id)
      .eq("request_id", body.requestId)
      .maybeSingle();
    if (previousError) throw previousError;
    if (previous)
      return json({ status: "saved", ids: previous.transaction_ids });
    const [cats, groups, profile, rules] = await Promise.all([
      client.from("categories").select("id,name,type"),
      client.from("groups").select("id,name,archived"),
      client.from("profiles").select("*").eq("id", user.id).single(),
      client.from("category_rules").select("phrase,category_id"),
    ]);
    for (const r of [cats, groups, profile, rules]) if (r.error) throw r.error;
    const ctx: Context = {
      categories: cats.data!,
      groups: groups.data!,
      defaultGroupId: profile.data.default_group_id,
      timezone: profile.data.timezone,
      now: new Date().toISOString(),
      rules: rules.data!,
    };
    const payload = await modelJSON(parserPrompt(ctx), body.text);
    const result = validatePayload(payload, ctx, body.text, body.source);
    if (result.questions.length)
      return json({
        status: "clarify",
        questions: result.questions,
        items: result.items,
      });
    if (body.preview === true || body.source === "import")
      return json({ status: "review", items: result.items });
    const { data: ids, error } = await client.rpc("save_transactions", {
      p_request_id: body.requestId,
      p_items: result.items,
    });
    if (error) throw error;
    return json({ status: "saved", ids });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Unable to save. Your draft is safe.";
    return json(
      { status: "error", error: message },
      message === "Not signed in" ? 401 : 503,
    );
  }
});
