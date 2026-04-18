/**
 * Seed the BrandEntity rows for the Figure ecosystem.
 *
 * Idempotent: safe to run multiple times. Upserts by (topicId, canonicalName).
 * After inserting entities, the ontology sync is NOT run here — run it separately
 * via the `listening.syncQueries` tRPC mutation or the `sync-ontology` admin UI
 * once you've confirmed the seed rows look right.
 *
 * Usage:
 *   cd apps/social && node prisma/seed-figure-ontology.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_PRISMA_URL } },
});

const figureEntities = [
  // ─── Brand parent ─────────────────────────────────────────────
  {
    kind: 'BRAND',
    canonicalName: 'Figure Technology Solutions',
    aliases: ['Figure Technologies', 'FigureTech'],
    tickers: ['$FIGR'],
    xHandles: ['Figure'],
    hashtags: [],
    isAmbiguous: false,
    qualifiers: [],
    negativeTerms: ['figure out', 'figure skating', 'action figure', 'figurine'],
  },

  // ─── Products ─────────────────────────────────────────────────
  {
    kind: 'PRODUCT',
    canonicalName: 'Figure Markets',
    aliases: ['FigureMarkets'],
    xHandles: ['FigureMarkets'],
    isAmbiguous: false,
    negativeTerms: [],
  },
  {
    kind: 'PRODUCT',
    canonicalName: 'Figure Lending',
    aliases: ['Figure HELOC', 'Figure home equity', 'Figure loan', 'Figure refinance'],
    tickers: ['$FIGR_HELOC'],
    hashtags: ['#FigureHELOC'],
    isAmbiguous: false,
    negativeTerms: ['figure out', 'figure skating'],
  },
  {
    kind: 'PRODUCT',
    canonicalName: 'Figure Pay',
    aliases: ['FGRD'],
    isAmbiguous: false,
    negativeTerms: [],
  },
  {
    kind: 'PRODUCT',
    canonicalName: 'Figure Connect',
    aliases: [],
    isAmbiguous: true,
    qualifiers: ['Figure', 'FIGR', 'HELOC', 'marketplace', 'blockchain', 'lending', 'RWA'],
    negativeTerms: ['figure out', 'figurine', 'connect 4', 'figure skating'],
  },
  {
    kind: 'SUBSIDIARY',
    canonicalName: 'Figure ATS',
    aliases: ['Figure Securities'],
    isAmbiguous: false,
    negativeTerms: [],
  },
  {
    kind: 'PRODUCT',
    canonicalName: 'On-chain Public Equity',
    aliases: ['Blockchain Stock', 'OPEN network'],
    isAmbiguous: true,
    qualifiers: ['Figure', 'FIGR', 'Provenance', 'tokenized equity'],
    negativeTerms: ['open source', 'open letter', 'ice open network', 'pi network'],
  },

  // ─── Ecosystem blockchain + token ─────────────────────────────
  {
    kind: 'BRAND',
    canonicalName: 'Provenance Blockchain',
    aliases: ['provenance.io'],
    xHandles: ['provenancefdn'],
    isAmbiguous: false,
    negativeTerms: ['giveaway', 'airdrop', 'scam', 'provenance chain'],
  },
  {
    kind: 'TOKEN',
    canonicalName: '$HASH',
    tickers: ['$HASH'],
    isAmbiguous: true,
    qualifiers: ['Provenance', 'Figure', 'RWA', 'validator', 'staking', 'delegator', 'ProvWasm'],
    negativeTerms: ['hashtag', 'hash rate', 'hashrate', 'hash function', 'hash brown'],
  },

  // ─── Hastra / PRIME (Solana layer) ────────────────────────────
  {
    kind: 'BRAND',
    canonicalName: 'HastraFi',
    aliases: ['Hastra'],
    xHandles: ['HastraFi'],
    isAmbiguous: false,
    negativeTerms: [],
  },
  {
    kind: 'TOKEN',
    canonicalName: '$PRIME',
    tickers: ['$PRIME'],
    isAmbiguous: true,
    qualifiers: ['Figure', 'Provenance', 'Hastra', 'Democratized Prime', 'Solana', 'RWA', 'Kamino', 'Chainlink'],
    negativeTerms: ['amazon prime', 'prime video', 'prime minister', 'optimus prime'],
  },
  {
    kind: 'PRODUCT',
    canonicalName: 'Democratized Prime',
    aliases: ['Intellidebt', 'DART Digital Asset Registry'],
    isAmbiguous: false,
    negativeTerms: [],
  },

  // ─── People ───────────────────────────────────────────────────
  {
    kind: 'PERSON',
    canonicalName: 'Mike Cagney',
    xHandles: ['mcagney'],
    qualifiers: ['Figure', 'FIGR', 'Provenance', 'HELOC', 'YLDS', 'Hastra', 'PRIME', 'blockchain', 'RWA', 'tokenized'],
    isAmbiguous: false,
    negativeTerms: [],
  },

  // ─── $YLDS (stablecoin) ───────────────────────────────────────
  {
    kind: 'TOKEN',
    canonicalName: '$YLDS',
    aliases: ['YLDS stablecoin'],
    tickers: ['$YLDS'],
    hashtags: ['#YLDS'],
    isAmbiguous: false,
    negativeTerms: [],
  },
];

(async () => {
  const topic = await prisma.listeningTopic.findFirst({
    where: { name: { contains: 'Figure', mode: 'insensitive' } },
    orderBy: { createdAt: 'asc' },
  });
  if (!topic) {
    console.error('No Figure-named ListeningTopic found. Create one first.');
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`Seeding entities into topic "${topic.name}" (${topic.id})`);
  let inserted = 0;
  let updated = 0;
  for (const ent of figureEntities) {
    const existing = await prisma.brandEntity.findFirst({
      where: { topicId: topic.id, canonicalName: ent.canonicalName },
    });
    if (existing) {
      await prisma.brandEntity.update({
        where: { id: existing.id },
        data: { ...ent },
      });
      updated++;
    } else {
      await prisma.brandEntity.create({
        data: { topicId: topic.id, ...ent },
      });
      inserted++;
    }
  }
  console.log(`Done. Inserted: ${inserted}  Updated: ${updated}  Total: ${figureEntities.length}`);
  console.log(`\nNext: run \`listening.syncQueries\` (UI or tRPC) to generate queries from these entities.`);

  await prisma.$disconnect();
})();
