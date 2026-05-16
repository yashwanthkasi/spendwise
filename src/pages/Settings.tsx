import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Download,
  FileSpreadsheet,
  FileDown,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GroupsManager } from '@/components/settings/GroupsManager';
import { CategoriesManager } from '@/components/settings/CategoriesManager';
import { RecurringSection } from '@/components/automate/RecurringSection';
import { ImportSection } from '@/components/automate/ImportSection';
import { useAuth } from '@/hooks/useAuth';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { useGroups } from '@/hooks/useGroups';
import { useTransactions } from '@/hooks/useTransactions';
import { exportCSV, exportPDF } from '@/services/export';
import { activeProvider } from '@/services/parser/ai';
import { getGroqModel } from '@/lib/groq';
import { getGeminiModel } from '@/lib/gemini';

export default function Settings() {
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const { data: groups = [] } = useGroups();
  const { data: txns = [] } = useTransactions({ limit: 5000 });
  const updateProfile = useUpdateProfile();
  const [busy, setBusy] = useState<'csv' | 'pdf' | null>(null);

  // Anchor-scroll for /groups and /categories redirects.
  const groupsRef = useRef<HTMLDivElement>(null);
  const categoriesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.replace('#', '');
    if (hash === 'groups') groupsRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (hash === 'categories') categoriesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const provider = activeProvider();

  async function handleCSV() {
    setBusy('csv');
    try {
      await exportCSV(txns);
      toast.success('CSV downloaded');
    } finally {
      setBusy(null);
    }
  }
  async function handlePDF() {
    setBusy('pdf');
    try {
      await exportPDF(txns);
      toast.success('PDF downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'PDF failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" />

      {/* Profile */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-2">
          <div className="text-sm">
            <div className="text-xs text-muted-foreground">Signed in as</div>
            <div className="truncate">{user?.email}</div>
          </div>
          <div className="text-sm">
            <div className="text-xs text-muted-foreground">Timezone</div>
            <div>{profile?.timezone ?? '—'}</div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Default group</Label>
            <Select
              value={profile?.default_group_id ?? ''}
              onValueChange={async (v) => {
                try {
                  await updateProfile.mutateAsync({ default_group_id: v });
                  toast.success('Default group updated');
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Failed');
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.emoji ?? '📁'} {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* AI provider */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4" /> AI parser
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-4 pt-2 text-sm">
          {provider === 'gemini' && (
            <p>
              Active: <b>Gemini</b> · model{' '}
              <code className="rounded bg-muted px-1 text-xs">{getGeminiModel()}</code>
            </p>
          )}
          {provider === 'groq' && (
            <p>
              Active: <b>Groq</b> (Gemini missing) · model{' '}
              <code className="rounded bg-muted px-1 text-xs">{getGroqModel()}</code>
            </p>
          )}
          {provider === 'none' && (
            <p className="text-amber-600">
              No AI key set. Regex fallback in use. Add{' '}
              <code className="rounded bg-muted px-1 text-xs">VITE_GEMINI_API_KEY</code>{' '}
              or <code className="rounded bg-muted px-1 text-xs">VITE_GROQ_API_KEY</code>{' '}
              to your <code>.env</code> and restart the dev server.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Order: Gemini → Groq → regex. The first available one is used.
          </p>
        </CardContent>
      </Card>

      {/* Groups */}
      <Card ref={groupsRef} id="groups">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Groups</CardTitle>
          <p className="text-xs text-muted-foreground">
            Buckets for your transactions — Home, Office, trips, etc.
          </p>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <GroupsManager />
        </CardContent>
      </Card>

      {/* Categories */}
      <Card ref={categoriesRef} id="categories">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Categories</CardTitle>
          <p className="text-xs text-muted-foreground">
            Sub-classes under each type. Hover a category for its description.
          </p>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <CategoriesManager />
        </CardContent>
      </Card>

      {/* Automation — recurring rules + statement import */}
      <Card id="automation">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Automation</CardTitle>
          <p className="text-xs text-muted-foreground">
            Recurring rules fire on app load. Paste bank statements to bulk-add.
          </p>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <Tabs defaultValue="recurring" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="recurring">🔁 Recurring</TabsTrigger>
              <TabsTrigger value="import">📥 Import</TabsTrigger>
            </TabsList>
            <TabsContent value="recurring">
              <RecurringSection />
            </TabsContent>
            <TabsContent value="import">
              <ImportSection />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Export */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Export</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2 p-4 pt-2">
          <Button variant="outline" size="sm" onClick={handleCSV} disabled={busy !== null}>
            <FileSpreadsheet className="h-4 w-4" />
            {busy === 'csv' ? 'Preparing…' : 'CSV'}
          </Button>
          <Button variant="outline" size="sm" onClick={handlePDF} disabled={busy !== null}>
            <FileDown className="h-4 w-4" />
            {busy === 'pdf' ? 'Preparing…' : 'PDF'}
          </Button>
          <span className="text-xs text-muted-foreground">
            <Download className="mr-1 inline h-3 w-3" />
            {txns.length} transaction{txns.length === 1 ? '' : 's'}
          </span>
        </CardContent>
      </Card>

      {/* Sign out */}
      <Card>
        <CardContent className="p-4">
          <Button variant="outline" className="w-full gap-2" onClick={() => signOut()}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
