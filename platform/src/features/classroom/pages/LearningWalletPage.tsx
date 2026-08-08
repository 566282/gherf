import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/app/providers/AuthProvider';
import { transferLearningBalance } from '@/services/api/classroom';

export function LearningWalletPage(): JSX.Element {
  const { profile } = useAuth();
  const [amount, setAmount] = useState(100);

  const transferMutation = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error('Authentication required.');
      return transferLearningBalance({ userId: profile.id, amount });
    },
  });

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Learning wallet</p>
        <h1 className="text-3xl font-semibold text-foreground">Transfer released learning balance</h1>
        <p className="text-sm text-muted">Transfers are gated by anti-cheat and release policy checks.</p>
      </header>

      <Card className="space-y-4 p-4">
        <label className="block space-y-2">
          <span className="text-sm text-muted">Amount</span>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(event) => setAmount(Number(event.target.value))}
            className="input-base w-full"
          />
        </label>

        <Button onClick={() => transferMutation.mutate()} disabled={transferMutation.isPending || !profile}>
          {transferMutation.isPending ? 'Transferring...' : 'Transfer to main wallet'}
        </Button>

        {transferMutation.error ? <p className="text-sm text-danger">{(transferMutation.error as Error).message}</p> : null}
        {transferMutation.isSuccess ? (
          <p className="text-sm text-success">Transfer completed with reference {transferMutation.data.transferId}.</p>
        ) : null}
      </Card>
    </div>
  );
}
