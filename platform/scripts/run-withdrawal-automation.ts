import { runWithdrawalAutomationRunner } from '../src/server/withdrawalAutomationRunner';

async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // eslint-disable-next-line no-console
    console.log('Withdrawal automation skipped because Supabase credentials are not configured.');
    return;
  }

  const limit = Number(process.env.WITHDRAWAL_AUTOMATION_LIMIT ?? '120');
  const result = await runWithdrawalAutomationRunner(Number.isFinite(limit) ? limit : 120);

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
