# YLDS.com Payment/Payroll/Cross-Border Persona Research Brief
## Deep-Dive GTM Research for Tier 2 Stablecoin Integration Playbook

**Research Date:** April 2026
**Focus:** Payment platforms, payroll processors, fintechs, and cross-border settlement companies
**Key Context:** YLDS (~4% yield, SOFR-35bps) on Stellar launch ~April 19; cross-border settlement as primary GTM angle

---

## 1. DECISION-MAKERS: WHO OWNS STABLECOIN INTEGRATION?

### Organizational Structure for Payment/Payroll Integration

| Role | Ownership | Influence Level |
|------|-----------|-----------------|
| **Chief Financial Officer (CFO)** | Treasury operations, yield strategy, reserve management | High (strategic) |
| **Chief Payments Officer (CPO)** / **Head of Payments** | Rails, settlement, product features | High (product) |
| **VP Treasury** | Float management, working capital optimization, yield opportunities | High (financial) |
| **CTO / VP Engineering** | Technical integration, compliance stack, multi-chain support | Medium-High (technical gate) |
| **Chief Compliance Officer (CCO)** | KYC/KYB requirements, regulatory frameworks, AML/sanctions | High (approval gate) |
| **VP Product** | Customer value prop, competitive differentiation, roadmap | Medium (product packaging) |

**Key Insight:** Cross-functional committee approval is standard; CFO/Treasury has final say on yield strategy, while CPO drives product integration timeline.

---

## 2. CURRENT STATE: WHAT PAYROLL/PAYMENT COMPANIES ARE DOING WITH STABLECOINS

### Major Platform Launches (2025–2026)

| Company | Integration Type | Launch Date | Details |
|---------|-----------------|-------------|---------|
| **Toku** | Native stablecoin payroll | Jan 2026 | Runs compliant payroll in 100+ countries; Sei Network integration (Feb 2026); Aleo/Paxos Labs private payroll partnership |
| **Deel** | Third-party (MoonPay) | Feb 10, 2026 | Late mover; integrating stablecoin payout option |
| **Remote** | Via Stripe | Dec 2024 | Early integrator; leveraging Stripe's infrastructure |
| **Papaya Global** | Banco Wallet (Fireblocks) | Feb 6, 2026 | Global workforce wallet; integrated custody |
| **Franklin (Payroll)** | Yield-bearing DeFi | 2025 | Stablecoin conversion beta; integrates Summer.fi for DeFi lending on idle payroll funds |
| **Remitly** | Multi-product rollout | 2025–2026 | Remitly Wallet (fiat + stablecoin); stablecoin payouts via Bridge; treasury tokenization |

**Volume Impact:**
- Over 225 businesses integrated stablecoins for payroll and operational payments in 2025 alone
- B2B stablecoin payment volumes: < $100M/month (early 2023) → $6B/month (mid-2025)

### Current Cross-Border Settlement Landscape

**Traditional Rails (SWIFT/Correspondent Banking):**
- Settlement time: 3–5 business days (emerging markets: 24+ hours)
- Cost structure: 2–7% total (SWIFT fee + correspondent fees + FX spread + beneficiary bank fee)
- Float period: Capital sits idle for days, earning nothing
- Pain point: Opacity — fees are often not disclosed until settlement

**Blockchain-Based Alternatives (Stellar, Polygon, Ethereum, Solana):**
- Settlement time: 2–5 seconds (Stellar: < 0.0007/txn cost)
- Cost structure: 0.1–0.5% on institutional rails; < 0.01 on efficient networks
- Concrete example: $200 USD → Colombia = $0.01 via stablecoin vs. $12.13 via traditional wire

**Adoption Leaders by Corridor:**
- **LatAm:** 71% of institutions using stablecoins for cross-border (highest globally)
- **Africa:** Tempo, Flutterwave (Polygon integration); Mobile Money Operators: 200–300% YoY growth in 2025
- **SEA:** Merchant and remittance corridors; Stellar Anchor Platform: 475,000+ on/off ramp access points
- **US–Emerging Markets:** Remitly, MoneyGram/Fireblocks partnerships accelerating

---

## 3. PAIN POINTS (VERIFIED QUOTES & LANGUAGE)

### Float: The Silent Profit Leak

**The Problem:**
> "Payment float is capital that sits idle between customer deposits and final settlement, earning nothing."

**The Opportunity:**
- For a payment company processing $10M daily: $700K+ untapped annual revenue at current rates
- U.S. businesses process $9T annual payroll; 2–5 day float windows = billions in idle capital
- At any given time, $11.6B of working capital is trapped between major B2B routes
- Average payroll float opportunity: 6–9% yield now achievable via stablecoin lending

**Executive Language:**
- "Settlement time" (vs. speed; key KPI)
- "Yield on float" (growing CFO/Treasury obsession post-GENIUS Act, July 2025)
- "Working capital efficiency" (CFO/Treasurer language)
- "Pre-funding elimination" (Treasury language for capital relief)

### Cross-Border Friction: The 3–5 Day Nightmare

**Quote from Industry:**
Traditional correspondent banking involves each bank in the chain applying fees, with beneficiary banks adding final charges—often opaque and greater than originating bank fees.

**Fintech Executive Language:**
- "Settlement lag" (operational friction)
- "Corridor costs" (specific route economics; LatAm, Africa, SEA named explicitly)
- "Correspondent chain" (the visible pain; each bank is a friction point)
- "FX slippage" (cost of waiting for rates)

**Quantified Pain Points:**
- **Global remittances:** $669B to developing countries annually (2023 baseline)
- **B2B cross-border:** $31.7T market (2024); growing 733% YoY in stablecoin volume (2025)
- **Payroll timing gap:** Employees in emerging markets wait 5–7 days for funds; inability to access earned wages on-demand

### Regulatory Approval as Unlock

**Quote (July 2025 Catalyst):**
The GENIUS Act, signed July 18, 2025, established federal framework for payment stablecoins, removing the compliance objection that had delayed adoption at institutional level.

**Common Objection Eliminated:**
> "We'll adopt stablecoins once there's regulatory clarity"

**Remaining Friction:**
- AML/KYC/KYB compliance across jurisdictions remains operationally complex
- GENIUS Act prohibits stablecoin issuers from offering direct yield → creates partnership opportunity for payment fintechs

---

## 4. BUYING TRIGGERS: WHAT MAKES THEM MOVE NOW?

### 1. **Competitor Adoption (FOMO Signal)**
   - Stripe acquired Bridge ($1.1B, 2025) → signal to Adyen, Checkout.com, Block/Square
   - PayPal PYUSD yield (3.7%, April 2025) → cascading adoption pressure
   - Deel's MoonPay integration (Feb 2026) → late-follower signal
   - **Trigger Language:** "If Stripe has it, we need it or lose merchant clients"

### 2. **Regulatory Clarity (GENIUS Act, July 2025)**
   - Removes 2-year objection: "We're waiting for federal framework"
   - Requires federal licensing + 100% reserve backing + monthly public attestations
   - Removes perceived "crypto risk" for institutional adoption
   - **Trigger Language:** "Regulatory approval = institutional feasibility signal"

### 3. **Stellar Launch / Multi-Chain Stablecoin Support (April 2026)**
   - PayPal adding PYUSD to Stellar (major 2025 development)
   - Visa adding Stellar to settlement platform (2025 signal)
   - **Trigger for YLDS:** Cross-border speed/cost story uniquely strong on Stellar (no other blockchain matches Stellar's fiat access in emerging markets)
   - **Trigger Language:** "If PayPal/Visa trust this rail, institutional clients will too"

### 4. **Customer Demand for Speed & Yield**
   - CFOs realizing idle float = revenue loss
   - Payroll teams wanting instant settlement for global employees
   - B2B finance teams: $2.9B return forecast by 2027 from faster cross-border settlement (per McKinsey-adjacent studies)
   - **Trigger Language:** "Our customers are asking for it; we need to move before competitor does"

### 5. **Yield-on-Float Monetization Opportunity**
   - Post-July 2025 GENIUS Act: stablecoin yield is "legitimate" (no longer gray market)
   - Payment float value: 6–9% APY now achievable, risk-appropriate for payment companies
   - First-mover advantage in payroll vertical: companies that offer yield-bearing USDC/stablecoins gain margin and customer stickiness
   - **Trigger Language:** "We can monetize idle payroll/settlement float and pass yield to customers"

---

## 5. TOP 5 OBJECTIONS & COUNTER-ARGUMENTS

| Objection | Prevalence | Counter | YLDS Positioning |
|-----------|-----------|---------|------------------|
| **"Integration complexity—our stack is legacy"** | High | Pre-built connectors (Bridge via Stripe, Transak, Fireblocks) eliminate complexity; API-first integration < 4 weeks | YLDS on Stellar: Stripe already integrated; leverage existing Stripe relationships |
| **"Regulatory uncertainty in our jurisdiction"** | Medium (declining) | GENIUS Act (July 2025) + EU MiCAR (Jan 2025) removed uncertainty; stablecoins now federally licensed in US | YLDS: Figure is Nasdaq-listed; regulatory pedigree matters |
| **"USDC/USDT liquidity is all we need"** | High | USDC ($73.4B) + USDT ($175B) = 85% market; but yield-bearing alternatives (PYUSD, YLDS) growing 13x ($660M → $9B, Aug 2023–May 2025) | YLDS: 4% yield differentiates vs. USDC (zero yield); stablecoin yield is new category (2025+) |
| **"KYC/KYB friction kills speed advantage"** | Medium | Modern stacks (Fireblocks, Alloy, etc.) integrate KYC/KYB + sanctions screening in < 48 hours; enterprise-grade compliance now table stakes | YLDS: Leverage Figure's compliance infrastructure; pre-integrated KYC likely required |
| **"Customers don't want yield—they want speed"** | Medium | Speed is table stakes now (Stellar, Polygon settle in seconds); yield is *additional* monetization hook for fintechs. Payroll platforms see float yield as customer retention + margin. | YLDS: Sell speed + yield; unique to yield-bearing stablecoins; messaging: "settle instantly + earn on float" |

---

## 6. COMPETITIVE ALTERNATIVES & POSITIONING

### Payment Yield Products Landscape (2025–2026)

| Product | Issuer | Yield | Launch | Positioning |
|---------|--------|-------|--------|-------------|
| **PYUSD** | PayPal | 3.7% | Apr 2025 | Consumer-friendly; ecosystem lock-in; Stella added 2025 |
| **USDC** | Circle | 0% (base) | 2018 | Liquidity leader; institutional trust; no yield |
| **USDT** | Tether | 0% (base) | 2015 | Market leader (60% share); no yield; still strongest daily volume ($144B Q3 2025) |
| **YLDS** | Figure (FIGR, Nasdaq) | ~4% (SOFR-35bps) | Apr 2026 | **Highest yield in category; Stellar native; cross-border optimized** |
| **Aave USDC** | Aave (DeFi) | Up to 6.5% | Ongoing | Higher yield but non-custodial; risk exposure (smart contract); institutions hesitant |
| **Stripe's Bridge** | Stripe (via USDC) | 0% | 2025 | Infrastructure play; developer-friendly; no yield |

### Competitive Positioning for YLDS

**Unique Advantages:**
1. **Highest custodial yield (4% vs. PayPal's 3.7%)**
2. **Stellar native (fastest fiat rails in emerging markets; no other blockchain matches Anchor Platform access)**
3. **Figure's regulatory pedigree (Nasdaq-listed; institutional credibility)**
4. **Cross-border angle** (payment fintechs' top use case, not PayPal consumer focus)
5. **B2B focus** (not consumer; different GTM motion than PYUSD)

**Positioning Strategy:**
- **NOT:** Generic stablecoin (crowded, commodity)
- **YES:** "Yield-bearing stablecoin optimized for global payroll and cross-border settlement"
- **Differentiator:** Stellar's cost + speed + yield on float
- **Audience:** CFOs, Heads of Payments, Treasury VPs at platforms doing cross-border or multi-country payroll

---

## 7. CROSS-BORDER DEEP-DIVE

### Market Size & Growth

| Segment | 2024–2025 Size | Growth Rate | Notes |
|---------|---|---|---|
| **Cross-Border Payments (overall)** | $217–371B/year (varies by methodology) | 7–9% CAGR | Methodology variance reflects different scopes |
| **B2B Cross-Border Payments** | $31.7T (2024); 72.6% of all flows | 733% YoY growth in stablecoin volume | Largest segment; business-to-business dominates |
| **Global Remittances** | $669B (2023, to developing countries) | 5–7% CAGR | Slower than B2B; more regulation friction |
| **Stablecoin Cross-Border Volume (actual)** | $390B (2025) | 72% YoY (2025 vs. 2024) | B2B: ~$226B of $390B total; C2C: remainder |

### Cost & Speed Comparison

**Traditional SWIFT/Correspondent Banking:**
- Cost: 2–7% (SWIFT fee + intermediaries + FX spread + beneficiary bank)
- Settlement: 3–5 days (emerging markets: 24+ hours)
- Example: $200 USD → Colombia = $12.13

**Stablecoin (Stellar preferred for cross-border):**
- Cost: < 0.01–0.5% on institutional rails
- Settlement: 2–5 seconds
- Example: $200 USD → Colombia = < $0.01
- Stellar specifics: $0.0007/txn cost; Protocol 23 (Sept 2025) = 5,000 TPS target

### Key Corridors & Adoption (Where Stellar Shines)

#### 1. **Latin America** (71% institutional adoption)
   - **Players:** MoneyGram (Fireblocks partnership, 2025), local fintech networks
   - **Volume:** High; capital controls in Argentina, Colombia, Venezuela drive adoption
   - **Stellar advantage:** Anchor Platform = deepest fiat on/off ramp access in region
   - **Cost advantage:** Colombian corridors see 80% cost reduction vs. SWIFT
   - **Customer:** Payroll platforms sending to LatAm employees; gig platforms (Uber, Audiomack via Flutterwave); EOR platforms

#### 2. **Africa** (Emerging but fastest-growing)
   - **Players:** Flutterwave (Polygon native, 2025), MoneyGram, Tempo, local Mobile Money Operators
   - **Volume:** 200–300% YoY growth in stablecoin routes (Mobile Money Operators, 2025)
   - **Stellar advantage:** Anchor Platform = unique fiat access in 55+ countries; no other blockchain matches
   - **Customer:** Remittance fintechs, gig platforms (Uber Africa), cross-border payroll

#### 3. **Southeast Asia** (Growth phase)
   - **Players:** Remitly, MoneyGram, local anchor networks
   - **Volume:** Emerging; Philippines, Vietnam, Thailand see stablecoin payroll growth
   - **Stellar advantage:** Existing anchor infrastructure (Coins.ph, etc.); low-cost on/off ramps
   - **Customer:** Overseas Filipino Workers (OFW) payroll, payroll platforms targeting SEA

#### 4. **US ↔ Emerging Markets (B2B Payroll)**
   - **Key lanes:** US → LatAm, US → Africa, US → SEA
   - **Players:** Toku, Deel, Remote, Papaya Global, Franklin (all offer multi-country payroll)
   - **Volume:** $9T annual U.S. payroll; growing % being paid cross-border
   - **Stellar advantage:** Institutional-grade, fast, cheap, fiat rails (no crypto custody needed for workers)

### Companies Actively Using Stablecoin Cross-Border (2025–2026)

| Company | Region | Use Case | Blockchain |
|---------|--------|----------|-----------|
| **MoneyGram** | Global | Remittance + treasury optimization | Fireblocks (multi-chain) |
| **Flutterwave** | Africa | Enterprise payments → consumer remittance | Polygon (USDC native) |
| **Remitly** | Global | Remittance + wallet + treasury | Bridge (Stripe) + multi-chain |
| **Stripe** | Global | Developer infrastructure for B2B | Stellar, Ethereum, Solana, Polygon |
| **Toku** | 100+ countries | Global payroll | Sei, Polygon, Solana, Ethereum |
| **Franklin Payroll** | US + international | Payroll + float yield | Ethereum (DeFi access) |
| **Tempo** | LatAm + Africa | Real-time corridor optimization | Multi-chain |

---

## 8. NAMED TARGET COMPANIES: PRIORITY LIST (15–20)

### Tier 1: Crypto-Native / Stablecoin-Advanced Payroll
1. **Toku** (stablecoin payroll lead; 100+ countries; Jan 2026 launch)
2. **Franklin Payroll** (DeFi yield integration; US-based multi-country payroll)
3. **Papaya Global** (Banco Wallet launched Feb 2026; 140+ countries)

### Tier 2: EOR/Multi-Country Payroll Platforms (Late-Stage Integrators)
4. **Deel** (largest EOR by volume; MoonPay integration Feb 2026; 160+ countries)
5. **Remote** (early adopter via Stripe; Dec 2024 launch)
6. **Guidepoint** (likely evaluating; EOR competitor)
7. **Rippling** (payroll + HR; evaluating stablecoins; no public commitment yet)

### Tier 3: Traditional Payment Processors / Rails
8. **Stripe** (already committed; Bridge acquisition $1.1B; Stellar integrated)
9. **Adyen** (needs stablecoin parity with Stripe; crypto-cautious but competitive pressure mounting)
10. **Checkout.com** (UK-based; similar positioning to Adyen; evaluating)

### Tier 4: Cross-Border / Remittance Specialists
11. **Remitly** (stablecoin strategy launched 2025; global footprint)
12. **MoneyGram** (Fireblocks partnership 2025; legacy remittance + crypto)
13. **Wise** (historically skeptical; competitive threat from Remitly; may move 2026)
14. **WorldRemit** (Africa-focused; watching Flutterwave move; likely 2026 evaluator)

### Tier 5: Stellar Ecosystem Partners (Pre-Positioned)
15. **Arf** (Stellar ODL-style liquidity; financial institution focus; $830M extended in 20 months)
16. **Coins.ph** (Philippines anchor; Remitly partnership; remittance focus)

### Tier 6: Payment & Gig Platform Payroll
17. **Uber** (cross-border gig payout; Flutterwave partnership 2025)
18. **Amazon Flex / Instacart** (potential: gig worker payroll in multiple countries)

### Tier 7: Treasury Optimization / Working Capital Finance
19. **Ant Financial / Alibaba (regional)** (Asian cross-border focus)
20. **Wise Business** (segment shift: if Wise moves, Wise for Business is natural extension)

---

## 9. MARKET DATA & QUANTIFIED OPPORTUNITY

### Global Payroll Market
- **2025 market size:** $27.81B–$33.79B (varies by scope)
- **CAGR:** 4.56%–8.5% to 2030–2035
- **Employees worldwide:** 3B+ (2022 baseline)
- **Annual U.S. payroll:** $9T
- **Stablecoin payroll adoption:** 225+ businesses integrated in 2025 alone

### Stablecoin Transaction Volume
- **2025 total:** $33T (up 72% YoY; outpaced Visa $16.7T fiscal year)
- **B2B segment:** $226B of $390B actual cross-border stablecoin volume
- **USDC:** $18.3T transactions (leading by volume, not liquidity)
- **USDT:** $13.3T transactions; $175B market cap (60% stablecoin market)
- **PYUSD:** 3.7% yield; 13x growth in yield-bearing stablecoins ($660M → $9B, Aug 2023–May 2025)

### Cross-Border Payment Market
- **B2B cross-border:** $31.7T (2024); 72.6% of all cross-border flows
- **Remittances:** $669B to developing countries (2023); growing 5–7% CAGR
- **Stablecoin share (2025):** $390B actual volume; growing from <$100M/month (early 2023) to $6B/month (mid-2025)

### Payment Float Opportunity
- **Annual payroll float value:** $10B+ (for entire U.S. economy)
- **Typical float window:** 2–5 days
- **Idle B2B capital across 4 major routes:** $11.6B trapped
- **Yield now accessible:** 6–9% APY via stablecoin lending (Aave, Compound, Solend)
- **Expected ROI (working capital efficiency):** $2.9B return across 4 routes by 2027 (McKinsey-adjacent research)
- **Per-transaction yield (48-hour float):** 6% yield on $10M daily volume = ~$246K annual revenue

### Stella Network Metrics (Relevant to YLDS Cross-Border GTM)
- **Financial institutions on Stellar:** 300+ banks/fintechs
- **Operating regions:** 55+ countries
- **ODL-style volume (Arf loans extended):** $830M in 20 months
- **RWA tokenized (Q2 2025):** $400B
- **RWA payment volume (Q2 2025 alone):** $4B
- **Anchor Platform on/off ramps:** 475,000+ globally

---

## 10. FINTECH EXECUTIVE LANGUAGE & KEYWORDS

### Money Movement & Settlement
- **"Settlement time"** – speed KPI; target: < 1 second
- **"Settlement lag"** – pain point; traditional = 3–5 days
- **"Payment rail"** – infrastructure pathway (SWIFT, Stellar, Polygon, etc.)
- **"Corridor"** – specific route or currency pair (US–MX, US–NG, etc.)
- **"On-demand liquidity" (ODL)** – ability to access funds in real-time across borders
- **"Pre-funding elimination"** – reducing cash locked in multiple jurisdictions

### Float & Yield
- **"Float"** – idle capital between transaction initiation and settlement
- **"Float capture"** – monetizing idle funds (Treasury strategy)
- **"Yield on float"** – 6–9% APY accessible via stablecoin lending
- **"Working capital efficiency"** – CFO metric; freeing up cash for operations/growth
- **"Treasury management"** – optimizing cash positioning and liquidity

### Payroll Specific
- **"Disbursement"** – payout of wages/contractor payments
- **"Settlement"** – funds reaching employee account; target: instant (vs. 3–5 days)
- **"Multi-country payroll"** – single platform managing 10+ countries (Toku, Deel, Remote)
- **"FX slippage"** – cost of currency conversion delays; stablecoins eliminate
- **"Cross-border payroll friction"** – main pain point solved by stablecoins

### Compliance & Regulatory
- **"AML/KYC"** – Anti-Money Laundering / Know Your Customer (gate to adoption)
- **"KYB"** – Know Your Business (corporate-level verification)
- **"GENIUS Act"** – July 2025 federal stablecoin framework (landmark regulatory event)
- **"Regulatory clarity"** – historically biggest objection; now resolved
- **"Bank Secrecy Act requirements"** – GENIUS Act imposed on stablecoin issuers; legitimizes stablecoins for institutions

### Competitive / Product
- **"Liquidity provider"** – USDC (Circle), USDT (Tether); defines market
- **"Stablecoin yield"** – new product category (2025+); PayPal PYUSD pioneered at 3.7%
- **"Yield-bearing alternative"** – YLDS positioning vs. commodity USDC
- **"Developer-friendly"** – API-first infrastructure (Stripe's Bridge positioning)
- **"Institutional-grade"** – security, compliance, auditability for enterprise CFOs

### Sales/GTM Narrative

**For CPO/Head of Payments:**
> "Stellar + YLDS unlocks cross-border payroll without pre-funding. 4% yield on settlement float + instant employee payouts."

**For CFO/Treasury:**
> "Monetize payroll float. YLDS yields 4% SOFR-adjusted. Stellar settles in seconds, not days. $11.6B of idle B2B capital can now be put to work."

**For VP Operations (Gig/Remote):**
> "Employees paid in their local currency, instantly, via Stellar anchors. No 5-day delays. They see yield benefit passed through as loyalty mechanism."

**For Compliance Officer:**
> "Figure is Nasdaq-listed. GENIUS Act licensed. Multi-chain support allows KYC per jurisdiction. Enterprise-ready compliance stack."

---

## 11. PIPELINE CONTEXT (PROVIDED)

### Known Prospects
- **Franklin Payroll** – Already integrating yield (Summer.fi DeFi); receptive to YLDS
- **Toku** – Stablecoin native; likely evaluating yield-bearing alternatives to commodity USDC
- **Marinade** – *[Not found in research; may be internal reference or sub-partnerships]*
- **FacilitaPay** – *[Not found in research; may be regional/niche player]*
- **Lydian, Rainl** – *[Not found in research; requires direct company research]*

---

## 12. RECOMMENDED GTM MOTION FOR YLDS

### Tier 1 Outreach (Highest Fit)
**Targets:** Toku, Franklin Payroll, Remitly
**Angle:** "Yield-bearing cross-border payroll stablecoin. Stellar-native. Figure-backed. 4% SOFR-adjusted yield."
**Proof Points:**
- 225+ stablecoin payroll adoption (2025)
- $11.6B idle B2B float opportunity
- PayPal PYUSD precedent (3.7% yield, early 2025)
- GENIUS Act removes regulatory objections
- Stellar: $830M ODL-style loans extended (Arf); 475K+ on/off ramps

### Tier 2 Outreach (Secondary)
**Targets:** Deel, Papaya Global, Remote
**Angle:** "Yield alternative to commodity USDC. Differentiation for Enterprise payroll."
**Proof Points:**
- Fastest cross-border settlement (Stellar = 2–5 sec)
- Highest custodial yield in category (4% vs. PYUSD 3.7%)
- Figure credibility (Nasdaq-listed; institutional trust)

### Messaging Pillar: "Stellar's Cross-Border Advantage"
- No other blockchain matches Stellar's fiat access in LatAm, Africa, SEA
- Anchor Platform = 475K on/off ramps vs. competitor networks
- Enables payroll to workers without cryptocurrency exposure (fiat settlement available locally)
- Cost: < $0.01 per transaction vs. SWIFT $5–15 cost

---

## APPENDIX: SOURCES & CITATIONS

All research conducted via web search, April 2026. Key sources:

- [Who Is Adding Stablecoins to Payroll and Why It's No Longer Optional in 2026](https://stablecoininsider.org/stablecoin-payroll-2026/)
- [The State of Stablecoin Payroll: Why EOR Platforms Are Adding Crypto Payout Rails in 2026](https://transak.com/blog/stablecoin-payroll-eor-platforms-2026)
- [Aleo, Toku, and Paxos Labs Launch First Private Stablecoin Payroll Solution](https://www.businesswire.com/news/home/20260129619369/en/Aleo-Toku-and-Paxos-Labs-Launch-First-Private-Stablecoin-Payroll-Solution-Removing-the-Final-Barrier-to-Enterprise-Stablecoin-Adoption)
- [How 2025 Becomes the Year of Stablecoins and Why PayPal, Stripe, and Washington Are In](https://www.financemagnates.com/cryptocurrency/stablecoins-take-off-in-2025-as-paypal-stripe-and-washington-back-the-push/)
- [Stripe's Stablecoin Strategy](https://insights4vc.substack.com/p/stripes-stablecoin-strategy)
- [Payment Float to Revenue: 6–9% Yield Guide 2026](https://rebelfi.io/blog/how-payment-companies-turn-operational-float-into-revenue)
- [MoneyGram Taps Fireblocks to Expand Stablecoin Use in Global Payments and Treasury Ops](https://www.coindesk.com/business/2025/12/04/moneygram-taps-fireblocks-to-expand-stablecoin-use-in-global-payments-and-treasury-ops)
- [Flutterwave Selects Polygon as Its Default Blockchain for Cross-Border Payments](https://polygon.technology/blog/flutterwave-selects-polygon-as-its-default-blockchain-for-cross-border-payments)
- [Stellar 2025: A Podium Finish](https://stellar.org/blog/ecosystem/stellar-2025-year-in-review)
- [Why Enterprises Are Adopting Stablecoins for LATAM Payments](https://polygon.technology/blog/latam-corridor-economics-why-enterprises-are-betting-on-stablecoins-for-cross-border-payments)
- [Stablecoin Market Share and Transaction Volume - September 2025 Data](https://coinledger.io/research/stablecoin-market-share-and-transaction-volume)
- [Stablecoin Transactions Soared 72% in 2025, Hit $33T With USDC in Lead](https://finance.yahoo.com/news/stablecoin-transactions-soared-72-2025-054951388.html)
- [How big is the cross-border payments market? 2032's $62tn TAM](https://www.fxcintel.com/research/reports/how-big-is-the-b2b-cross-border-payments-market)
- [Cross-Border Payments with Stablecoins: Faster and Cheaper Than SWIFT](https://www.transfi.com/blog/cross-border-payments-with-stablecoins-faster-and-cheaper-than-swift)
- [Remitly Harnesses the Power of Stablecoins for Cross-Border Payments](https://news.remitly.com/innovation/remitly-harnesses-stablecoins/)
- [Stablecoins in 2025: How Regulation, Banks, and Fintechs Turned Digital Money Into a Global Infrastructure](https://www.fintechweekly.com/magazine/articles/stablecoins-2025-regulation-banks-fintech-digital-money-infrastructure)
- [Global Stablecoin Regulations 2026: What Enterprises Need to Know](https://bvnk.com/blog/global-stablecoin-regulations-2026)

---

**Brief Prepared:** April 6, 2026
**For:** YLDS GTM Planning (Tier 2 Cross-Border / Payment / Payroll Persona)
