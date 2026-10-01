import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { useGroups } from "@/hooks/useGroups";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
export default function Settings() {
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const { data: groups = [] } = useGroups();
  const update = useUpdateProfile();
  return (
    <div className="space-y-7">
      <Link to="/more" className="text-sm text-muted-foreground">
        ← More
      </Link>
      <PageHeader title="Settings" />
      <section className="space-y-4 border-b pb-6">
        <h2 className="text-sm font-medium">Your account</h2>
        <p className="break-all text-sm text-muted-foreground">{user?.email}</p>
        <p className="text-sm text-muted-foreground">
          Timezone: {profile?.timezone ?? "Loading…"}
        </p>
      </section>
      <label className="block text-sm">
        Default group
        <select
          className="mt-2 block w-full rounded-xl border bg-card p-3"
          value={profile?.default_group_id ?? ""}
          disabled={update.isPending}
          onChange={(e) =>
            update.mutate(
              { default_group_id: e.target.value || null },
              { onError: () => toast.error("Could not save preference") },
            )
          }
        >
          <option value="">No default group</option>
          {groups
            .filter((g) => !g.archived)
            .map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
        </select>
      </label>
      <label className="flex items-start gap-3 border-y py-5">
        <input
          className="mt-1 h-5 w-5 accent-primary"
          type="checkbox"
          checked={profile?.location_enabled ?? false}
          disabled={update.isPending}
          onChange={(e) =>
            update.mutate(
              { location_enabled: e.target.checked },
              { onError: () => toast.error("Could not save preference") },
            )
          }
        />
        <span className="text-sm">
          Tag new entries with my location
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
            Optional. Your browser asks for access when you next add a
            transaction. Saving never waits for a location.
          </span>
        </span>
      </label>
      <p className="text-sm text-muted-foreground">
        Microphone access is requested only when you tap the microphone. You can
        always type or use the form.
      </p>
      <Button
        variant="outline"
        onClick={() =>
          void signOut().catch(() => toast.error("Could not sign out"))
        }
      >
        Sign out
      </Button>
    </div>
  );
}
