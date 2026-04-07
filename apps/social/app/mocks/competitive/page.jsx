'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const content = `# Circle USDC Site Teardown — Learnings for YLDS.com

## What Circle Does Well

### 1. Social proof via real case studies
Circle features three named customers (Thunes, Immersve, Nubank) with specific use cases and outcomes. This does more selling than any feature bullet ever could — it answers "who actually uses this?" before the visitor has to ask.

**YLDS learning:** We need at least 2–3 named institutional users or integration partners on the page. Even a "trusted by" logo bar with real names (not just service providers like KPMG and UMB) would move the needle. If we can't name clients, a quote from an integration partner works.

### 2. Live network stats that create scale signals
Circle surfaces hard numbers — \$76.4T cumulative volume, 21,000+ partners, 108% yearly growth — in a dedicated section that reads like a Bloomberg terminal. The numbers are large enough to create a "this is already happening" feeling.

**YLDS learning:** Our metrics band is good but undersized in ambition. We show \$609M AUM and \$5.8M interest paid — these are real and honest, but they need framing. Consider adding growth rate (% month-over-month), transaction count, or holder count to show trajectory, not just a snapshot. Even "2,400+ KYB-verified holders" or "12 consecutive months of daily accrual" tells a momentum story.

### 3. Transparency as a first-class nav item
Circle puts "Transparency" in the top nav and backs it with live reserve data (\$77.1B in circulation vs \$77.2B in reserves) with a "last updated" timestamp. This is their trust architecture — they don't just claim transparency, they show it.

**YLDS learning:** We have reserve/issuer data buried in the metrics band. Consider elevating it: a dedicated "Transparency" or "Reserves" section with live (or at least regularly updated) numbers — total AUM, reserve composition, KPMG audit date, NAV. This is our structural advantage over every stablecoin; we should make it impossible to miss.

### 4. Segmented use cases with partner logos per segment
Circle breaks their market into three clear segments (Payments, Dollar access, Trading services), each with its own description and a row of partner logos specific to that use case. This helps visitors self-select and shows ecosystem depth.

**YLDS learning:** Our two use-case cards (Treasury & Reserves, Payments & Settlement) are headed in the right direction but lack the ecosystem proof. Add partner/integration logos under each card. Treasury card → Fireblocks, BitGo, Copper logos. Payments card → Stellar, MoneyGram logos. This turns abstract use cases into concrete ecosystems.

### 5. Developer section (32 blockchains, APIs, SDKs)
Circle dedicates a section to developers — chain count, CCTP protocol, API/SDK links. This captures builders who might integrate USDC into their own products.

**YLDS learning:** wYLDS via Hastra is our developer/DeFi story. We should add a lightweight "Build with YLDS" or "Integrate" section — mention wYLDS, Hastra, available chains, API access. Even a single card with a "View docs →" CTA would capture this audience without cluttering the institutional flow.

### 6. Comprehensive FAQ section
Circle has 12 FAQs addressing common concerns head-on. This is smart for a regulated product — it reduces friction, addresses objections, and is great for SEO.

**YLDS learning:** We have zero FAQ content. For a registered security, this is a missed opportunity. Key questions to address: "How is YLDS different from a stablecoin?", "What does 'registered under the Investment Company Act' mean?", "How does daily accrual work?", "What is the GENIUS Act and why is YLDS exempt?", "How do I redeem?", "What are the fees?"

### 7. Dual CTA tracks
Circle runs two parallel CTAs: "Partner with Circle" (business) and "View docs" (developer). This cleanly serves two audiences without forcing a choice in the hero.

**YLDS learning:** Our "Talk to Sales" + "Read the Prospectus" pairing already does this well. We could strengthen the developer track by adding a "View docs" or "Integrate YLDS" CTA in the nav or in a dedicated section lower on the page.

### 8. Copy tone — authoritative but restrained
Circle lets numbers and case studies carry the argument. Their copy is factual and confident without being salesy. Phrases are short. Claims are backed immediately by data.

**YLDS learning:** This validates the direction we moved toward — understated, factual, let the structure of the product speak. We should continue reducing adjective-heavy copy and leading with specifics.

---

## What Circle Gets Wrong (or what we can beat them on)

1. **No yield story.** USDC doesn't accrue to holders. This is our entire wedge. Every section of the YLDS page should quietly reinforce that YLDS earns and USDC doesn't.

2. **Transparency without teeth.** Circle shows reserve numbers but reserves are self-reported and attestation-based (Grant Thornton). We have KPMG audits and Investment Company Act registration — that's structurally stronger.

3. **Regulatory positioning is defensive.** Circle talks about compliance in their FAQ but doesn't lead with it. We can — our registration is an offensive advantage, not a checkbox.

4. **No "what happens when regulation comes" narrative.** Circle can't tell this story because GENIUS Act and CLARITY Act are threats to their model. We can.

---

## Priority Actions for the YLDS Wireframe

| Priority | Action | Effort |
|----------|--------|--------|
| 🔴 High | Add FAQ section (6–8 questions) | Medium |
| 🔴 High | Add named partner/client logos under use-case cards | Low |
| 🟡 Med | Add a lightweight "Integrate / Build" developer section | Medium |
| 🟡 Med | Elevate transparency — dedicated reserves section with audit date | Medium |
| 🟢 Low | Add growth/trajectory metrics alongside snapshot numbers | Low |
| 🟢 Low | Add "Transparency" to nav | Trivial |
`;

export default function CompetitivePage() {
  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif", background: '#F8F8FF', minHeight: '100vh' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 48px 96px' }}>
        <h1 style={{ fontSize: 32, fontWeight: 500, color: '#262364', marginBottom: 8 }}>Circle / USDC Competitive Teardown</h1>
        <p style={{ fontSize: 15, color: '#6B6B9B', marginBottom: 32 }}>What Circle does well, where YLDS can win, and priority actions for the site rebuild.</p>

        <div style={{
          background: 'white', border: '1px solid #E8E8F0', borderRadius: 16, padding: '40px 48px',
          fontSize: 14, lineHeight: 1.8, color: '#262364',
        }}>
          <div className="prose-ylds">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        </div>
      </div>

      <style>{`
        .prose-ylds h1 { font-size: 28px; font-weight: 700; margin: 0 0 16px; color: #262364; }
        .prose-ylds h2 { font-size: 22px; font-weight: 700; margin: 32px 0 12px; color: #262364; border-bottom: 1px solid #E8E8F0; padding-bottom: 8px; }
        .prose-ylds h3 { font-size: 17px; font-weight: 700; margin: 24px 0 8px; color: #262364; }
        .prose-ylds p { margin: 8px 0; color: #3D3D5C; }
        .prose-ylds ul, .prose-ylds ol { padding-left: 24px; margin: 8px 0; }
        .prose-ylds li { margin: 4px 0; color: #3D3D5C; }
        .prose-ylds strong { color: #262364; }
        .prose-ylds a { color: #5B56F5; text-decoration: none; }
        .prose-ylds blockquote { border-left: 3px solid #5B56F5; padding-left: 16px; margin: 12px 0; color: #6B6B9B; font-style: italic; }
        .prose-ylds table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
        .prose-ylds th { text-align: left; padding: 10px 12px; background: #F8F8FF; border-bottom: 2px solid #E8E8F0; font-weight: 700; color: #262364; }
        .prose-ylds td { padding: 10px 12px; border-bottom: 1px solid #F0F0F8; color: #3D3D5C; }
        .prose-ylds hr { border: none; border-top: 1px solid #E8E8F0; margin: 24px 0; }
        .prose-ylds code { background: #F0EFFF; color: #5B56F5; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
      `}</style>
    </div>
  );
}
