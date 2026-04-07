# YLDS DeFi Protocol / L1 / Stellar Ecosystem Research Brief
## Persona: DeFi Protocol / L1 / Stellar Ecosystem Decision-Makers

**Product Context**: YLDS is a yield-bearing SEC-registered stablecoin (~4% yield, SOFR-35bps) issued by Figure Technology Solutions (FIGR, Nasdaq). Mainnet launch on Stellar ~April 19, 2026. wYLDS (wrapped, permissionless via Hastra) launching May 2026.

**Persona Tier**: 2

**GTM Path**: Foundation level → Wallet providers → Fintechs

---

## 1. DECISION-MAKERS: WHO DECIDES ON ASSET INTEGRATIONS?

### Core Team / Governance Structure
- **Governance Tokens Control Asset Decisions**: AAVE token holders vote on protocol upgrades, risk parameters, and new market listings (Aave V4). COMP token holders propose and vote on changes including interest rates and asset listings (Compound III). MORPHO token holders govern protocol upgrades and parameters (Morpho Blue, launched 2024).
- **DAO/Community Voting**: DAOs are the most common governance structure for DeFi projects, distributing power among community members via governance tokens to vote on management and decision-making.

### Specific Decision Routes
- **Aave**: Token holders vote on Risk Framework proposals; Risk Committee (e.g., ARFC—Aave Request for Comments) reviews collateral parameters; community delegates intensify voting weight.
- **Morpho**: Anyone can create a market; professional curators assemble markets into managed Vaults; governance votes on protocol-level upgrades, but asset listing is permissionless.
- **Pendle**: PENDLE token powers governance and incentives; moving toward staking-and-participation model with protocol fee buybacks and distributions to active stakers.
- **Compound**: Delegation system allows token holders to delegate voting power; governance voting required for major upgrades and new collateral additions.

### Institutional & Foundation Involvement
- **Chain Foundations** (Stellar Development Foundation): Control ecosystem grants, incentive programs ($100M+ Soroban Adoption Fund for Stellar), and strategic partnerships.
- **BD Leads**: Each major protocol has dedicated business development teams who evaluate new assets and negotiate integration terms before governance votes.
- **Risk Committees**: Operational, not just governance—they perform due diligence on new assets, assess smart contract security, and set risk parameters before proposals reach token holders.

### Timeline & Approval Process
- **Multi-stage voting**: Governance proposals typically include a temperature check (informal poll), detailed proposal submission, discussion period (3-7 days), then voting period (3-5 days).
- **Timelocks**: After vote passes, a delay (24–48 hours) before smart contract execution allows community time to review and react.

**Key Decision-Makers**: Protocol governance token holders, Risk Committees, Chain Foundation leadership, BD/BD operations teams.

---

## 2. CURRENT STATE: WHAT YIELD-BEARING ASSETS ARE PROTOCOLS INTEGRATING?

### Yield-Bearing Stablecoin Market Overview
- **Market Size**: $22.7 billion as of March 2026 (up from $1.5B–$11B in late 2025).
- **Growth Rate**: Grew 15x faster than overall stablecoin market in 6 months leading to March 2026.
- **Supply Doubling**: Yield-bearing stablecoin supply has doubled over the past year, becoming core collateral in DeFi.

### Dominant Yield-Bearing Assets in DeFi (2026)

#### sDAI (Sky, formerly MakerDAO)
- **Model**: ERC-4626 tokenized vault wrapping DAI in DSR (Dai Savings Rate).
- **Yield**: ~6% APY (as of early 2026).
- **Integration**: Aave (as collateral), Spark Protocol, Curve Finance (liquidity), most major DEXs.
- **TVL/Adoption**: Widely supported across DeFi; composable yield infrastructure.

#### USDY (Ondo Finance)
- **Model**: RWA-backed; tokenized short-term U.S. Treasury exposure.
- **Yield**: ~4.25% APY (as of March 2026).
- **Growth**: +91% market cap growth (6 months to March 2026).
- **Adoption**: Institutional treasuries use for on-chain US government debt exposure.

#### USDe (Ethena)
- **Model**: Delta-neutral synthetic dollar (ETH/stETH/BTC deposit + derivatives short position).
- **Yield**: Algorithmic yield via staking ETH + perpetual futures spread capture.
- **Adoption**: Aave, Pendle, Morpho, BingX, Deribit; now a core DeFi collateral.
- **TVL**: One of fastest-growing yield-bearing assets.

#### BUIDL (BlackRock)
- **Model**: RWA-backed (tokenized money market fund exposure).
- **Yield**: Variable (passes through Treasury/money market yields).
- **Yield Distribution**: Monthly airdrop of additional tokens (accrued interest).
- **Adoption**: Preferred by institutional allocators; integrating across major DeFi.

#### sfrxETH / stETH
- **sfrxETH (Frax)**: Wrapped frxETH staking; yield-bearing liquid staking token.
- **stETH (Lido)**: Liquid staking derivative; embedded yield via validator rewards.
- **Adoption**: Both are core DeFi collateral; stETH has billions TVL across protocols.

### Stellar DeFi Ecosystem State (2026)
- **TVL**: $143 million as of February 2026 (up 284% from $44.9M end of 2024 to $172.5M late 2025).
- **Key Protocol**: Blend (lending) dominates—grew 7.8x YoY from $10.2M to $79.9M; now $1.8B+.
- **Active Projects**: 800 active projects shipped in 2025 across payments, savings, lending, liquidity.
- **Developer Growth**: Full-time developers on Stellar grew 31% YTD; ecosystem base grew 3x faster than industry average.
- **Infrastructure**: Robust wallet network (Lobstr, Solar, Ultra Stellar, Lightyear), DEX (StellarX), cross-border payment anchors (475k+ access points).

### Network Performance
- **Accounts**: 10M+ active accounts; 21.5B+ total operations to date.
- **Operations**: 1B+ operations in Q3 2025 (+70% QoQ); 99.99% uptime.
- **Transaction Fees**: $0.00055 per operation (near-zero).
- **Settlement**: 5.76 second average ledger close; 9.5 second settlement average.

---

## 3. PAIN POINTS (VERIFIED)

### Regulatory & Compliance Risk
- **SEC Registration Friction**: Projects issuing yield-bearing tokens expected to provide registration and disclosures similar to securities issuers. "Sufficient decentralization" threshold is steep—most yield tokens don't qualify.
  - *Source*: SEC expects yield-bearing tokens to meet securities registration requirements (2025 guidance).

- **KYC/Identity Friction for DeFi Users**: Protocols integrating SEC-registered assets face requirement for Know-Your-Customer (KYC) controls. On-chain permissionless users resist identity disclosure.
  - *Quote*: "Major trading platforms demand verified token classifications, operational KYC/AML systems, and documented regulatory adherence before approval."
  - Privacy-preserving solutions (zk-credentials) emerging but not yet standard.

- **Governance Liability**: If a protocol's foundation or core team controls upgrades/governance, they become "regulated entities," creating developer liability and enforcement risk.
  - Real case: Binance paid $4.3B (DOJ, FinCEN, OFAC) in 2023 for AML/KYC failures.

### UST/Luna Collapse: Enduring Lessons
- **On-Chain Governance Failure**: Over 70% of UST circulation was parked in Anchor Protocol; governance failed to build reserves or deploy rapid crisis response.
- **Yield Unsustainability**: Anchor offered 19.5% yield, initially subsidized—unsustainable as deposits grew exponentially.
- **Loss of Confidence**: Retail and institutional investors now approach DeFi with "far greater caution" and "psychological scars."
- **Protocol Risk Appetite**: Protocols now demand higher scrutiny on collateral stability, reserve backing, and governance-controlled subsidies.
  - *Implication*: Yield-bearing assets must prove sustainable, reserve-backed yield model—not governance-subsidized.

### Smart Contract Integration Complexity
- **Rebase Mechanics**: Rebase tokens (e.g., stETH, some LSTs) create complications—fixed-balance systems (lending markets, AMM pools, bridges) don't correctly track balance changes.
  - Solution: Wrapped versions required (e.g., wstETH), adding friction.

- **ERC-4626 Standardization**: Now standard (vault interface), but older DeFi systems require custom integration code.
- **Non-EVM Chains**: Stellar, Solana don't use EVM; require language-specific implementations (Rust for Soroban, etc.).

### Protocol Governance Timelines
- **Voting Delays**: Typical governance process takes 10–15 days (temperature check, discussion, voting, timelock).
- **Proposal Variability**: Different protocols have different quorum, proposal thresholds, delegation weights; no standard.
- **Whale Control Risk**: Governance is token-weighted; large token holders can block or force integration decisions.

### Asset Risk & Collateral Parameters
- **Off-Chain Dependencies**: USDY depends on actual US Treasury holdings; if backing is questioned, liquidity can evaporate (regulatory or custody risk).
- **Counterparty Risk**: Yield-bearing assets tied to specific issuer (Ondo, Ethena, BlackRock); issuer default is protocol risk.
- **Composability Risk**: Yield-bearing stablecoins used as collateral create tight coupling; if sDAI depeg occurs, cascading liquidations across Aave, Morpho, Spark.

---

## 4. BUYING TRIGGERS: WHAT MAKES PROTOCOLS INTEGRATE NOW?

### Regulatory Clarity & Institutional Capital
- **Regulatory Tailwind**: SEC's "innovation exemption" (time-bound waiver of certain regulatory obligations) signals that institutions can partner with compliant DeFi projects without enforcement risk.
  - *Driver*: 2025 saw major policy moves; 2026 expected to bring further clarity.

### TVL Competition & User Demand
- **Capital Flight**: Protocols compete for TVL via new collateral options; yield-bearing assets attract TVL-conscious users and DAOs seeking yield-on-reserves strategies.
- **DAO Treasury Yield**: 100+ DAOs now actively manage treasuries for yield (vs. holding idle stables); yield-bearing assets are primary tool.
  - *Trigger*: "Institutions, pension funds, endowments, corporate treasuries require legal clarity before committing capital."

### Chain Foundation Grants & Incentives
- **Stellar Adoption Fund**: $100M+ allocated to Soroban DeFi/RWA projects.
- **Ecosystem Momentum**: Stellar's $6M+ commitment to YLDS launch signals protocol-level support; traction breeds FOMO.
- **Developer Growth**: 31% YoY developer growth on Stellar signals credible ecosystem (not just hype).

### RWA Market Tailwinds
- **Tokenized Treasury Adoption**: $12.88B in tokenized US Treasury value as of April 2026 (+266% growth YoY).
- **Institutional Mainstream Adoption**: BlackRock, Franklin Templeton, Goldman Sachs entering tokenization; legitimacy spillover to other RWAs.
- **Corporate Payroll/Settlement**: USST stablecoin launching Q1 2026 on Stellar signals B2B use case expansion.

### User Demand for Yield Composability
- **Yield Primitives**: Users and protocols want "money lego" composability—stack sDAI in Morpho vault for layered yield.
- **Capital Efficiency**: ERC-4626 standardization means new yield asset integrations require minimal custom code.
- **Pendle & Rate Markets**: Pendle's YT (yield token) + Principal Token model normalized yield tokenization; protocols no longer see yield-bearing assets as exotic.

---

## 5. OBJECTIONS: TOP 5 REASONS PROTOCOLS SAY NO

### 1. Chain Support / Deployment Cost
- **Multi-Chain Complexity**: Protocol must deploy across 5–10+ chains; each chain requires custom contract testing, audits, liquidity provisioning.
- **Stellar Skepticism**: "Stellar TVL is only $143M; not worth engineering effort." (Rebuttal: Foundation grants cover deployment; TVL growing 284% YoY.)

### 2. Smart Contract Integration & Testing Risk
- **Non-EVM Friction**: Stellar/Soroban uses Rust, not Solidity; requires specialist engineers; existing audit infrastructure less mature.
- **Rebase/Balance Tracking**: If asset uses rebase mechanics, integration is non-trivial; many protocols avoid rebase assets entirely.
- **Security Audits**: Independent audits of new collateral add $50K–$200K+ cost and 4–8 week timeline.

### 3. Preference for Native / Protocol-Issued Yield
- **Morpho Blue Philosophy**: "Anyone can create a market; we don't need permissioned collateral lists." Protocols prefer owned yield (protocol-native staking, trading fees) over external yield-bearing assets.
- **Governance Overhead**: Adding external asset = governance vote + risk parameter management; internal yield = engineering-only.

### 4. Governance Approval Timelines & Whale Veto Risk
- **Voting Delays**: 10–15 days minimum; no guarantee of passage.
- **Whale Opposition**: If major token holder opposes, integration can be blocked despite strong community support.
- **Uncertainty**: Protocol teams dislike binary "yes/no" votes; prefer trial periods or gradual rollout.

### 5. SEC Registration = KYC Friction for DeFi Users
- **Identity & Privacy Conflict**: DeFi ethos = permissionless; SEC-registered assets require KYC for institutional buyers but friction for retail permissionless users.
- **Denylist/Compliance Controls**: Regulated assets often require on-chain denylist or blacklist controls; DeFi users perceive as censorship risk.
  - *Quote*: "Denylists are controversial in crypto culture, but operationally common in regulated payment contexts."
- **Institutional Adoption = Retail Friction**: Assets attractive to institutions (USDY, BUIDL) repel DeFi-native users who prioritize permissionlessness.

**Secondary Objections**:
- "Yield is too low (4%) vs. unregistered alternatives (8–10%)."
- "Users don't understand SEC registration; they'll assume it's more centralized / less trustworthy."
- "Collateral discount risk: if SEC enforcement action occurs, protocol collateral is seized."

---

## 6. COMPETITIVE ALTERNATIVES: HOW PROTOCOLS CHOOSE

### Competitive Yield-Bearing Stablecoin Landscape

| Asset | Yield | Model | TVL / Adoption | Key Moat |
|-------|-------|-------|---------|-----------|
| **sDAI** | ~6% | DSR wrapper (MakerDAO) | Largest DeFi integration (Aave, Spark, Curve) | Composable ERC-4626; Sky governance trustworthiness |
| **USDY** | ~4.25% | RWA/Treasury-backed (Ondo) | $5.8B+ tokenized treasuries; institutional demand | Custody clarity; Treasury backing; institutional brand |
| **USDe** | Variable | Delta-neutral synthetic (Ethena) | $3B+; core across Aave, Morpho, Pendle | Innovative delta-neutral design; fast yield accrual |
| **BUIDL** | Variable | RWA/Money market (BlackRock) | Explosive institutional adoption; $10B+ projected | BlackRock brand; simplicity; mainstream legitimacy |
| **stETH** | ~3–4% | Liquid staking (Lido) | $20B+; foundational LST | Largest liquid staking; network effect; cross-chain |
| **sfrxETH** | ~4–5% | Frax staking derivative | $2B+; emerging core collateral | Frax governance alignment |
| **wYLDS (YLDS Wrapped)** | ~4% | RWA-backed, SEC-registered (Figure) | Not yet live (launch May 2026) | Permissionless, regulated, Stellar ecosystem positioning |

### Protocol Preference Drivers
1. **sDAI**: DeFi-native protocols (Morpho, Pendle, Curve) prefer sDAI for composability and pure on-chain yield.
2. **USDY / BUIDL**: Institutional treasuries (DAOs, corporate CFOs) prefer Treasury-backed assets for safety and regulatory clarity.
3. **USDe**: Protocols seeking yield without governance subsidy risk; Ethena's delta-neutral model appeals to risk-averse protocols.
4. **stETH/sfrxETH**: Cross-chain protocols default to LSTs due to massive liquidity and network effects.
5. **wYLDS**:
   - **Advantage**: SEC registration removes regulatory uncertainty; permissionless via Hastra; ~4% yield competitive with USDY; Stellar ecosystem plays leverage.
   - **Weakness**: Smaller TVL/adoption initially; non-EVM deployment (Stellar) adds friction; users may not trust new Figure stablecoin initially (vs. established USDY/sDAI).

### How wYLDS Differentiates
- **Regulatory Clarity**: SEC-registered = institutional confidence in compliance.
- **Permissionless Wrapping**: Hastra enables DeFi-native access without gatekeeping.
- **Stellar-Native**: Tighter integration with Stellar ecosystem (wallets, anchors, fintechs) = first-mover advantage on Stellar.
- **Yield Sustainability**: SOFR-35bps is market-rate, reserve-backed (not governance-subsidized); survives regulatory/market stress.

---

## 7. STELLAR ECOSYSTEM DEEP-DIVE

### Major Wallet Providers
- **LOBSTR** (operated by Ultra Stellar)
  - Largest Stellar wallet with millions of users
  - Web, iOS, Android apps
  - Features: LOBSTR Vault (multisig security), zero fees, QR-code payment pre-fill
  - Integration: Anchor/trustline support, token swaps, asset management

- **Solar Wallet**
  - Non-custodial, open-source
  - Full user control over keys and transaction history
  - Seamless trustline and multi-sig support
  - Focus: Security and user sovereignty

- **StellarX** (operated by Ultra Stellar)
  - Leading Stellar DEX
  - Native on-chain trading; trustless asset swaps
  - Deep secondary liquidity for anchor assets (e.g., permitted payments)

- **Lightyear**
  - Emerging wallet provider (limited 2026 data found)
  - Non-custodial focus

- **Binance / Coinbase / Kraken**
  - Custodial XLM wallets; billions in aggregate user base
  - Gateway to institutional capital

### Recent Developments (April 2026)
- **Wirex + Ultra Stellar**: Launched native Stellar payment infrastructure on Soroban (smart contracts)
  - Direct DeFi payment rails for millions of users

### Fintechs Building on Stellar
**Cross-Border & Remittance**:
- Stellar designed for remittance use cases: <5 second settlement, <$0.001 transaction cost, 475k+ on/off-ramp access points
- Ecosystem includes regulated anchor partners for fiat corridors (AUD, ZAR, PHP, BRL, etc.)

**Payments & Settlement**:
- USST stablecoin (launched Q1 2026) for on-chain settlement; PayPal USD (PYUSD) live on Stellar Q3 2026
- U.S. Bank, PwC testing custom stablecoin issuance on Stellar
- Enterprise use: payroll, B2B payments, government treasury settlement

**Fintech GTM Targets** (from Stellar Foundation ecosystem):
- Airtm (emerging market remittance)
- Meru (retail fintech)
- Wirex (payment cards + Stellar rails)
- Payment Service Providers (PSPs) integrating Stellar anchors

### Stellar DeFi & Smart Contract Ecosystem

**Soroban Smart Contract Platform**:
- Launched mainnet May 2024
- Rust-based smart contracts (not EVM)
- $100M+ Soroban Adoption Fund for ecosystem development
- Protocol 25 X-Ray (recent upgrade) improving composability

**Major DeFi Protocols on Stellar**:

1. **Blend** (Script3)
   - Lending protocol (modular liquidity pools)
   - TVL: $79.9M (7.8x growth YoY); now $1.8B+ (as of 2026)
   - Integration: LOBSTR, Meru, Airtm, StellarX
   - Use case: Uncollateralized lending for Stellar ecosystem

2. **StellarX**
   - DEX protocol
   - Real-world asset (RWA) trading pairs
   - Deep secondary liquidity for permitted payment assets

3. **Emerging Soroban Apps** (as of 2026):
   - DeFindex: Yield indexing
   - Beans: Governance aggregator
   - Pendle integration: Yield tokenization on Stellar
   - Kamino: Omni-chain liquidity vaults (cross-chain to Soroban)

### Stellar Foundation & Grants
- **Ecosystem Size**: 800 active projects shipped in 2025
- **Developer Support**: 31% YoY developer growth; 3x faster than industry average
- **Grants & Incentives**: $100M+ Soroban fund; Foundation-backed partnerships (YLDS $6M+ commitment; PYUSD integration)
- **Annual Events**: Meridian (Q3 2026)—catalyst for major announcements, partnerships, ecosystem initiatives

### Anchor System & YLDS Integration
**Anchor Basics**:
- Bridges between fiat and Stellar network
- Issue digital representations of real-world assets (RWAs, fiat currencies, commodities)
- 475k+ global on/off-ramp access points
- SEP-24 & SEP-6 standards for wallet integration

**YLDS Integration Path**:
1. YLDS issues on Stellar mainnet via smart contract (Soroban)
2. YLDS wrapped as wYLDS via Hastra (permissionless wrapping) for DeFi composability
3. Anchors integrate YLDS for fiat on/off-ramps (e.g., convert USD → YLDS → remit)
4. Wallets display YLDS and enable staking/yield accrual
5. DeFi protocols (Blend, StellarX, future protocols) use wYLDS as collateral or liquidity

---

## 8. NAMED TARGETS: 15–20 SPECIFIC PROTOCOLS, FOUNDATIONS, & ECOSYSTEM COMPANIES

### Tier 1: Major General DeFi Protocols (Aave V4, Morpho, Pendle, Compound)

1. **Aave** (12+ chains, $10B+ TVL)
   - Decision Path: AIP (Aave Improvement Proposal) → Risk Committee review → token holder vote
   - Current Yield Assets: sDAI, USDY, USDe, stETH
   - Stellar Interest: Possible multi-chain expansion; high regulatory credibility

2. **Morpho Blue** ($3B+ TVL, permissionless)
   - Decision Path: Permissionless; anyone can create market; curators assemble Vaults
   - Current Yield Assets: sDAI, USDY, USDe, stETH, sfrxETH
   - Stellar Interest: Scaling via Soroban; early-stage institutional adoption

3. **Pendle Finance** ($3.5B TVL, 11 chains)
   - Decision Path: PENDLE token governance; strong focus on RWA yield tokenization
   - Current Yield Assets: All major yield-bearing stablecoins + LSTs + RWAs
   - Stellar Interest: Already planning Stellar integration (sPENDLE staking model launch Jan 2026)
   - **Direct Pipeline**: Confirmed Pendle-YLDS collaboration potential

4. **Compound** ($2B+ TVL, cToken model)
   - Decision Path: COMP governance; conservative on new collateral (Compound III requires individual markets)
   - Current Yield Assets: sDAI, USDY, stETH, native COMP staking
   - Stellar Interest: Lower priority (multi-chain strategy is Ethereum-first)

### Tier 2: Stellar-Native & Soroban DeFi Protocols

5. **Blend** ($1.8B TVL, Stellar-native lending)
   - Decision Path: Script3 foundation + community governance (TBD 2026)
   - Current Yield Assets: Native XLM, USST, anchor-issued stablecoins
   - Stellar Interest: **Primary GTM target**; native to Stellar
   - Status: Integrated with LOBSTR, Meru, Airtm

6. **StellarX** (Stellar-native DEX)
   - Decision Path: Ultra Stellar management + governance TBD
   - Current Yield Assets: Anchor assets, trading volume incentives
   - Stellar Interest: **Primary GTM target**; native to Stellar

7. **Kamino Finance** ($2.36B TVL, Solana-native; Soroban expansion TBD)
   - Decision Path: KMNO governance + institutional partnerships
   - Relevance: Omni-chain vault operator; likely candidate for Stellar expansion
   - Status: Feb 2026—partnered with Anchorage Digital + Solana Company for institutional borrowing

### Tier 3: RWA-Focused & Institutional DeFi

8. **Spark Protocol** (Sky governance, RWA-focused lending)
   - Current Yield Assets: sDAI, USDY
   - Interest: Strong RWA focus aligns with YLDS positioning

9. **Morpho Ecosystem Vaults** (Curated institutional vaults)
   - Decision Path: Vault creators (risk managers) integrate new assets
   - Status: Fast-moving; expects RWA integration; YLDS potential vault target

10. **Yearn Finance** ($1B+ TVL, yield strategy aggregator)
    - Decision Path: YFI governance + strategist-led vault creation
    - Current Yield Assets: sDAI, USDY, USDe, stETH
    - Interest: YLDS as core component of multi-asset yield strategy

### Tier 4: Stellar Ecosystem Fintechs & Payment Infrastructure

11. **Airtm** (Emerging market fintech, Stellar-based)
    - Use Case: Remittance + cross-border payments
    - Integration: Blend + LOBSTR; likely early YLDS adopter

12. **Meru** (Retail fintech, Stellar-integrated)
    - Use Case: Emerging market wallet + payments
    - Integration: Blend; ecosystem partner

13. **Wirex** (Payment cards + Stellar)
    - New April 2026: Native Stellar payment infrastructure on Soroban
    - Use Case: Cards linked to Stellar stablecoins (USST, PYUSD, YLDS)
    - **Direct Pipeline**: Likely YLDS integration for payroll/remittance

14. **Ultra Stellar** (Operating LOBSTR, StellarX)
    - Decision Path: Platform governance
    - Role: Primary Stellar wallet/DEX operator; critical for user adoption

### Tier 5: Chain Foundations & Ecosystem

15. **Stellar Development Foundation**
    - Decision Path: Foundation board + ecosystem committee
    - Role: $6M+ YLDS commitment signals support; grants, partnerships, ecosystem strategy
    - **Key Contact**: Foundation leadership for partnership framework, Meridian Q3 2026

16. **Hastra** (Multi-chain stablecoin wrapper protocol)
    - Decision Path: Internal protocol governance
    - Role: Enables permissionless wYLDS wrapping; critical for DeFi composability
    - **Direct Pipeline**: Core YLDS GTM infrastructure

### Tier 6: Exchange & Liquidity Providers (Secondary)

17. **Bitmart** (Crypto exchange listing)
    - Role: Liquidity + retail price discovery for YLDS
    - Decision Path: Exchange listing committee (internal)

18. **Codex** (Stellar-ecosystem trading)
    - Role: Emerging decentralized trading venue

19. **Agora** (Already live)
    - Role: Existing YLDS integration; baseline adoption

### Tier 7: Custody & Institutional Infrastructure

20. **Anchorage Digital** (Institutional custody)
    - Relevance: Partnered with Kamino + Solana; custody backstop for institutional allocators
    - Potential: YLDS institutional custody solution

---

## 9. MARKET DATA: TVL, YIELD-BEARING STABLECOINS, STELLAR, RWA TOKENIZATION

### Total DeFi TVL
- **Current (Early 2026)**: $130–$140 billion across all chains
- **Comparison**: Post-FTX low was ~$50B; peak bull-market was $170B+
- **Growth Driver**: Institutional capital inflow + RWA integration + yield-bearing stablecoin adoption

### Yield-Bearing Stablecoin Market
- **Total Market Cap**: $22.7 billion (March 2026)
- **YoY Growth**: +15x faster than overall stablecoin market
- **Annual Supply Growth**: Doubled over past 12 months
- **Institutional Treasury Allocation**: $20B+ (up from $9.5B) in institutional treasury strategies
- **Average Yield**: ~5% across major assets

**Breakdown by Asset**:
- sDAI: Largest DeFi integration (billions in TVL across Aave, Spark, Curve, Morpho)
- USDY: $5.8B tokenized Treasury exposure; institutional preference
- USDe: $3B+; institutional derivative exposure
- BUIDL: $10B+ projected (explosive institutional adoption; BlackRock momentum)
- stETH: $20B+ (foundational LST)

### Stellar Network Statistics (2026)
- **Active Accounts**: 10M+
- **Total Operations**: 21.5B+ to date
- **Q3 2025 Operations**: 1B+ (↑70% QoQ)
- **Uptime**: 99.99%
- **Ledger Close Time**: 5.76 seconds average
- **Settlement Time**: 9.5 seconds (last 30 days)
- **Transaction Fee**: $0.00055 per operation (near-zero)
- **DeFi TVL**: $143M (Feb 2026); grew 284% from $44.9M (late 2024) to $172.5M (late 2025)
- **Active Projects**: 800 (as of end 2025)
- **Developer Growth**: ↑31% YTD; ecosystem base ↑3x industry average

### RWA Tokenization Market
- **Current Market Size** (Feb 2026): $24–$30 billion on-chain
- **Growth Rate**: ↑266% YoY (2025)
- **2026 Projections**:
  - Conservative: $100–$150 billion
  - Moderate: $150–$200 billion
  - Aggressive: $250–$300 billion+

**Breakdown**:
- **Tokenized Treasuries**: $12.88 billion (largest category); $5.8B USDY + BUIDL + other Treasury-backed assets
- **Tokenized Equities**: Emerging (BlackRock tokenized equity fund in beta)
- **Corporate Bonds / Credit**: $1–$2 billion
- **Commodities**: Smaller allocation (oil, gold)

**Institutional Adoption**:
- **HNI Intent**: 8.6% of portfolio allocation to tokenized assets
- **Institutional Intent**: 5.6% of portfolio allocation
- **Active RWA Initiatives**: 200+ institutions engaged
- **Major Players**: BlackRock, Franklin Templeton, Goldman Sachs, U.S. Bank, PwC

---

## 10. LANGUAGE / JARGON: HOW PROTOCOL TEAMS & STELLAR BUILDERS SPEAK

### Core DeFi Concepts

**Yield Primitive**
- Definition: Base-layer yield source (DSR, Treasury yield, validator rewards) that can be wrapped, tokenized, and stacked for additional yield.
- Usage: "sDAI is a yield primitive that enables composable yield strategies."
- Implication for YLDS: "Yield-bearing stablecoins are the new yield primitives that protocols build on top of."

**Composability**
- Definition: Ability of protocols and assets to stack permissionlessly ("Money Legos"). ERC-4626 standardization enabled true composability.
- Usage: "USDY lacks composability; sDAI is composable across Aave, Morpho, Pendle."
- Implication for YLDS: wYLDS must be ERC-4626 compliant (or Soroban equivalent) to enable composability.

**Permissionlessness**
- Definition: No gating; anyone can access the protocol or create a market without approval.
- Usage: "Morpho Blue is truly permissionless; anyone can create a lending market."
- Implication for YLDS: wYLDS via Hastra is permissionless wrapping; DeFi protocols prefer this over gated listings.

**Collateral**
- Definition: Asset locked in a lending protocol to borrow against.
- Usage: "sDAI is a core collateral type in Aave V3 and Morpho Blue."
- Implication for YLDS: Protocol integration pitch = "YLDS becomes core collateral for yield strategies."

**TVL (Total Value Locked)**
- Definition: Sum of all assets deposited in a protocol.
- Usage: "Blend's TVL grew 7.8x YoY to $1.8B."
- Implication for YLDS: Lower Stellar TVL ($143M) is barrier but rapidly growing; founders emphasize narrative momentum.

### RWA & Regulated Asset Language

**Real-World Asset (RWA)**
- Definition: On-chain tokenized representation of off-chain asset (Treasury, corporate bond, commodity, equity, real estate).
- Usage: "USDY is an RWA-backed yield-bearing stablecoin."
- Implication for YLDS: Positioned as "regulated RWA stablecoin"; appeals to institutional buyers seeking regulatory clarity.

**Regulated Asset / SEC-Registered**
- Definition: Digital asset subject to securities law (SEC Form S-1, Form 10-K disclosures, etc.).
- Usage: "YLDS is SEC-registered; unlike UST or algorithmic stablecoins, it has regulatory backing."
- Implication for YLDS: **Competitive differentiator vs. sDAI, USDe** (governance-dependent) or UST (failed algorithmic model).

**Anchor** (Stellar-specific)
- Definition: Bridge between fiat and Stellar blockchain; issues digital representations of real-world assets.
- Usage: "Anchors provide on/off-ramps; YLDS will integrate via anchor network for fiat conversion."
- Implication for YLDS: Anchor integration = user on-ramp; critical for remittance/payment use cases.

**Bridge / Wrapped Asset**
- Definition: Permissionless wrapper that converts native asset to another blockchain's version (e.g., YLDS → wYLDS on Hastra).
- Usage: "wYLDS is the wrapped version enabling Stellar stablecoin to compose with EVM DeFi."
- Implication for YLDS: wYLDS via Hastra = gateway to billion-dollar EVM DeFi liquidity.

### Stellar-Specific Jargon

**Soroban**
- Definition: Stellar's smart contract platform (Rust-based, non-EVM).
- Usage: "Soroban enables DeFi composability; smart contract TVL is $143M and growing 284% YoY."
- Implication for YLDS: Must deploy on Soroban; non-EVM integration is competitive moat (early-mover advantage).

**Stellar Ecosystem / Foundation**
- Definition: Stellar Development Foundation + 800 active projects + anchor network + wallet providers.
- Usage: "YLDS is betting on Stellar ecosystem growth; 31% developer growth signals credibility."
- Implication for YLDS: Foundation support ($6M commitment) + ecosystem momentum are powerful GTM accelerators.

**Cross-Border Payment / Remittance**
- Definition: Stellar's core use case; fractionless settlement of payments across countries/currencies via anchor network.
- Usage: "Stellar is optimized for remittances; sub-cent transaction costs enable new use cases."
- Implication for YLDS: YLDS-based remittance products (e.g., fiat → YLDS → foreign fiat, instant settlement) are GTM narrative.

**Trustline** (Stellar-specific)
- Definition: User-side opt-in to hold a specific token; allows issuers to control who holds their asset.
- Usage: "YLDS issuance requires trustline setup; users must explicitly opt-in."
- Implication for YLDS: Affects onboarding friction; wallets must enable one-click trustline creation.

---

## 11. IMPLEMENTATION ROADMAP: GTM SEQUENCE (Karl's Three-Layer Path)

### Layer 1: Foundation Level (Weeks 1–8)
**Objective**: Secure Stellar Foundation backing + ecosystem narrative alignment

**Targets**:
- Stellar Development Foundation (board presentation, Meridian Q3 2026 announcement slot)
- $6M commitment already signaled; formalize partnership framework
- Ecosystem grants committee (ensure Soroban Adoption Fund alignment)

**Key Milestone**: Foundation public endorsement + YLDS feature in 2026 ecosystem roadmap

---

### Layer 2: Wallet Providers (Weeks 8–16)
**Objective**: Enable user on-boarding + trustline setup + staking visibility

**Targets** (in priority order):
1. **LOBSTR** (millions of users; Ultra Stellar operated)
   - Pitch: "Native Stellar yield-bearing stablecoin; trustline toggle + yield display in dashboard"
   - Integration: SEP-24 anchor support + wallet UI for YLDS staking

2. **Solar Wallet** (security-focused user base)
   - Pitch: "Permissionless, non-custodial YLDS holding via wYLDS bridge"

3. **Exchanges** (Binance, Coinbase, Kraken)
   - Pitch: "Retail XLM to YLDS conversion; yield-bearing stablecoin alternative to USDC"

**Key Milestone**: YLDS listed and tradeable in 3+ major Stellar wallets by Week 16

---

### Layer 3: Fintechs & DeFi Protocols (Weeks 16–24)
**Objective**: Enable yield-bearing collateral + payment infrastructure

**Tier 3A: Stellar-Native Fintechs** (Weeks 16–20)
- **Airtm**: YLDS integration for remittance settlement
- **Meru**: YLDS as primary stablecoin for retail wallet
- **Wirex**: YLDS for payment card + payroll settlement

**Tier 3B: DeFi Protocols** (Weeks 20–24)
1. **Blend** (Stellar-native lending)
   - Pitch: "Accept wYLDS as collateral; enable YLDS deposit farming"
   - Commercial: Blend DAO + protocol governance vote

2. **Pendle** (Yield tokenization)
   - Pitch: "YLDS Principal Token + Yield Token; enable yield curve trading on Stellar"
   - Status: Pendle already planning Stellar integration; YLDS = early RWA use case

3. **Morpho Blue** (Permissionless lending)
   - Pitch: "Permissionless YLDS vault creation; community curators manage risk"
   - Entry: Easier than Aave (no governance vote required)

4. **Aave** (Institutional lending)
   - Pitch: "Multi-chain YLDS adoption; institutional RWA collateral"
   - Timeline: Later phase (requires AIP vote + Risk Committee approval)

**Key Milestone**: YLDS collateral live in 2+ major DeFi protocols; $50M+ TVL in YLDS-based strategies

---

## 12. RISK & MITIGATION

### Technical Risk
- **Non-EVM Friction**: Soroban is immature; auditor pool smaller than Ethereum.
  - Mitigation: Partner with Script3 (Blend creators) for deployment; early Soroban Adoption Fund traction.

### Regulatory Risk
- **SEC Enforcement**: Yield-bearing registration requirements may tighten; KYC friction may increase.
  - Mitigation: YLDS regulatory clarity is **advantage**, not weakness; highlight SEC registration vs. UST/Luna.

### Adoption Risk
- **Stellar TVL Low vs. EVM**: $143M TVL is 1/1000 of Aave/Morpho.
  - Mitigation: Stellar TVL growing 284% YoY; ecosystem momentum strong; wYLDS bridges to EVM liquidity.

### Competitive Risk
- **sDAI, USDY, BUIDL Dominance**: Established yield-bearing assets have network effects.
  - Mitigation: YLDS = only regulated asset on Stellar; Stellar-first positioning = first-mover on fastest-growing chain.

---

## 13. SUCCESS METRICS (SAMPLE)

- **Month 1–2**: Foundation partnership formalized; Meridian Q3 2026 speaking slot secured
- **Month 3–4**: YLDS listed in LOBSTR, Solar Wallet; 100k+ users with active trustlines
- **Month 4–6**: Airtm + Wirex integration live; $5M+ YLDS transaction volume
- **Month 6–9**: Blend + Pendle YLDS collateral live; $20M+ YLDS TVL in DeFi
- **Month 9–12**: wYLDS bridge live; Aave/Morpho integration; $50M+ total YLDS TVL (Stellar + EVM)

---

## 14. RESEARCH SOURCES & CITATIONS

### DeFi Protocol & Governance
- [What Are the Top DeFi Protocols? Complete 2026 Guide](https://blog.tokenmetrics.com/p/what-are-the-top-defi-protocols-complete-2026-guide-to-decentralized-finance)
- [DeFi 2.0: The New Frontier of Yield and Governance in 2026](https://www.ainvest.com/news/defi-2-0-frontier-yield-governance-2026-2512/)
- [Decentralized Finance: Protocols, Risks, and Governance](https://arxiv.org/html/2312.01018v1)
- [State of DeFi 2025 – DL News](https://www.dlnews.com/research/internal/state-of-defi-2025/)

### Yield-Bearing Stablecoins
- [Yield-Bearing Stablecoins: How USDY, sDAI and USDe Work](https://coinpaprika.com/education/yield-bearing-stablecoins-how-usdy-sdai-and-usde-work/)
- [Best Yield-Bearing Stablecoins to Hold in 2026: Strategies for 4-8% Returns](https://stablecoininsider.org/yield-bearing-stablecoins-2026/)
- [Top Stablecoin DeFi Platforms 2026: Earn Yield on USDC, USDT, DAI](https://eco.com/support/en/articles/13313563-top-stablecoin-defi-platforms-2026-earn-yield-on-usdc-usdt-dai)

### Stellar Ecosystem
- [Stellar Blockchain Network for DeFi, Payments & Asset Tokenization](https://stellar.org/)
- [Stellar Financial Ecosystem Update | Messari](https://messari.io/report/stellar-financial-ecosystem-update)
- [Stellar 2025: A Podium Finish](https://stellar.org/blog/ecosystem/stellar-2025-year-in-review)
- [Stellar - DeFi TVL, Fees, & Revenue - DefiLlama](https://defillama.com/chain/stellar)
- [Stellar Lumens (XLM): From Remittances to DeFi — Expanding Blockchain Utility in 2025](https://www.thestandard.io/blog/stellar-lumens-xlm-from-remittances-to-defi----expanding-blockchain-utility-in-2025-part-2-8)
- [Stellar Network Metrics | Transactions, TVL, and More - Messari](https://stellar.messari.io/network-metrics)

### UST/Luna Collapse & Lessons
- [Anatomy of a Run: The Terra Luna Crash](https://corpgov.law.harvard.edu/2023/05/22/anatomy-of-a-run-the-terra-luna-crash/)
- [Interconnected DeFi: Ripple Effects from the Terra Collapse](https://www.federalreserve.gov/econres/feds/files/2023044pap.pdf)
- [LUNA and UST Crash Explained in 5 Charts](https://www.coindesk.com/layer2/2022/05/11/the-luna-and-ust-crash-explained-in-5-charts)

### Regulatory & Compliance
- [DeFi Regulatory Compliance 2025: Master SEC & CFTC Rules](https://www.calibraint.com/blog/defi-regulatory-compliance-sec-cftc-2025)
- [DeFi and Wallet Compliance in 2026: KYC and AML](https://www.blockchain-council.org/cryptocurrency/defi-and-wallet-compliance-kyc-aml-travel-rule-self-custody/)
- [SEC Proposal for a Regulatory Framework for Digital Assets](https://www.sec.gov/files/ctf-written-sec-proposal-digital-asset-09-08-2025.pdf)
- [2026 Digital Assets Regulatory Update](https://www.clearygottlieb.com/news-and-insights/publication-listing/2026-digital-assets-regulatory-update-a-landmark-2025-but-more-developments-on-the-horizon)

### Protocol Architecture & Governance
- [Aave vs Compound vs Morpho: Best DeFi Lending Protocol (2026)](https://coinstancy.com/academy/guides/aave-vs-compound-vs-morpho/)
- [Morpho Blue Review: DeFi Crypto Lending & Borrowing Protocol](https://defirate.com/reviews/morpho/)
- [Pendle Finance Review: Is This DeFi Yield Protocol Worth Using In 2026?](https://coinbureau.com/review/pendle-finance-review/)

### Stellar DeFi & Soroban
- [Stellar: Composability on Stellar: How DeFi Protocols Work Together](https://stellar.org/blog/developers/composability-on-stellar-from-concept-to-reality)
- [Stellar: Build DeFi with Soroban: Rust-Based Smart Contracts](https://stellar.org/use-cases/defi)
- [Smart Contracts Platform Soroban Finally Arrives on Stellar Network](https://www.theblock.co/post/283446/smart-contracts-finally-arrive-on-stellar-network-with-soroban-launch-on-mainnet)
- [Stellar (XLM) Review 2026: Payments Network, Soroban, and Protocol 25 X-Ray](https://cryptoadventure.com/stellar-xlm-review-2026-payments-network-soroban-and-protocol-25-x-ray/)

### RWA Tokenization
- [Real World Asset Tokenization News: Trends and Outlook for 2026](https://www.rwamarket.io/real-world-asset-tokenization-news-trends-and-outlook-for-2026/)
- [Asset Tokenization Statistics 2026: Market Shifts Now](https://coinlaw.io/asset-tokenization-statistics/)
- [RWA.io | RWA Tokenization Trends for 2026](https://www.rwa.io/post/rwa-tokenization-trends-for-2026)

### Cross-Border Payments & Stellar Use Cases
- [Stellar: Cross-Border Payments: Revolutionizing Global Payments](https://stellar.org/learn/cross-border-payments)
- [Cross-Border Payments with Stellar Blockchain](https://www.rapidinnovation.io/post/how-can-stellar-blockchain-simplify-cross-border-payments)
- [Stellar: Blockchain Remittances: A Game Changer for Cross-Border Transfers](https://stellar.org/blog/ecosystem/blockchain-remittances-a-game-changer-for-cross-border-transfers)

### DeFi Jargon & Composability
- [What Is Composability in DeFi? How Decentralized Apps Work Together](https://changelly.com/blog/what-is-composability-in-defi/)
- [The Complete Guide to DeFi Vaults in 2026: How Curated Vaults Became the Smartest Way to Earn Yield](https://defiprime.com/defi-vaults-guide)
- [Where Do DeFi Stablecoins Go? A Closer Look at What DeFi Composability Really Means](https://ideas.repec.org/p/pui/dpaper/156.html)

---

**END OF BRIEF**

---

## APPENDIX A: QUICK REFERENCE TABLE — DEFI PROTOCOL DECISION-MAKERS & TIMELINES

| Protocol | Decision-Maker | Timeline | Governance Token | Interest in YLDS |
|----------|---|---|---|---|
| **Aave** | AIP vote (token holders) + Risk Committee | 10–15 days | AAVE | High (multi-chain, RWA focus) |
| **Morpho Blue** | Permissionless (anyone creates market) | 1–7 days | MORPHO | Very High (permissionless model) |
| **Pendle** | PENDLE governance + strategist selection | 7–10 days | PENDLE | Very High (RWA yield tokenization focus) |
| **Compound** | COMP governance | 10–15 days | COMP | Medium (conservative asset listing) |
| **Blend** | Script3 + DAO governance (TBD 2026) | TBD | TBD | Very High (Stellar-native) |
| **StellarX** | Ultra Stellar + governance TBD | TBD | TBD | Very High (Stellar-native DEX) |

---

## APPENDIX B: YLDS POSITIONING SUMMARY FOR GTM

### Unique Value Propositions
1. **SEC-Registered**: Only regulated stablecoin launching on Stellar; institutional confidence; lower regulatory risk vs. UST/Luna alternatives.
2. **Stellar-Native**: First-mover advantage on fastest-growing DeFi ecosystem (284% TVL growth YoY).
3. **Permissionless (wYLDS)**: Hastra bridge enables DeFi composability without gatekeeping.
4. **Sustainable Yield**: SOFR-35bps is market-rate, reserve-backed; survives regulatory/market stress (vs. governance-subsidized alternatives).
5. **Foundation Backed**: $6M+ Stellar Foundation commitment signals credibility + ecosystem alignment.

### Competitive Positioning vs. Alternatives
- **vs. sDAI**: YLDS = regulated + Stellar-native; sDAI = DeFi-native + larger TVL
- **vs. USDY**: YLDS = permissionless (Hastra) + Stellar-native; USDY = larger, institutional-preferred
- **vs. USDe**: YLDS = reserve-backed + registered; USDe = delta-neutral + no governance risk
- **vs. BUIDL**: YLDS = 4% yield + liquidity focus; BUIDL = institutional brand + BlackRock backing

### GTM Phases & Success Metrics
1. **Foundation (Weeks 1–8)**: Stellar Foundation partnership; Meridian slot
2. **Wallets (Weeks 8–16)**: LOBSTR, Solar, exchange listings; 100k+ trustlines
3. **Fintechs (Weeks 16–20)**: Airtm, Meru, Wirex integration; $5M transaction volume
4. **DeFi (Weeks 20–24)**: Blend, Pendle, Morpho integration; $20M+ TVL
5. **Scale (Months 6–12)**: wYLDS bridge live; Aave/Morpho EVM integration; $50M+ total TVL

---

**END OF APPENDIX**
