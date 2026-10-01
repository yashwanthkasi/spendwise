interface Stats {
  count: number;
  by_type: Record<string, { amount: number; count: number }>;
  categories: {
    id: string | null;
    name: string;
    amount: number;
    count: number;
  }[];
  groups: { id: string | null; name: string; amount: number; count: number }[];
  revision: string;
}
export function insightFacts(
  stats: Stats,
  filters: Record<string, string>,
  previous?: Stats,
) {
  const spent = stats.by_type.expense?.amount ?? 0;
  const count = stats.by_type.expense?.count ?? 0;
  const facts: {id:string;label:string;amount:number;detail:string;filter:Record<string,string>}[] = [
    {
      id: "spending",
      label: "Your spending",
      amount: spent,
      detail: `Across ${count} recorded expense${count === 1 ? "" : "s"} in this period.`,
      filter: { ...filters, type: "expense" },
    },
  ];
  for (const c of stats.categories) {
    if (!c.id) continue;
    facts.push({
      id: `category:${c.id}`,
      label: c.name,
      amount: c.amount,
      detail: `${spent ? Math.round((c.amount / spent) * 100) : 0}% of spending, across ${c.count} transaction${c.count === 1 ? "" : "s"}.`,
      filter: { ...filters, type: "expense", categoryId: c.id },
    });
  }
  for (const g of stats.groups) {
    if (!g.id) continue;
    facts.push({
      id: `group:${g.id}`,
      label: g.name,
      amount: g.amount,
      detail: `${g.count} expense${g.count === 1 ? "" : "s"} in this group.`,
      filter: { ...filters, type: "expense", groupId: g.id },
    });
  }
  const prior = previous?.by_type.expense?.amount ?? 0;
  if (prior > 0)
    facts.push({
      id: "comparison",
      label: spent >= prior ? "Spending increased" : "Spending decreased",
      amount: Math.abs(spent - prior),
      detail: `${Math.round((Math.abs(spent - prior) / prior) * 100)}% ${spent >= prior ? "more" : "less"} than the matching previous period.`,
      filter: { ...filters, type: "expense" },
    });
  return facts;
}
