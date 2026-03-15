/**
 * Seed script: Competitors + Social Listening Queries (Research-Backed)
 * Run with: node prisma/seed-competitors.js
 *
 * IDEMPOTENT — deletes and re-creates listening topics for competitors
 * and Figure on each run, so queries stay in sync with this file.
 * Competitors themselves are upserted (not deleted).
 *
 * Sources researched Mar 2026:
 *   Securitize — BUIDL, ACRED, DS Protocol, DS Token, Securitize Markets/Capital
 *   Ondo Finance — OUSG, USDY, ONDO, Ondo Global Markets, SWEEP, Flux Finance
 *   Centrifuge — CFG, Tinlake, Centrifuge Prime, JTRSY, SPXA
 *   Superstate — USTB, USCC, Opening Bell, Robert Leshner
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
    xQueries: [
      {
        queryString: '("Securitize" OR from:Securitize) -giveaway -airdrop -scam min_faves:2 lang:en',
        negativeKeywords: ['giveaway', 'airdrop', 'scam', 'fake'],
        rationale: 'Core brand mentions and own-account posts. min_faves:2 filters bot noise.',
      },
      {
        queryString: 'from:Securitize lang:en',
        negativeKeywords: [],
        rationale: 'All official @Securitize posts — no engagement gate to catch every announcement.',
      },
      {
        queryString: '("BUIDL" OR "ACRED") ("tokenized" OR "BlackRock" OR "Securitize" OR "RWA" OR "fund") -giveaway min_faves:2 lang:en',
        negativeKeywords: ['giveaway', 'airdrop'],
        rationale: 'Product-specific: BlackRock BUIDL fund and ACRED token mentions in RWA context',
      },
      {
        queryString: '("Securitize Markets" OR "Securitize Capital") lang:en',
        negativeKeywords: ['giveaway', 'airdrop', 'scam'],
        rationale: 'Subsidiary brand mentions — Securitize Markets (broker-dealer) and Securitize Capital (fund manager).',
      },
      {
        queryString: '("Securitize" OR "BUIDL") ("BlackRock" OR "Hamilton Lane" OR "KKR" OR "Ares" OR "Apollo") min_faves:2 lang:en',
        negativeKeywords: ['giveaway', 'airdrop'],
        rationale: 'Partnership mentions — major institutional partners using Securitize infrastructure.',
      },
      {
        queryString: '("DS Protocol" OR "DS Token") ("Securitize" OR "tokenized" OR "security token") min_faves:2 lang:en',
        negativeKeywords: [],
        rationale: 'Infrastructure layer: DS Protocol smart contract mentions',
      },
    ],
    redditQueries: [
      {
        queryString: '"Securitize" OR "Securitize Markets" OR "Securitize Capital"',
        negativeKeywords: ['giveaway', 'airdrop', 'scam', 'fake'],
        subreddits: ['SecurityToken', 'defi', 'cryptocurrency', 'ethfinance', 'CryptoMarkets', 'RWA', 'investing', 'wallstreetbets'],
        rationale: 'Core brand and subsidiary mentions. Negative keywords filter crypto spam.',
      },
      {
        queryString: '"BUIDL" AND ("BlackRock" OR "Securitize" OR "tokenized" OR "RWA" OR "fund")',
        negativeKeywords: ['giveaway', 'airdrop'],
        subreddits: ['SecurityToken', 'defi', 'cryptocurrency', 'ethfinance', 'CryptoMarkets', 'RWA'],
        rationale: 'Product-specific: BlackRock BUIDL fund. "BUIDL" qualified with finance context to avoid dev slang.',
      },
      {
        queryString: '"ACRED" OR "DS Protocol" OR "DS Token"',
        negativeKeywords: ['giveaway', 'airdrop'],
        subreddits: ['SecurityToken', 'defi', 'cryptocurrency', 'ethfinance', 'RWA'],
        rationale: 'ACRED yield token and DS Protocol infrastructure. Unambiguous terms.',
      },
    ],
  },
  {
    name: 'Ondo Finance',
    accounts: [{ platform: 'X', username: 'OndoFinance' }],
    keywords: [
      'Ondo Finance', 'ONDO', 'OUSG', 'USDY',
      'Ondo Global Markets', 'OGM', 'SWEEP', 'Flux Finance', 'fOUSG',
    ],
    xQueries: [
      {
        queryString: '("Ondo Finance" OR "OndoFinance" OR from:OndoFinance) -giveaway -airdrop -scam min_faves:2 lang:en',
        negativeKeywords: ['giveaway', 'airdrop', 'scam'],
        rationale: 'Core brand mentions. min_faves:2 filters bot noise.',
      },
      {
        queryString: 'from:OndoFinance lang:en',
        negativeKeywords: [],
        rationale: 'All official @OndoFinance posts — catch every announcement without engagement gate.',
      },
      {
        queryString: '("OUSG" OR "USDY") ("tokenized" OR "treasury" OR "yield" OR "RWA" OR "Ondo" OR "stablecoin") -giveaway -airdrop min_faves:2 lang:en',
        negativeKeywords: ['giveaway', 'airdrop', 'scam'],
        rationale: 'Product mentions — OUSG (treasuries), USDY (yield token). Qualified to avoid noise.',
      },
      {
        queryString: '$ONDO ("tokenized" OR "treasury" OR "yield" OR "RWA" OR "Ondo" OR "DeFi" OR "governance") -giveaway -airdrop min_faves:3 lang:en',
        negativeKeywords: ['giveaway', 'airdrop', 'scam'],
        rationale: '$ONDO ticker — higher min_faves:3 gate to filter price bot noise. Qualified with context.',
      },
      {
        queryString: '("Ondo Global Markets" OR "OGM" OR "SWEEP") ("tokenized" OR "stocks" OR "ETF" OR "fund" OR "equities") min_faves:2 lang:en',
        negativeKeywords: [],
        rationale: 'New products: Global Markets (tokenized equities) and SWEEP fund',
      },
      {
        queryString: '("Flux Finance" OR "fOUSG") ("Ondo" OR "lending" OR "DeFi" OR "yield" OR "borrow") lang:en',
        negativeKeywords: [],
        rationale: 'Flux Finance lending protocol (Ondo subsidiary) and fOUSG wrapped token.',
      },
      {
        queryString: '("Ondo" OR "OUSG" OR "USDY") ("Solana" OR "Arbitrum" OR "Mantle" OR "Aptos" OR "multichain" OR "cross-chain") min_faves:2 lang:en',
        negativeKeywords: ['giveaway', 'airdrop'],
        rationale: 'Chain expansion tracking — Ondo deploying across multiple L1/L2s.',
      },
    ],
    redditQueries: [
      {
        queryString: '"Ondo Finance" OR "OndoFinance"',
        negativeKeywords: ['giveaway', 'airdrop', 'scam'],
        subreddits: ['defi', 'cryptocurrency', 'ethfinance', 'SecurityToken', 'CryptoMarkets', 'RWA'],
        rationale: 'Core brand mentions.',
      },
      {
        queryString: '"OUSG" OR "USDY" OR "$ONDO"',
        negativeKeywords: ['giveaway', 'airdrop', 'scam'],
        subreddits: ['defi', 'cryptocurrency', 'ethfinance', 'CryptoMarkets', 'RWA'],
        rationale: 'Product tokens. All unique to Ondo — no disambiguation needed.',
      },
      {
        queryString: '"Ondo" AND ("Solana" OR "Arbitrum" OR "Mantle" OR "Aptos")',
        negativeKeywords: ['giveaway', 'airdrop'],
        subreddits: ['defi', 'solana', 'Arbitrum', 'cryptocurrency'],
        rationale: 'Chain expansion tracking — Ondo deploying across multiple L1/L2s.',
      },
      {
        queryString: '"Flux Finance" OR "fOUSG" OR "Ondo Global Markets"',
        negativeKeywords: [],
        subreddits: ['defi', 'cryptocurrency', 'ethfinance'],
        rationale: 'Subsidiary products. Unambiguous terms.',
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
        queryString: '("Centrifuge" OR from:centrifuge) ("RWA" OR "tokenized" OR "DeFi" OR "lending" OR "protocol") -giveaway -airdrop min_faves:2 lang:en',
        negativeKeywords: ['giveaway', 'airdrop', 'scam', 'centrifuge pump', 'centrifuge machine'],
        rationale: 'Brand mentions — qualified with finance context to avoid industrial centrifuge noise',
      },
      {
        queryString: '($CFG OR "Tinlake" OR "Centrifuge Prime" OR "JTRSY" OR "SPXA" OR "JAAA") ("tokenized" OR "RWA" OR "Centrifuge") min_faves:2 lang:en',
        negativeKeywords: ['giveaway', 'airdrop'],
        rationale: 'Token ($CFG) and product mentions — Tinlake, Prime, JTRSY (treasuries), SPXA (S&P 500)',
      },
    ],
    redditQueries: [
      {
        queryString: '"Centrifuge" AND ("RWA" OR "tokenized" OR "DeFi" OR "lending" OR "protocol")',
        negativeKeywords: ['centrifuge machine', 'centrifuge pump', 'laboratory', 'blood'],
        subreddits: ['defi', 'cryptocurrency', 'ethfinance', 'Polkadot', 'CryptoMarkets', 'RWA'],
        rationale: 'Brand mentions qualified with finance context. "Centrifuge" is highly ambiguous on Reddit (science/lab equipment).',
      },
      {
        queryString: '"Tinlake" OR "Centrifuge Prime" OR "$CFG" OR "JTRSY" OR "SPXA"',
        negativeKeywords: ['giveaway', 'airdrop'],
        subreddits: ['defi', 'cryptocurrency', 'ethfinance', 'Polkadot', 'RWA'],
        rationale: 'Product and token mentions. All are unique enough to not need disambiguation.',
      },
    ],
  },
  {
    name: 'Superstate',
    accounts: [{ platform: 'X', username: 'SuperstateInc' }],
    keywords: [
      'Superstate', 'USTB', 'USCC', 'Opening Bell',
      'Superstate Fund', 'Superstate Crypto',
    ],
    xQueries: [
      {
        queryString: '("Superstate" OR from:SuperstateInc) ("tokenized" OR "treasury" OR "fund" OR "crypto" OR "onchain") -giveaway -airdrop min_faves:2 lang:en',
        negativeKeywords: ['giveaway', 'airdrop', 'scam', 'super state'],
        rationale: 'Brand mentions — qualified with finance terms to avoid "super state" false positives',
      },
      {
        queryString: 'from:SuperstateInc lang:en',
        negativeKeywords: [],
        rationale: 'All official @SuperstateInc posts — catch every announcement.',
      },
      {
        queryString: '("USTB") ("tokenized" OR "treasury" OR "Superstate" OR "fund" OR "yield" OR "onchain") min_faves:2 lang:en',
        negativeKeywords: [],
        rationale: 'USTB token — qualified to avoid USB typo noise. Requires treasury/fund context.',
      },
      {
        queryString: '("USCC") ("Superstate" OR "crypto basis" OR "crypto carry" OR "fund" OR "tokenized") min_faves:2 lang:en',
        negativeKeywords: [],
        rationale: 'USCC crypto basis fund — qualified with product context.',
      },
      {
        queryString: '("Opening Bell" OR "Superstate") ("onchain equities" OR "tokenized shares" OR "tokenized equity" OR "tokenized stock" OR "regulated equities") min_faves:2 lang:en',
        negativeKeywords: [],
        rationale: 'Opening Bell platform — regulated onchain equities',
      },
      {
        queryString: 'from:rleshner ("Superstate" OR "USTB" OR "USCC" OR "tokenized" OR "treasury" OR "Opening Bell" OR "onchain") lang:en',
        negativeKeywords: [],
        rationale: 'Robert Leshner (Superstate founder, ex-Compound) posts about Superstate and RWA.',
      },
      {
        queryString: '("Superstate Fund" OR "Superstate Crypto") lang:en',
        negativeKeywords: ['super state', 'superstate of matter'],
        rationale: 'Explicit product name mentions — Superstate Fund and Superstate Crypto.',
      },
    ],
    redditQueries: [
      {
        queryString: '"Superstate" AND ("tokenized" OR "treasury" OR "fund" OR "crypto" OR "onchain" OR "RWA")',
        negativeKeywords: ['super state', 'superstate of matter', 'quantum superstate'],
        subreddits: ['defi', 'cryptocurrency', 'ethfinance', 'SecurityToken', 'CryptoMarkets', 'RWA', 'investing'],
        rationale: 'Brand mentions qualified with finance context. "Superstate" is ambiguous (physics, political theory).',
      },
      {
        queryString: '"USTB" AND ("Superstate" OR "tokenized" OR "treasury" OR "fund")',
        negativeKeywords: [],
        subreddits: ['defi', 'cryptocurrency', 'ethfinance', 'investing'],
        rationale: 'USTB token. Qualified to avoid USB typo noise.',
      },
      {
        queryString: '"USCC" OR ("Opening Bell" AND ("Superstate" OR "tokenized" OR "equities"))',
        negativeKeywords: [],
        subreddits: ['defi', 'cryptocurrency', 'ethfinance', 'investing'],
        rationale: 'USCC crypto carry fund and Opening Bell equities platform.',
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
        queryString: '("Tokeny" OR "TokenySolutions" OR from:TokenySolutions) -giveaway -airdrop min_faves:2 lang:en',
        negativeKeywords: ['giveaway', 'airdrop', 'scam'],
        rationale: 'Core brand mentions. min_faves:2 filters bot noise.',
      },
      {
        queryString: '("T-REX" OR "ERC-3643" OR "ERC3643") ("tokenized" OR "security token" OR "compliance" OR "Tokeny") min_faves:2 lang:en',
        negativeKeywords: [],
        rationale: 'Protocol mentions — T-REX and the ERC-3643 standard they authored, qualified to avoid dinosaur noise',
      },
    ],
    redditQueries: [
      {
        queryString: '"Tokeny" OR "ERC-3643" OR "ERC3643" OR ("T-REX" AND ("token" OR "compliance" OR "security token"))',
        negativeKeywords: ['dinosaur', 'jurassic', 'giveaway'],
        subreddits: ['SecurityToken', 'defi', 'ethereum', 'cryptocurrency', 'RWA'],
        rationale: 'Brand and protocol mentions. T-REX qualified to avoid dinosaur content.',
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
        queryString: '("Goldfinch" OR from:goldfinch_fi) ("DeFi" OR "RWA" OR "lending" OR "credit" OR "protocol" OR "crypto") -giveaway -airdrop min_faves:2 lang:en',
        negativeKeywords: ['giveaway', 'airdrop', 'scam', 'bird', 'birding', 'ornithology'],
        rationale: 'Brand mentions — qualified with finance context to filter out the actual bird',
      },
      {
        queryString: '($GFI OR "Goldfinch Prime") ("private credit" OR "Apollo" OR "Ares" OR "lending" OR "RWA" OR "DeFi") min_faves:2 lang:en',
        negativeKeywords: ['bird', 'birding'],
        rationale: 'Token ($GFI) and Goldfinch Prime product (private credit access with Apollo/Ares)',
      },
    ],
    redditQueries: [
      {
        queryString: '"Goldfinch" AND ("DeFi" OR "crypto" OR "RWA" OR "lending" OR "credit" OR "protocol")',
        negativeKeywords: ['bird', 'birding', 'ornithology', 'backyard', 'feeder'],
        subreddits: ['defi', 'cryptocurrency', 'ethfinance', 'CryptoMarkets', 'RWA'],
        rationale: 'Brand mentions qualified with finance context. "Goldfinch" is a common bird — Reddit has large birding communities.',
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
        queryString: '("tradable.xyz" OR from:tradable_xyz OR "Tradable" "tokenized") -giveaway -airdrop min_faves:2 lang:en',
        negativeKeywords: ['giveaway', 'airdrop', 'scam', 'forex', 'CFD', 'broker'],
        rationale: 'Brand mentions — tradable.xyz (RWA platform on ZKsync). Excludes forex/CFD @tradable noise.',
      },
      {
        queryString: '("Tradable" OR "tradable_xyz") ("ZKsync" OR "ParaFi" OR "tokenized" OR "alternative assets" OR "RWA") min_faves:2 lang:en',
        negativeKeywords: ['forex', 'CFD', 'broker', 'metatrader'],
        rationale: 'Product context: ZKsync-based tokenization, ParaFi Capital backing',
      },
    ],
    redditQueries: [
      {
        queryString: '"tradable.xyz" OR ("Tradable" AND ("ZKsync" OR "tokenized" OR "RWA" OR "ParaFi"))',
        negativeKeywords: ['forex', 'CFD', 'broker', 'metatrader'],
        subreddits: ['defi', 'cryptocurrency', 'zksync', 'RWA'],
        rationale: 'Brand mentions. "Tradable" is generic English — must qualify with product context. Excludes forex/CFD trading platform noise.',
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
//   Figure Pay, DSCR loans, crypto-backed loans, cash-out refinance
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
      'Track all mentions of the Figure ecosystem: Figure Technology Solutions (FIGR), Figure Markets, Figure Lending/HELOC, Figure Pay, Provenance Blockchain, $YLDS, Hastra/PRIME, OPEN, and Democratized Prime. Research-backed queries with zero common-word noise.',
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
        queryString: '(from:Figure OR from:FigureMarkets OR from:HastraFi OR from:provenancefdn) lang:en',
        negativeKeywords: [],
        rationale: 'All posts from official @Figure, @FigureMarkets, @HastraFi, and @provenancefdn accounts. Pure signal.',
      },

      // Q3: Figure Markets + $YLDS + Figure ATS
      {
        platform: 'X',
        queryString: '("Figure Markets" OR "$YLDS" OR "YLDS stablecoin" OR "Figure ATS" OR "Figure Securities" OR "FGRD") lang:en',
        negativeKeywords: [],
        rationale: 'Figure Markets ATS, $YLDS stablecoin, Figure Securities subsidiary, and FGRD blockchain stock ticker. All unique.',
      },

      // Q4: Figure HELOC + Figure Lending (largest revenue product) — expanded consumer terms
      {
        platform: 'X',
        queryString: '("Figure HELOC" OR "Figure home equity" OR "Figure Lending" OR "Figure loan" OR "Figure refinance" OR "Figure rate") lang:en',
        negativeKeywords: ['figure out', 'figure skating', 'action figure'],
        rationale: 'HELOC product + consumer search terms. Consumers search "Figure rate", "Figure loan", "Figure refinance".',
      },

      // Q5: Figure Connect marketplace — broadened qualifiers
      {
        platform: 'X',
        queryString: '("Figure Connect") ("loan" OR "marketplace" OR "HELOC" OR "lending" OR "origination" OR "blockchain" OR "RWA" OR "auto" OR "DSCR" OR "secondary" OR "trading" OR "whole loan") lang:en',
        negativeKeywords: ['figure out', 'figure skating', 'action figure', 'figurine'],
        rationale: 'Figure Connect marketplace. Broadened qualifiers: secondary trading, whole loan marketplace.',
      },

      // Q6: OPEN (On-chain Public Equity Network) + Blockchain Stock
      // NOTE: "OPEN" alone is a common English word — NEVER use it bare.
      // Only match the full phrase or qualified with Figure/FIGR context.
      {
        platform: 'X',
        queryString: '("On-chain Public Equity" OR "Blockchain Stock" OR "blockchain-native equity") ("Figure" OR "FIGR" OR "Provenance" OR "tokenized equity") lang:en',
        negativeKeywords: ['open source', 'open letter', 'ice open network', 'pi network', 'TON'],
        rationale: 'OPEN network for blockchain-native equities. Requires Figure/FIGR/Provenance context. No bare "OPEN" or "OPEN network" — too many false positives.',
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

      // Q9: Hastra + PRIME token (Solana DeFi layer) — broadened qualifiers
      {
        platform: 'X',
        queryString: '("HastraFi" OR "Hastra" OR "$PRIME") ("Figure" OR "Provenance" OR "Democratized Prime" OR "Solana" OR "RWA" OR "Kamino" OR "Chainlink" OR "liquidity protocol" OR "Solana RWA") lang:en',
        negativeKeywords: ['amazon prime', 'prime video', 'prime minister', 'optimus prime'],
        rationale: 'Hastra liquidity protocol and PRIME token on Solana. Added "liquidity protocol" and "Solana RWA" qualifiers.',
      },

      // Q10: Democratized Prime + Intellidebt + DART — fixed syntax
      {
        platform: 'X',
        queryString: '("Democratized Prime" OR "Intellidebt" OR "DART Digital Asset Registry" OR ("DART" ("Figure" OR "Provenance" OR "registry"))) lang:en',
        negativeKeywords: [],
        rationale: 'Unique product names. Fixed DART syntax — now matches full phrase or DART with Figure/Provenance context.',
      },

      // Q11: Mike Cagney — CEO posts + @mentions + name mentions
      {
        platform: 'X',
        queryString: '(from:mcagney OR @mcagney OR "Mike Cagney") ("Figure" OR "FIGR" OR "Provenance" OR "HELOC" OR "YLDS" OR "Hastra" OR "PRIME" OR "OPEN" OR "blockchain" OR "RWA" OR "tokenized") lang:en',
        negativeKeywords: [],
        rationale: 'CEO Mike Cagney — expanded to catch @mentions and name references, not just his own posts.',
      },

      // Q12: Partnership mentions — Agora Data, Ondo x Figure
      {
        platform: 'X',
        queryString: '("Agora Data" OR "AgoraCapital") ("Figure" OR "Provenance" OR "tokenized" OR "auto loan") lang:en',
        negativeKeywords: [],
        rationale: 'Agora Data partnership (auto loan tokenization on Provenance). Qualified to ensure Figure context.',
      },

      // Q13: Figure Pay — crypto-backed payments product
      // NOTE: "figure pay" matches casual English ("figure pay for"). Require additional context.
      {
        platform: 'X',
        queryString: '("Figure Pay") ("crypto" OR "blockchain" OR "payment" OR "app" OR "wallet" OR "send" OR "transfer" OR "HELOC" OR "Figure") -"figure pay for" -"figure pay the" -"figure pay off" lang:en',
        negativeKeywords: ['figure out', 'figure skating', 'figure pay for', 'figure pay the', 'figure pay off', 'figure pay more', 'figure pay less'],
        rationale: 'Figure Pay product. Qualified with fintech context and excludes "figure pay for/the/off" (casual English).',
      },

      // Q14: $FIGR investor sentiment — NEW
      {
        platform: 'X',
        queryString: '$FIGR ("buy" OR "sell" OR "hold" OR "earnings" OR "IPO" OR "valuation" OR "revenue" OR "bullish" OR "bearish" OR "analyst" OR "target price" OR "PT" OR "undervalued" OR "overvalued") lang:en',
        negativeKeywords: [],
        rationale: 'Retail investor sentiment around $FIGR — catches investment discussion, analyst commentary, price targets.',
      },

      // Q15: Regulatory/compliance mentions
      // NOTE: Bare "Figure" + "approved" matches casual English. Use qualified terms.
      {
        platform: 'X',
        queryString: '("Figure Markets" OR "Figure Technology" OR "$FIGR" OR "FIGR" OR "Provenance Blockchain") ("SEC" OR "regulation" OR "compliance" OR "license" OR "enforcement" OR "FINRA" OR "registered") min_faves:2 lang:en',
        negativeKeywords: ['figure out', 'figure skating'],
        rationale: 'Regulatory news. Uses qualified brand names (not bare "Figure") to avoid casual English matches.',
      },

      // Q16: RWA industry context mentioning Figure — NEW
      {
        platform: 'X',
        queryString: '("RWA" OR "real world assets" OR "tokenized assets") ("Figure" OR "FIGR" OR "Provenance" OR "YLDS") min_faves:2 lang:en',
        negativeKeywords: [],
        rationale: 'Industry roundup posts that mention Figure in broader RWA narratives.',
      },

      // Q17: Community engagement directed at Figure — NEW
      {
        platform: 'X',
        queryString: '(to:Figure OR to:FigureMarkets OR @FigureMarkets) -from:Figure -from:FigureMarkets lang:en',
        negativeKeywords: [],
        rationale: 'Inbound replies/mentions TO official accounts — catches community engagement, questions, feedback.',
      },

      // Q18: Figure review/experience — consumer voice
      // NOTE: Bare "Figure" + "experience" matches casual English. Require product-specific terms.
      {
        platform: 'X',
        queryString: '("Figure HELOC" OR "Figure Lending" OR "Figure loan" OR "Figure Markets") ("review" OR "experience" OR "recommend" OR "customer service" OR "applied" OR "approved" OR "denied") lang:en',
        negativeKeywords: ['figure out', 'figure skating', 'action figure', 'figurine'],
        rationale: 'Consumer experience posts. Uses product-specific terms (not bare "Figure") to avoid matching casual English.',
      },

      // ═══ REDDIT QUERIES — via SociaVault ═══

      // R1: Core brand + ticker — expanded subreddits
      {
        platform: 'REDDIT',
        queryString: '"Figure Technology" OR "Figure Markets" OR "$FIGR" OR "FIGR stock"',
        negativeKeywords: ['figure out', 'figure skating', 'action figure', 'figurine'],
        subreddits: ['FigureTech', 'FigureMarkets', 'FIGR', 'defi', 'cryptocurrency', 'SecurityToken', 'ethfinance', 'wallstreetbets', 'stocks', 'investing', 'fintech', 'CryptoMarkets'],
        rationale: 'Core brand on Reddit. Expanded to r/fintech and r/CryptoMarkets.',
      },

      // R2: HELOC + lending products — expanded consumer terms
      {
        platform: 'REDDIT',
        queryString: '"Figure HELOC" OR "Figure Lending" OR "Figure home equity" OR "Figure rate" OR "Figure review" OR "Figure loan"',
        negativeKeywords: ['figure out', 'figure skating', 'action figure'],
        subreddits: ['RealEstate', 'personalfinance', 'HomeOwners', 'FirstTimeHomeBuyer', 'loanoriginators', 'fintech', 'HELOC'],
        rationale: 'Lending products + consumer search terms on finance subreddits.',
      },

      // R3: Provenance + HASH + DeFi products — expanded subreddits
      {
        platform: 'REDDIT',
        queryString: '"Provenance Blockchain" OR "$YLDS" OR "Democratized Prime" OR "HastraFi" OR "$HASH Provenance"',
        negativeKeywords: ['giveaway', 'airdrop', 'hash rate', 'hash function', 'hashtag'],
        subreddits: ['defi', 'cryptocurrency', 'cosmosnetwork', 'solana', 'ethfinance', 'CryptoMarkets'],
        rationale: 'Blockchain infrastructure + DeFi products. Added r/CryptoMarkets.',
      },

      // R4: Figure-owned subreddits — monitor ALL posts (no keyword filter)
      {
        platform: 'REDDIT',
        queryString: '',
        negativeKeywords: [],
        subreddits: ['FigureTech', 'FigureMarkets', 'FIGR'],
        monitorAll: true,
        rationale: 'Figure-owned subreddits. Full monitoring — every post is relevant by definition.',
      },

      // R5: RWA industry discussion mentioning Figure
      {
        platform: 'REDDIT',
        queryString: '"RWA" AND ("Figure" OR "Provenance" OR "FIGR")',
        negativeKeywords: ['figure out', 'figure skating'],
        subreddits: ['defi', 'cryptocurrency', 'ethfinance', 'CryptoMarkets', 'SecurityToken', 'RWA'],
        rationale: 'Industry discussion posts that mention Figure in RWA context.',
      },

      // R6: Figure Pay + regulatory
      {
        platform: 'REDDIT',
        queryString: '"Figure Pay" OR ("Figure" AND ("SEC" OR "regulation" OR "FINRA"))',
        negativeKeywords: ['figure out', 'figure skating'],
        subreddits: ['defi', 'cryptocurrency', 'fintech', 'SecurityToken', 'investing'],
        rationale: 'Figure Pay product + regulatory discussion on Reddit.',
      },

      // R7: Figure Connect marketplace
      {
        platform: 'REDDIT',
        queryString: '"Figure Connect" AND ("loan" OR "marketplace" OR "HELOC" OR "lending" OR "secondary" OR "trading")',
        negativeKeywords: ['figure out', 'figure skating', 'action figure'],
        subreddits: ['defi', 'cryptocurrency', 'fintech', 'loanoriginators', 'SecurityToken'],
        rationale: 'Figure Connect institutional marketplace. Qualified with product context.',
      },

      // R8: $HASH token — must qualify with Provenance/Figure context
      {
        platform: 'REDDIT',
        queryString: '"$HASH" AND ("Provenance" OR "Figure" OR "validator" OR "staking")',
        negativeKeywords: ['hash rate', 'hash function', 'hashtag', 'hash brown'],
        subreddits: ['cryptocurrency', 'cosmosnetwork', 'defi', 'CryptoMarkets'],
        rationale: '$HASH token. Must qualify with Provenance/Figure context — "$HASH" is extremely ambiguous on Reddit.',
      },

      // R9: CEO Mike Cagney mentions
      {
        platform: 'REDDIT',
        queryString: '"Mike Cagney" OR ("mcagney" AND ("Figure" OR "Provenance" OR "blockchain"))',
        negativeKeywords: [],
        subreddits: ['fintech', 'cryptocurrency', 'defi', 'stocks', 'investing'],
        rationale: 'CEO mentions on Reddit. "Mike Cagney" is unique enough; "mcagney" needs Figure context.',
      },

      // R10: $FIGR investor sentiment
      {
        platform: 'REDDIT',
        queryString: '"$FIGR" AND ("buy" OR "sell" OR "hold" OR "earnings" OR "bullish" OR "bearish" OR "valuation")',
        negativeKeywords: [],
        subreddits: ['stocks', 'investing', 'wallstreetbets', 'SecurityToken', 'fintech'],
        rationale: 'Investor sentiment around $FIGR on Reddit finance subs.',
      },

      // R11: Consumer experience/review posts
      {
        platform: 'REDDIT',
        queryString: '"Figure HELOC" AND ("review" OR "experience" OR "recommend" OR "approved" OR "denied" OR "rate")',
        negativeKeywords: ['figure out', 'figure skating'],
        subreddits: ['personalfinance', 'RealEstate', 'HomeOwners', 'FirstTimeHomeBuyer', 'HELOC'],
        rationale: 'Consumer experience/review posts. High-value signal for product feedback.',
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

// KOL ecosystem terms — trimmed to stay within 512 char query limit.
// High-signal terms only; less common products covered by Figure Brand topic.
const FIGURE_ECOSYSTEM_TERMS = [
  'Figure', 'FIGR', 'Provenance', 'HASH', 'YLDS', 'Hastra', 'PRIME',
  'HELOC', 'Figure Markets', 'Figure Lending', 'Figure Connect',
  'Democratized Prime', 'Intellidebt', 'FGRD', 'DART',
  'Figure ATS', 'mcagney', 'Agora Data', 'Figure Pay',
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
      const queryString = `(${fromClauses}) (${FIGURE_ECOSYSTEM_TERMS}) lang:en`;

      // Validate query length (buffer below 512 limit)
      if (queryString.length > 480) {
        console.warn(`\u26a0\ufe0f  KOL batch "${batch.label}" query length: ${queryString.length} chars (approaches 512 limit)`);
      }

      return {
        platform: 'X',
        queryString,
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
        negativeKeywords: q.negativeKeywords || [],
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
      // Clean up related records before deleting topic
      await prisma.subredditMetrics.deleteMany({
        where: { subreddit: { topicId: existing.id } },
      });
      await prisma.monitoredSubreddit.deleteMany({ where: { topicId: existing.id } });
      await prisma.listeningHit.deleteMany({ where: { topicId: existing.id } });
      await prisma.listeningQuery.deleteMany({ where: { topicId: existing.id } });
      await prisma.listeningTopic.delete({ where: { id: existing.id } });
      console.log(`  Deleted old topic: ${topic.name}`);
    }

    const createdTopic = await prisma.listeningTopic.create({
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

    // Create MonitoredSubreddit records for Figure-owned subreddits
    // These drive the poll-subreddit-metrics cron for subscriber/engagement tracking
    if (topic.name === 'Figure Brand & Products') {
      const figureSubreddits = ['FigureTech', 'FigureMarkets', 'FIGR'];
      for (const subName of figureSubreddits) {
        await prisma.monitoredSubreddit.upsert({
          where: {
            topicId_subredditName: { topicId: createdTopic.id, subredditName: subName },
          },
          update: { active: true },
          create: {
            topicId: createdTopic.id,
            subredditName: subName,
            suggestedBy: 'seed',
            active: true,
          },
        });
      }
      console.log(`  Created ${figureSubreddits.length} MonitoredSubreddit records (${figureSubreddits.join(', ')})`);
    }
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
