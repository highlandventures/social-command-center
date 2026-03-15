/**
 * One-off: Backfill sentiment on existing KOL activations.
 * Run with: node prisma/backfill-sentiment.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const POSITIVE_SIGNALS = /🔥|🚀|bullish|excited|congrats|love|great|awesome|amazing|milestone|game.?changer|killer|moon|let'?s go|lfg|gm|onward|upward|\+\d+%/i;
const NEGATIVE_SIGNALS = /bearish|scam|dump|rug|concerned|disappointed|worried|overvalued|fud|sell|warning|avoid|crash|decline/i;

function classifySentiment(content) {
  if (!content) return null;
  const pos = POSITIVE_SIGNALS.test(content);
  const neg = NEGATIVE_SIGNALS.test(content);
  if (pos && !neg) return 'POSITIVE';
  if (neg && !pos) return 'NEGATIVE';
  if (pos && neg) return 'NEUTRAL'; // mixed signals → neutral
  return 'NEUTRAL';
}

async function main() {
  const acts = await prisma.kOLActivation.findMany({ where: { sentiment: null } });
  console.log('Activations without sentiment:', acts.length);
  let pos = 0, neg = 0, neu = 0, mix = 0, nul = 0;
  for (const act of acts) {
    const s = classifySentiment(act.content);
    if (s) {
      await prisma.kOLActivation.update({ where: { id: act.id }, data: { sentiment: s } });
      if (s === 'POSITIVE') pos++;
      else if (s === 'NEGATIVE') neg++;
      else if (s === 'MIXED') mix++;
      else neu++;
    } else {
      nul++;
    }
  }
  console.log('Updated:', { POSITIVE: pos, NEGATIVE: neg, NEUTRAL: neu, MIXED: mix, skipped: nul });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
