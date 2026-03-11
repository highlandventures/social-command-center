/**
 * Seed script: Competitors + Social Listening Queries (Research-Backed)
 * Run with: node prisma/seed-competitors.js
 *
 * IDEMPOTENT — deletes and re-creates listening topics for competitors
 * and Figure on each run, so queries stay in sync with this file.
 * Competitors themselves are upserted (not deleted).
 *
 * Sources researched Mar 2026:
 *   Securitize — BUIDL, ACRED, DS Protocol, DS Token
 *   Ondo Finance — OUSG, USDY, ONDO, Ondo Global Markets, SWEEP
 *   Centrifuge — CFG, Tinlake, Centrifuge Prime, JTRSY, SPXA
 *   Superstate — USTB, USCC, Opening Bell
 *   Tokeny — T-REX, ERC-3643
 *   Goldfinch — GFI, Goldfinch Prime
 *   Tradable — tradable.xyz, @tradable_xyz (NOT @tradable)
 *   Figure — FIGR, Figure Markets, Figure Lending, Figure Pay,
 *            Figure Connect, Provenance Blockchain, $YLDS,
 *            Democratized Prime, Intellidebt
 *
 * Requires POSTGRES_PRISMA_URL to be set in environment.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════
// COMPETITOR DEFINITIONS
// ═══════════════════════════════════════════════════════════════

const competitors = [
  {
    name: 'Securitize',
    accounts: [{ platform: 'X', username: 'Securitize' }],
    keywords: [
      'Securitize', 'BUIDL', 'ACRED', 'DS Protocol', 'DS Token',
      'Securitize Markets', 'Securitize Capital',
    ],
    // Dedicated X queries — multiple focused queries beat one giant one
    xQueries: [
      {
        queryString: '("Securitize" OR from:Securitize) -giveaway -airdrop -scam lang:en',
        negativeKeywords: ['giveaway', 'airdrop', 'scam', 'fake'],
        rationale: 'Core brand mentions and own-account posts',
      },
      {
        queryString: '("BUIDL" OR "ACRED") ("tokenized" OR "BlackRock" OR "Securitize" OR "RWA") -giveaway',
        negativeKeywords: ['giveaway', 'airdrop'],
        rationale: 'Product-specific: BlackRock BUIDL fund and ACRED token mentions in RWA context',
      },
      {
        queryString: '("DS Protocol" OR "DS Token") ("Securitize" OR "tokenized" OR "security token")',
        negativeKeywords: [],
        rationale: 'Infrastructure layer: DS Protocol smart contract mentions',
      },
    ],
    redditQueries: [
      {
        queryString: '"Securitize" OR "BUIDL" OR "ACRED"',
        subreddits: ['SecurityToken', 'defi', 'cryptocurrency', 'ethfinance'],
      },
    ],
  },
  {
    name: 'Ondo Finance',
    accounts: [{ platform: 'X', username: 'OndoFinance' }],
    keywords: [
      'Ondo Finance', 'ONDO', 'OUSG', 'USDY',
      'Ondo Global Markets', 'OGM', 'SWEEP',
    ],
    xQueries: [
      {
        queryString: '("Ondo Finance" OR "OndoFinance" OR from:OndoFinance) -giveaway -airdrop -scam lang:en',
        negativeKeywords: ['giveaway', 'airdrop', 'scam'],
        rationale: 'Core brand mentions',
      },
      {
        queryString: '($ONDO OR "OUSG" OR "USDY") ("tokenized" OR "treasury" OR "yield" OR "RWA" OR "Ondo") -giveaway -airdrop',
        negativeKeywords: ['giveaway', 'airdrop', 'scam'],
        rationale: 'Token and product mentions — OUSG (treasuries), USDY (yield token), $ONDO governance',
      },
      {
        queryString: '("Ondo Global Markets" OR "OGM" OR "SWEEP") ("tokenized" OR "stocks" OR "ETF" OR "fund")',
        negativeKeywords: [],
        rationale: 'New products: Global Markets (tokenized equities) and SWEEP fund',
      },
    ],
    redditQueries: [
      {
        queryString: '"Ondo Finance" OR "OUSG" OR "USDY" OR "$ONDO"',
        subreddits: ['defi', 'cryptocurrency', 'ethfinance', 'SecurityToken'],
      },
    ],
  },
  {
    name: 'Centrifuge',
    accounts: [{ platform: 'X', username: 'centrifuge' }],
    keywords: [
      'Centrifuge', 'CFG', 'Tinlake', 'Centrifuge Prime',
      'JTRSY', 'SPXA', 'JAAA',
    ],
    xQueries: [
      {
        queryString: '("Centrifuge" OR from:centrifuge) ("RWA" OR "tokenized" OR "DeFi" OR "lending" OR "protocol") -giveaway -airdrop lang:en',
        negativeKeywords: ['giveaway', 'airdrop', 'scam', 'centrifuge pump', 'centrifuge machine'],
        rationale: 'Brand mentions — qualified with finance context to avoid industrial centrifuge noise',
      },
      {
        queryString: '($CFG OR "Tinlake" OR "Centrifuge Prime" OR "JTRSY" OR "SPXA" OR "JAAA") ("tokenized" OR "RWA" OR "Centrifuge")',
        negativeKeywords: ['giveaway', 'airdrop'],
        rationale: 'Token ($CFG) and product mentions — Tinlake, Prime, JTRSY (treasuries), SPXA (S&P 500)',
      },
    ],
    redditQueries: [
      {
        queryString: '"Centrifuge" AND ("RWA" OR "tokenized" OR "DeFi")',
        subreddits: ['defi', 'cryptocurrency', 'ethfinance', 'Polkadot'],
      },
    ],
  },
  {
    name: 'Superstate',
    accounts: [{ platform: 'X', username: 'SuperstateInc' }],
    keywords: [
      'Superstate', 'USTB', 'USCC', 'Opening Bell',
      'Superstate Fund',
    ],
    xQueries: [
      {
        queryString: '("Superstate" OR from:SuperstateInc) ("tokenized" OR "treasury" OR "fund" OR "crypto" OR "onchain") -giveaway -airdrop lang:en',
        negativeKeywords: ['giveaway', 'airdrop', 'scam', 'super state'],
        rationale: 'Brand mentions — qualified with finance terms to avoid "super state" false positives',
      },
      {
        queryString: '("USTB" OR "USCC") ("Superstate" OR "tokenized" OR "treasury" OR "crypto basis")',
        negativeKeywords: [],
        rationale: 'Product-specific: USTB (tokenized treasuries) and USCC (crypto basis fund)',
      },
      {
        queryString: '("Opening Bell" OR "Superstate") ("onchain equities" OR "tokenized shares" OR "tokenized equity" OR "tokenized stock")',
        negativeKeywords: [],
        rationale: 'Opening Bell platform — regulated onchain equities',
      },
    ],
    redditQueries: [
      {
        queryString: '"Superstate" OR "USTB" OR "USCC"',
        subreddits: ['defi', 'cryptocurrency', 'ethfinance', 'SecurityToken'],
      },
    ],
  },
  {
    name: 'Tokeny Solutions',
    accounts: [{ platform: 'X', username: 'TokenySolutions' }],
    keywords: [
      'Tokeny', 'T-REX', 'ERC-3643', 'ERC3643',
      'Tokeny Solutions', 'T-REX Protocol',
    ],
    xQueries: [
      {
        queryString: '("Tokeny" OR "TokenySolutions" OR from:TokenySolutions) -giveaway -airdrop lang:en',
        negativeKeywords: ['giveaway', 'airdrop', 'scam'],
        rationale: 'Core brand mentions',
      },
      {
        queryString: '("T-REX" OR "ERC-3643" OR "ERC3643") ("tokenized" OR "security token" OR "compliance" OR "Tokeny")',
        negativeKeywords: [],
        rationale: 'Protocol mentions — T-REX and the ERC-3643 standard they authored, qualified to avoid dinosaur noise',
      },
    ],
    redditQueries: [
      {
        queryString: '"Tokeny" OR ("T-REX" AND "token") OR "ERC-3643"',
        subreddits: ['SecurityToken', 'defi', 'ethereum', 'cryptocurrency'],
      },
    ],
  },
  {
    name: 'Goldfinch',
    accounts: [{ platform: 'X', username: 'goldfinch_fi' }],
    keywords: [
      'Goldfinch', 'GFI', 'Goldfinch Prime',
      'Goldfinch Finance', 'Goldfinch Protocol',
    ],
    xQueries: [
      {
        queryString: '("Goldfinch" OR from:goldfinch_fi) ("DeFi" OR "RWA" OR "lending" OR "credit" OR "protocol" OR "crypto") -giveaway -airdrop lang:en',
        negativeKeywords: ['giveaway', 'airdrop', 'scam', 'bird', 'birding', 'ornithology'],
        rationale: 'Brand mentions — qualified with finance context to filter out the actual bird',
      },
      {
        queryString: '($GFI OR "Goldfinch Prime") ("private credit" OR "Apollo" OR "Ares" OR "lending" OR "RWA" OR "DeFi")',
        negativeKeywords: ['bird', 'birding'],
        rationale: 'Token ($GFI) and Goldfinch Prime product (private credit access with Apollo/Ares)',
      },
    ],
    redditQueries: [
      {
        queryString: '"Goldfinch" AND ("DeFi" OR "crypto" OR "RWA" OR "lending")',
        subreddits: ['defi', 'cryptocurrency', 'ethfinance'],
      },
    ],
  },
  {
    name: 'Tradable',
    accounts: [{ platform: 'X', username: 'tradable_xyz' }],
    keywords: [
      'Tradable', 'tradable.xyz', 'Tradable tokenization',
    ],
    xQueries: [
      {
        queryString: '("tradable.xyz" OR from:tradable_xyz OR "Tradable" "tokenized") -giveaway -airdrop lang:en',
        negativeKeywords: ['giveaway', 'airdrop', 'scam', 'forex', 'CFD', 'broker'],
        rationale: 'Brand mentions — tradable.xyz (RWA platform on ZKsync). Excludes forex/CFD @tradable noise.',
      },
      {
        queryString: '("Tradable" OR "tradable_xyz") ("ZKsync" OR "ParaFi" OR "tokenized" OR "alternative assets" OR "RWA")',
        negativeKeywords: ['forex', 'CFD', 'broker', 'metatrader'],
        rationale: 'Product context: ZKsync-based tokenization, ParaFi Capital backing',
      },
    ],
    redditQueries: [
      {
        queryString: '"tradable.xyz" OR ("Tradable" AND "tokenized" AND "ZKsync")',
        subreddits: ['defi', 'cryptocurrency', 'zksync'],
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// FIGURE BRAND LISTENING QUERIES
// ═══════════════════════════════════════════════════════════════

const figureTopics = [
  {
    name: 'Figure Brand & Products',
    description:
      'Track mentions of Figure Technology Solutions (Nasdaq: FIGR), Figure Markets, Figure Lending, Figure Pay, Figure Connect, Provenance Blockchain, and key products ($YLDS, Democratized Prime, Intellidebt).',
    pollingTier: 'HOT',
    queries: [
      // ── X queries ──
      {
        platform: 'X',
        queryString: '("Figure Technology" OR "Figure Tech" OR $FIGR OR from:Figure__Tech) -"figure skating" -"figure out" -"action figure" -figurine lang:en',
        negativeKeywords: ['skating', 'action figure', 'figure out', 'figure it out', 'figurehead', 'figurine', 'figuratively'],
        rationale: 'Core corporate brand + ticker mentions on X',
      },
      {
        platform: 'X',
        queryString: '("Figure Markets" OR from:FigureMarkets OR $YLDS) -"figure skating" -"figure out" lang:en',
        negativeKeywords: ['skating', 'figure out', 'figurine'],
        rationale: 'Figure Markets platform and $YLDS yield-bearing stablecoin',
      },
      {
        platform: 'X',
        queryString: '("Figure Lending" OR "Figure HELOC" OR "Figure home equity" OR "Figure Connect" OR "Intellidebt") -"figure out" lang:en',
        negativeKeywords: ['figure out', 'figurine'],
        rationale: 'Lending products: HELOC, Figure Connect marketplace, Intellidebt debt consolidation',
      },
      {
        platform: 'X',
        queryString: '("Provenance Blockchain" OR "Provenance chain" OR "HASH token" OR "provenan.ce") -giveaway -airdrop lang:en',
        negativeKeywords: ['giveaway', 'airdrop', 'scam'],
        rationale: 'Provenance Blockchain — the L1 powering Figure. Includes $HASH native token.',
      },
      {
        platform: 'X',
        queryString: '("Democratized Prime" OR "Figure Pay" OR "Figure Equity Solutions") -"figure out" lang:en',
        negativeKeywords: ['figure out'],
        rationale: 'Newer products: Democratized Prime (RWA lending pool), Figure Pay, Figure Equity Solutions',
      },
      // ── Reddit queries ──
      {
        platform: 'REDDIT',
        queryString: '"Figure Markets" OR "Figure Technology" OR "FIGR" OR "Figure Lending"',
        subreddits: ['defi', 'cryptocurrency', 'RealEstate', 'personalfinance', 'SecurityToken'],
        rationale: 'Core brand on Reddit — covers both crypto and lending communities',
      },
      {
        platform: 'REDDIT',
        queryString: '"Provenance Blockchain" OR "Figure HELOC" OR "$YLDS" OR "Figure Connect"',
        subreddits: ['cryptocurrency', 'blockchain', 'fintech', 'HomeOwners'],
        rationale: 'Infrastructure + consumer products on Reddit',
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// MAIN SEED LOGIC
// ═══════════════════════════════════════════════════════════════

async function main() {
  let admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) admin = await prisma.user.findFirst();
  if (!admin) {
    console.error('No users found. Sign in first.');
    process.exit(1);
  }
  console.log(`Using admin: ${admin.email} (${admin.id})\n`);

  // ── 1. Upsert competitors ──────────────────────────────────
  console.log('═══ COMPETITORS ═══');
  let compCreated = 0;
  let compUpdated = 0;

  for (const comp of competitors) {
    let existing = await prisma.competitor.findFirst({
      where: { name: comp.name },
      include: { accounts: true, keywords: true },
    });

    if (existing) {
      // Update accounts if the username changed (e.g., tradable → tradable_xyz)
      for (const acct of comp.accounts) {
        const existingAcct = existing.accounts.find((a) => a.platform === acct.platform);
        if (existingAcct && existingAcct.username !== acct.username) {
          await prisma.competitorAccount.update({
            where: { id: existingAcct.id },
            data: { username: acct.username },
          });
          console.log(`  Updated ${comp.name} account: @${existingAcct.username} → @${acct.username}`);
        }
      }

      // Sync keywords — delete old, create new
      const existingKws = existing.keywords.map((k) => k.keyword);
      const newKws = comp.keywords;
      if (JSON.stringify(existingKws.sort()) !== JSON.stringify(newKws.sort())) {
        await prisma.competitorKeyword.deleteMany({ where: { competitorId: existing.id } });
        await prisma.competitorKeyword.createMany({
          data: newKws.map((k) => ({ competitorId: existing.id, keyword: k })),
        });
        console.log(`  Updated ${comp.name} keywords: [${newKws.join(', ')}]`);
      }
      compUpdated++;
    } else {
      await prisma.competitor.create({
        data: {
          name: comp.name,
          createdById: admin.id,
          accounts: {
            create: comp.accounts.map((a) => ({ platform: a.platform, username: a.username })),
          },
          keywords: {
            create: comp.keywords.map((k) => ({ keyword: k })),
          },
        },
      });
      console.log(`  Created: ${comp.name} (@${comp.accounts[0]?.username})`);
      compCreated++;
    }
  }
  console.log(`Competitors — Created: ${compCreated}, Updated: ${compUpdated}\n`);

  // ── 2. Rebuild competitor listening topics ──────────────────
  // Delete old topics (cascade deletes queries + hits) and recreate
  // to ensure queries stay in sync with this file.
  console.log('═══ COMPETITOR LISTENING TOPICS ═══');
  let topicCreated = 0;

  for (const comp of competitors) {
    const topicName = `Competitor: ${comp.name}`;

    // Delete existing topic — must clear hits first (no cascade on topicId FK)
    const existing = await prisma.listeningTopic.findFirst({ where: { name: topicName } });
    if (existing) {
      await prisma.listeningHit.deleteMany({ where: { topicId: existing.id } });
      await prisma.listeningQuery.deleteMany({ where: { topicId: existing.id } });
      await prisma.listeningTopic.delete({ where: { id: existing.id } });
      console.log(`  Deleted old topic: ${topicName}`);
    }

    // Build queries from the structured definitions
    const allQueries = [
      ...comp.xQueries.map((q) => ({
        platform: 'X',
        queryString: q.queryString,
        negativeKeywords: q.negativeKeywords || [],
        subreddits: [],
      })),
      ...comp.redditQueries.map((q) => ({
        platform: 'REDDIT',
        queryString: q.queryString,
        negativeKeywords: [],
        subreddits: q.subreddits || [],
      })),
    ];

    await prisma.listeningTopic.create({
      data: {
        name: topicName,
        description: `Track social activity, mentions, and product conversations for ${comp.name} across X and Reddit.`,
        createdById: admin.id,
        active: true,
        pollingTier: 'WARM',
        queries: { create: allQueries },
      },
    });

    console.log(`  Created: ${topicName} (${allQueries.length} queries)`);
    topicCreated++;
  }
  console.log(`Topics created: ${topicCreated}\n`);

  // ── 3. Rebuild Figure listening topics ──────────────────────
  console.log('═══ FIGURE LISTENING TOPICS ═══');

  for (const topic of figureTopics) {
    const existing = await prisma.listeningTopic.findFirst({ where: { name: topic.name } });
    if (existing) {
      await prisma.listeningHit.deleteMany({ where: { topicId: existing.id } });
      await prisma.listeningQuery.deleteMany({ where: { topicId: existing.id } });
      await prisma.listeningTopic.delete({ where: { id: existing.id } });
      console.log(`  Deleted old topic: ${topic.name}`);
    }

    await prisma.listeningTopic.create({
      data: {
        name: topic.name,
        description: topic.description,
        createdById: admin.id,
        active: true,
        pollingTier: topic.pollingTier,
        queries: {
          create: topic.queries.map((q) => ({
            platform: q.platform,
            queryString: q.queryString,
            negativeKeywords: q.negativeKeywords || [],
            subreddits: q.subreddits || [],
          })),
        },
      },
    });

    console.log(`  Created: ${topic.name} (${topic.queries.length} queries)`);
  }

  // ── Summary ──────────────────────────────────────────────────
  const totalQueries = competitors.reduce(
    (sum, c) => sum + c.xQueries.length + c.redditQueries.length,
    0,
  ) + figureTopics.reduce((sum, t) => sum + t.queries.length, 0);

  console.log(`\n═══ DONE ═══`);
  console.log(`  ${competitors.length} competitors`);
  console.log(`  ${competitors.length + figureTopics.length} listening topics`);
  console.log(`  ${totalQueries} total queries`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
