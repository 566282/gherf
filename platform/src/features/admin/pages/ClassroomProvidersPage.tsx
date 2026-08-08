import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { listLearningProviders, upsertLearningProvider } from '@/services/api/classroom';

export function ClassroomProvidersPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['classroom-admin-providers'],
    queryFn: listLearningProviders,
  });

  const createMutation = useMutation({
    mutationFn: upsertLearningProvider,
    onSuccess: async () => {
      setName('');
      setSlug('');
      await queryClient.invalidateQueries({ queryKey: ['classroom-admin-providers'] });
      await queryClient.invalidateQueries({ queryKey: ['classroom-providers-public'] });
    },
  });

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Classroom providers</p>
        <h1 className="text-3xl font-semibold text-foreground">Enable, pause, and configure learning institutions</h1>
      </header>

      <Card className="space-y-3 p-4">
        <h2 className="text-lg font-semibold text-foreground">Add provider</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Provider name" className="input-base w-full" />
          <input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="provider-slug" className="input-base w-full" />
        </div>
        <Button
          onClick={() =>
            createMutation.mutate({
              name: name.trim(),
              slug: slug.trim(),
              institutionType: 'provider',
              status: 'active',
            })
          }
          disabled={createMutation.isPending || !name.trim() || !slug.trim()}
        >
          {createMutation.isPending ? 'Saving...' : 'Save provider'}
        </Button>
        {createMutation.error ? <p className="text-sm text-danger">{(createMutation.error as Error).message}</p> : null}
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? <p className="text-sm text-muted">Loading providers...</p> : null}
        {providers.map((provider) => (
          <Card key={provider.id} className="space-y-2 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">{provider.status}</p>
            <h2 className="text-lg font-semibold text-foreground">{provider.name}</h2>
            <p className="text-xs text-muted">{provider.slug}</p>
            <p className="text-xs text-muted">Type: {provider.institutionType}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
