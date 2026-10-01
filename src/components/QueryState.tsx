import { Button } from "./ui/button";
export function QueryState({
  loading,
  error,
  retry,
}: {
  loading?: boolean;
  error?: unknown;
  retry?: () => void;
}) {
  if (loading)
    return (
      <p role="status" className="py-8 text-sm text-muted-foreground">
        Loading your transactions…
      </p>
    );
  if (error)
    return (
      <div role="alert" className="rounded-xl border p-5">
        <p className="mb-3 text-sm">
          We couldn’t load your data. Please try again.
        </p>
        <Button variant="outline" onClick={retry}>
          Retry
        </Button>
      </div>
    );
  return null;
}
