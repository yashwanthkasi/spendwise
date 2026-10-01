import { headers, json, userClient, modelJSON } from "../_shared/runtime.ts";
import { insightFacts } from "../_shared/insights.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const { client } = await userClient(req);
    const { filters = {}, previousFilters } = await req.json();
    const { data: stats, error } = await client.rpc("transaction_summary", {
      p_filters: filters,
    });
    if (error) throw error;
    let previous;
    if (previousFilters) {
      const result = await client.rpc("transaction_summary", {
        p_filters: previousFilters,
      });
      if (result.error) throw result.error;
      previous = result.data;
    }
    const metrics = insightFacts(stats, filters, previous);
    let chosen = metrics.slice(0, 3).map((m) => m.id);
    let engine = "recorded";
    try {
      const result = (await modelJSON(
        "Select the 3 most useful distinct observations for this user. Prefer a change from the previous period, a dominant category, and a meaningful group over repeating the total. Return only {metricIds:string[]}. IDs must exist in the supplied list. Never invent a metric.",
        JSON.stringify(metrics),
      )) as { metricIds?: unknown };
      if (Array.isArray(result.metricIds)) {
        const ids = [...new Set(result.metricIds)]
          .filter((id) => metrics.some((m) => m.id === id))
          .slice(0, 3);
        if (ids.length) {
          chosen = ids as string[];
          engine = "ai";
        }
      }
    } catch {
      /* Deterministic facts remain available without a provider. */
    }
    return json({
      revision: stats.revision,
      engine,
      observations: chosen.map((id) => metrics.find((m) => m.id === id)),
    });
  } catch {
    return json({ error: "Analysis is temporarily unavailable." }, 503);
  }
});
