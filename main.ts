// Deterministic make.fun bot: one buy per fresh, priceable curve.
// Tracks CreateEvent mints, drops complete/too-small curves, never doubles up.
import { LAMPORTS_PER_SOL, runBot, type BuyInput } from './vendor/makefun-bot.ts';

const MIN_CAP = LAMPORTS_PER_SOL / 200n;
const SIZE = LAMPORTS_PER_SOL / 20n;

const candidates = new Set<string>();
const bought = new Set<string>();

await runBot({
  onBatch(state, batch) {
    for (const event of batch.events) {
      if (event.event === 'CreateEvent' && event.mint) candidates.add(event.mint);
    }
    const orders: BuyInput[] = [];
    for (const mint of candidates) {
      if (orders.length >= state.hello.caps.max_orders_per_batch) break;
      if (bought.has(mint)) continue;
      const curve = state.curves.get(mint);
      if (!curve) continue;
      const cap = state.maxBuyLamports(mint);
      if (curve.complete || cap < MIN_CAP) { candidates.delete(mint); continue; }
      if (state.committedPositionCount() + orders.length >= state.hello.caps.max_open_positions) break;
      const amount = cap < SIZE ? cap : SIZE;
      if (state.freeCashLamports() < amount + state.txFeeLamports()) continue;
      orders.push({ side: 'buy', mint, quote_lamports: amount, max_slippage_bps: 10000 });
      bought.add(mint);
    }
    return orders;
  },
});
