import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/PageHeader';
import { RecurringSection } from '@/components/automate/RecurringSection';
import { ImportSection } from '@/components/automate/ImportSection';

export default function Automate() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'import' ? 'import' : 'recurring';

  return (
    <div className="space-y-5">
      <PageHeader title="Automate" subtitle="Recurring rules & bulk import" />

      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = new URLSearchParams(params);
          if (v === 'recurring') next.delete('tab');
          else next.set('tab', v);
          setParams(next, { replace: true });
        }}
        className="w-full"
      >
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
    </div>
  );
}
