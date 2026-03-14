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

// ═══════════════════════════════════════════════════════════════
// FIGURE ECOSYSTEM — COMPREHENSIVE BRAND & PRODUCT TERMS
// ═══════════════════════════════════════════════════════════════
// Research: Mar 2026 — Figure Technology Solutions (Nasdaq: FIGR)
//
// CORPORATE:
//   Figure Technology Solutions, Figure Technologies, Nasdaq: FIGR, $FIGR
//   CEO: Mike Cagney (@mcagney), CEO: Michael Tannenbaum
//   Official X: @Figure, @FigureMarkets, @provenancefdn, @HastraFi
//
// LENDING & MARKETPLACE:
//   Figure HELOC ($FIGR_HELOC), Figure Lending, Figure Connect (marketplace),
//   DSCR loans, crypto-backed loans, cash-out refinance
//
// CAPITAL MARKETS:
//   Figure ATS (Alternative Trading System), Figure Securities,
//   OPEN (On-chain Public Equity Network), Blockchain Stock,
//   FGRD (blockchain-native common stock ticker)
//
// STABLECOIN & DEFI:
//   $YLDS (SEC-registered yield-bearing stablecoin), Figure Certificate Company,
//   Democratized Prime (RWA lend-borrow marketplace), Intellidebt,
//   Hastra / HastraFi (liquidity protocol on Solana), PRIME token
//
// BLOCKCHAIN:
//   Provenance Blockchain (L1, Cosmos SDK), $HASH token,
//   DART (Digital Asset Registry Technology), ProvWasm
//
// PARTNERSHIPS:
//   Agora Data (auto loans), Ondo ($25M YLDS investment),
//   Chainlink (oracle for Hastra), Kamino (PRIME vaults on Solana)
// ═══════════════════════════════════════════════════════════════

const figureTopics = [
  {
    name: 'Figure Brand & Products',
    description:
      'Track all mentions of the Figure ecosystem: Figure Technology Solutions (FIGR), Figure Markets, Figure Lending/HELOC, Provenance Blockchain, $YLDS, Hastra/PRIME, OPEN, and Democratized Prime. Research-backed queries with zero common-word noise.',
    pollingTier: 'HOT',
    queries: [
      // ═══ X QUERIES — every term is unambiguous or context-qualified ═══

      // Q1: Ticker + corporate identity — zero ambiguity
      {
        platform: 'X',
        queryString: '($FIGR OR "Figure Technology Solutions" OR "Nasdaq: FIGR" OR "FIGR stock" OR "$FIGR_HELOC" OR "FigureHeloc") lang:en',
        negativeKeywords: [],
        rationale: 'Tickers $FIGR and $FIGR_HELOC, plus full corporate name. These terms ONLY refer to Figure.',
      },

      // Q2: Official accounts — all posts from Figure ecosystem accounts
      {
        platform: 'X',
        queryString: '(from:Figure OR from:FigureMarkets OR from:HastraFi) lang:en',
        negativeKeywords: [],
        rationale: 'All posts from official @Figure, @FigureMarkets, and @HastraFi accounts. Pure signal.',
      },

      // Q3: Figure Markets + $YLDS + Figure ATS
      {
        platform: 'X',
        queryString: '("Figure Markets" OR "$YLDS" OR "YLDS stablecoin" OR "Figure ATS" OR "Figure Securities" OR "FGRD") lang:en',
        negativeKeywords: [],
        rationale: 'Figure Markets ATS, $YLDS stablecoin, Figure Securities subsidiary, and FGRD blockchain stock ticker. All unique.',
      },

      // Q4: Figure HELOC + Figure Lending (largest revenue product)
      {
        platform: 'X',
        queryString: '("Figure HELOC" OR "Figure home equity" OR "Figure Lending") lang:en',
        negativeKeywords: ['figure out', 'figure skating', 'action figure'],
        rationale: 'HELOC product ($2.7B quarterly volume). "Figure HELOC" and "Figure Lending" are unambiguous.',
      },

      // Q5: Figure Connect marketplace — needs qualifier
      {
        platform: 'X',
        queryString: '("Figure Connect") ("loan" OR "marketplace" OR "HELOC" OR "lending" OR "origination" OR "blockchain" OR "RWA" OR "auto" OR "DSCR") lang:en',
        negativeKeywords: ['figure out', 'figure skating', 'action figure', 'figurine'],
        rationale: 'Figure Connect marketplace. Requires lending/RWA qualifier to avoid "figure" + "connect" noise.',
      },

      // Q6: OPEN (On-chain Public Equity Network) + Blockchain Stock
      {
        platform: 'X',
        queryString: '("OPEN" OR "On-chain Public Equity" OR "Blockchain Stock") ("Figure" OR "FIGR" OR "Provenance" OR "blockchain-native equity" OR "tokenized equity") lang:en',
        negativeKeywords: [],
        rationale: 'OPEN network for blockchain-native equities. "OPEN" alone is too generic, so requires Figure/Provenance context.',
      },

      // Q7: Provenance Blockchain — full brand name + official account only
      {
        platform: 'X',
        queryString: '("Provenance Blockchain" OR from:provenancefdn OR "provenance.io") -giveaway -airdrop lang:en',
        negativeKeywords: ['giveaway', 'airdrop', 'scam'],
        rationale: 'Provenance L1 — full brand name and @provenancefdn only. NOT "provenance chain" (generic supply-chain/art term).',
      },

      // Q8: $HASH token — MUST pair with Provenance/Figure context
      {
        platform: 'X',
        queryString: '$HASH ("Provenance" OR "Figure" OR "RWA" OR "validator" OR "staking" OR "delegator" OR "ProvWasm") -giveaway -airdrop lang:en',
        negativeKeywords: ['giveaway', 'airdrop', 'scam', 'hashtag', 'hash rate', 'hashrate', 'hash function', 'hash brown'],
        rationale: '$HASH token qualified with Provenance/Figure context. Without qualifier, $HASH matches computing/crypto-mining chatter.',
      },

      // Q9: Hastra + PRIME token (Solana DeFi layer)
      {
        platform: 'X',
        queryString: '("HastraFi" OR "Hastra" OR "$PRIME") ("Figure" OR "Provenance" OR "Democratized Prime" OR "Solana" OR "RWA" OR "Kamino" OR "Chainlink") lang:en',
        negativeKeywords: ['amazon prime', 'prime video', 'prime minister', 'optimus prime'],
        rationale: 'Hastra liquidity protocol and PRIME token on Solana. Qualified to avoid Amazon Prime and other noise.',
      },

      // Q10: Democratized Prime + Intellidebt — unique product names
      {
        platform: 'X',
        queryString: '("Democratized Prime" OR "Intellidebt" OR "DART" "Digital Asset Registry") lang:en',
        negativeKeywords: [],
        rationale: 'Unique product names: Democratized Prime (RWA pool), Intellidebt (debt consolidation), DART (registry tech).',
      },

      // Q11: Mike Cagney — CEO posts about Figure ecosystem
      {
        platform: 'X',
        queryString: 'from:mcagney ("Figure" OR "FIGR" OR "Provenance" OR "HELOC" OR "YLDS" OR "Hastra" OR "PRIME" OR "OPEN" OR "blockchain") lang:en',
        negativeKeywords: [],
        rationale: 'CEO Mike Cagney posts frequently about Figure. Qualified with ecosystem terms.',
      },

      // Q12: Partnership mentions — Agora Data, Ondo x Figure
      {
        platform: 'X',
        queryString: '("Agora Data" OR "AgoraCapital") ("Figure" OR "Provenance" OR "tokenized" OR "auto loan") lang:en',
        negativeKeywords: [],
        rationale: 'Agora Data partnership (auto loan tokenization on Provenance). Qualified to ensure Figure context.',
      },

      // ═══ REDDIT QUERIES — via SociaVault ═══

      // R1: Core brand + ticker
      {
        platform: 'REDDIT',
        queryString: '"Figure Technology" OR "Figure Markets" OR "$FIGR" OR "FIGR stock"',
        subreddits: ['defi', 'cryptocurrency', 'SecurityToken', 'ethfinance', 'wallstreetbets', 'stocks', 'investing'],
        rationale: 'Core brand on Reddit. All terms are unambiguous.',
      },

      // R2: HELOC + lending products
      {
        platform: 'REDDIT',
        queryString: '"Figure HELOC" OR "Figure Lending" OR "Figure home equity"',
        subreddits: ['RealEstate', 'personalfinance', 'HomeOwners', 'FirstTimeHomeBuyer', 'loanoriginators'],
        rationale: 'Lending products on consumer finance subreddits.',
      },

      // R3: Provenance + HASH + DeFi products
      {
        platform: 'REDDIT',
        queryString: '"Provenance Blockchain" OR "$YLDS" OR "Democratized Prime" OR "HastraFi" OR "$HASH Provenance"',
        subreddits: ['defi', 'cryptocurrency', 'cosmosnetwork', 'solana', 'ethfinance'],
        rationale: 'Blockchain infrastructure + DeFi products across crypto subreddits.',
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// KOL ECOSYSTEM MONITORING
// ═══════════════════════════════════════════════════════════════
// Lightweight queries to detect when our KOLs mention ANYTHING
// in the Figure/Provenance ecosystem. Uses from: operator for
// each KOL + ecosystem keyword filter.
//
// All 24 KOLs across 3 cohorts, split into batches to stay
// within X API query length limits.
// ═══════════════════════════════════════════════════════════════

const FIGURE_ECOSYSTEM_TERMS = [
  'Figure', 'FIGR', 'Provenance', 'HASH', 'YLDS', 'Hastra', 'PRIME',
  'HELOC', 'Figure Markets', 'Figure Lending', 'Figure Connect',
  'Democratized Prime', 'Intellidebt', 'OPEN', 'FGRD', 'DART',
  'Figure ATS', 'Figure Securities', 'mcagney', 'Agora Data',
  'blockchain stock', 'RWA Consortium',
].map((t) => `"${t}"`).join(' OR ');

// KOL usernames grouped into query batches (max ~12 per batch for query length)
const kolBatches = [
  // Batch 1: FIGR Analysts (first 8)
  {
    label: 'FIGR Analysts A',
    usernames: [
      'covered_call', 'Kross_Roads', 'Nick_Researcher', 'tridentxhodler',
      'drcreeptic', 'aayushtrades', 'Mbarry581', 'matthew_sigel',
    ],
  },
  // Batch 2: FIGR Analysts (remaining 7)
  {
    label: 'FIGR Analysts B',
    usernames: [
      'dutta_manish', 'rexsalisbury', 'Mega_Fund', 'Crenmy1',
      'Manisha_kh', 'CosmonautStakes', 'bielzinn',
    ],
  },
  // Batch 3: KOLs + Adhoc KOLs
  {
    label: 'KOLs & Adhoc',
    usernames: [
      'rektonomist_', 'Tanaka_L2', 'ZeusRWA', 'sol_nxxn',
      'AltcoinDaily', '3orovik', 'RWAwatchlist_', 'cryptorover', 'phtevenstrong',
    ],
  },
];

const kolTopics = [
  {
    name: 'KOL: Figure Ecosystem Mentions',
    description:
      'Detect when any tracked KOL (FIGR Analysts, KOLs, Adhoc KOLs) mentions Figure, Provenance, or any affiliated product/ticker. Lightweight monitoring across all 24 KOLs.',
    pollingTier: 'HOT',
    queries: kolBatches.map((batch) => {
      const fromClauses = batch.usernames.map((u) => `from:${u}`).join(' OR ');
      return {
        platform: 'X',
        queryString: `(${fromClauses}) (${FIGURE_ECOSYSTEM_TERMS}) lang:en`,
        negativeKeywords: ['figure out', 'figure skating', 'action figure'],
        rationale: `KOL batch "${batch.label}" — ecosystem mentions from ${batch.usernames.length} accounts`,
      };
    }),
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

  // ── 4. Rebuild KOL ecosystem monitoring topics ─────────────
  console.log('\n═══ KOL ECOSYSTEM MONITORING ═══');

  for (const topic of kolTopics) {
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
  const allTopicSets = [...figureTopics, ...kolTopics];
  const totalQueries = competitors.reduce(
    (sum, c) => sum + c.xQueries.length + c.redditQueries.length,
    0,
  ) + allTopicSets.reduce((sum, t) => sum + t.queries.length, 0);

  console.log(`\n═══ DONE ═══`);
  console.log(`  ${competitors.length} competitors`);
  console.log(`  ${competitors.length + allTopicSets.length} listening topics`);
  console.log(`  ${totalQueries} total queries`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
