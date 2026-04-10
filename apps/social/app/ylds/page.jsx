'use client';

import { useState } from 'react';

const pages = ['Homepage', 'For Crypto', 'For Institutions', 'Developers & Ecosystems', 'Contact'];

// Shared styles
const S = {
  accent: '#BBB9F5', purple: '#5B56F5', dark: '#262364', mid: '#4D47CA', gray: '#6B6B9B', lightGray: '#9B9BC0', border: '#E8E8F0', lightBg: '#F8F8FF', white: '#FFFFFF',
};

const Pill = ({ children, variant = 'white', onClick, style = {} }) => {
  const base = { padding: '12px 28px', borderRadius: 9999, fontSize: 14, fontWeight: 700, display: 'inline-block', cursor: 'pointer', textDecoration: 'none', border: 'none' };
  const variants = {
    white: { background: 'white', color: S.purple },
    purple: { background: S.purple, color: 'white' },
    outline: { background: 'transparent', color: S.purple, border: `2px solid ${S.purple}` },
    outlineWhite: { background: 'transparent', color: 'white', border: '2px solid rgba(255,255,255,0.3)' },
    textLight: { background: 'transparent', color: 'rgba(255,255,255,0.55)', padding: 0, fontSize: 14, fontWeight: 500 },
  };
  return <a onClick={onClick} style={{ ...base, ...variants[variant], ...style }}>{children}</a>;
};

const Section = ({ bg = 'white', children, style = {} }) => (
  <section style={{ background: bg, padding: '96px 48px', ...style }}>
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>{children}</div>
  </section>
);

const SectionTitle = ({ children, sub, center, light }) => (
  <div style={{ textAlign: center ? 'center' : 'left', marginBottom: 48 }}>
    <h2 style={{ fontSize: 36, fontWeight: 500, color: light ? 'white' : S.dark, marginBottom: sub ? 8 : 0 }}>{children}</h2>
    {sub && <p style={{ fontSize: 18, color: light ? 'rgba(255,255,255,0.6)' : S.gray, lineHeight: 1.6, maxWidth: center ? 600 : 'none', margin: center ? '0 auto' : 0 }}>{sub}</p>}
  </div>
);

const Card = ({ title, children, style = {} }) => (
  <div style={{ padding: 28, borderRadius: 16, border: `1px solid ${S.border}`, background: 'white', ...style }}>
    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{title}</h3>
    <p style={{ color: S.gray, fontSize: 14, lineHeight: 1.6 }}>{children}</p>
  </div>
);

const Grid = ({ cols = 3, gap = 24, children, style = {} }) => (
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap, ...style }}>{children}</div>
);

const Tag = ({ children }) => (
  <span style={{ fontSize: 12, fontWeight: 600, color: S.purple, background: '#F0EFFF', padding: '4px 12px', borderRadius: 6, marginRight: 8 }}>{children}</span>
);

const LogoPill = ({ children }) => (
  <span style={{ fontSize: 12, fontWeight: 700, color: S.gray, background: S.lightBg, border: `1px solid ${S.border}`, padding: '6px 14px', borderRadius: 8 }}>{children}</span>
);

const PlaceholderLogo = ({ children }) => (
  <span style={{ fontSize: 14, fontWeight: 700, color: S.lightGray, background: 'white', border: '2px dashed #D0D0E0', padding: '14px 28px', borderRadius: 12 }}>{children}</span>
);

const CaseStudy = ({ name, type, title, desc, stat, statLabel }) => (
  <div style={{ background: 'white', border: `1px solid ${S.border}`, borderRadius: 16, padding: 32 }}>
    <span style={{ fontSize: 14, fontWeight: 800, color: S.purple, background: '#F0EFFF', padding: '8px 16px', borderRadius: 8, display: 'inline-block', marginBottom: 12 }}>{name}</span>
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: S.lightGray, marginBottom: 12 }}>{type}</div>
    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: S.dark }}>{title}</h3>
    <p style={{ color: S.gray, fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>{desc}</p>
    {stat && <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${S.lightBg}` }}><span style={{ fontSize: 24, fontWeight: 800, color: S.purple }}>{stat}</span><br /><span style={{ fontSize: 12, color: S.gray }}>{statLabel}</span></div>}
    {!stat && <a style={{ color: S.purple, fontSize: 14, fontWeight: 700 }}>Read case study →</a>}
  </div>
);

const MetricCard = ({ val, label, light }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: 36, fontWeight: 800, color: light ? 'white' : S.purple }}>{val}</div>
    <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: light ? 'rgba(255,255,255,0.5)' : S.gray, marginTop: 4 }}>{label}</div>
  </div>
);

const CompTable = ({ headers, rows }) => (
  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
    <thead><tr>{headers.map((h, i) => <th key={i} style={{ textAlign: 'left', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.5, padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 14, fontWeight: j === 0 ? 600 : 400, color: cell === '0%' || cell === 'No' || cell === 'No (attestation)' || cell === 'Restricted' || cell === 'Wire fees' || cell === 'Attestation' || cell === 'T+1' ? 'rgba(255,255,255,0.4)' : cell.includes?.('Yes') || cell.includes?.('~4%') || cell.includes?.('Compliant') || cell.includes?.('KPMG') || cell.includes?.('P2P') || cell.includes?.('wYLDS') || cell.includes?.('<$0.01') || cell.includes?.('$1.00') ? '#BBB9F5' : 'white' }}>{cell}</td>)}</tr>)}</tbody>
  </table>
);

const FAQItem = ({ q, a, open: defaultOpen }) => {
  const [open, setOpen] = useState(defaultOpen || false);
  return (
    <div style={{ borderBottom: `1px solid ${S.border}`, padding: '24px 0' }}>
      <div onClick={() => setOpen(!open)} style={{ fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {q} <span style={{ color: S.purple, fontSize: 20, transform: open ? 'rotate(45deg)' : 'none', transition: '0.2s' }}>+</span>
      </div>
      {open && <p style={{ color: S.gray, fontSize: 14, lineHeight: 1.7, marginTop: 12 }}>{a}</p>}
    </div>
  );
};

const Hero = ({ h1, h1Accent, sub, cta1, cta2, stats, coin }) => (
  <section style={{ background: `linear-gradient(180deg, ${S.dark} 45%, ${S.mid} 85%, ${S.accent} 100%)`, padding: '160px 48px 100px', minHeight: coin ? '90vh' : '70vh', display: 'flex', alignItems: 'center' }}>
    <div style={{ maxWidth: 1280, margin: '0 auto', width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
      <div>
        <h1 style={{ fontSize: coin ? 64 : 52, fontWeight: 500, lineHeight: 1.1, color: 'white', letterSpacing: -1 }}>{h1} <span style={{ color: S.accent }}>{h1Accent}</span></h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 18, lineHeight: 1.6, marginTop: 20, maxWidth: 540 }}>{sub}</p>
        <div style={{ display: 'flex', gap: 20, marginTop: 32, alignItems: 'center' }}>
          <Pill>{cta1 || 'Talk to Sales'}</Pill>
          <Pill variant="textLight">{cta2 || 'Read the Prospectus →'}</Pill>
        </div>
        {stats && <div style={{ display: 'flex', gap: 40, marginTop: 48 }}>{stats.map((s, i) => <MetricCard key={i} val={s.val} label={s.label} light />)}</div>}
      </div>
      {coin && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 300, height: 300, borderRadius: '50%', background: `linear-gradient(135deg, #8B86FF 0%, ${S.purple} 40%, #3D38C9 100%)`, boxShadow: '0 0 80px rgba(91,86,245,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 100, fontWeight: 800, color: 'rgba(255,255,255,0.15)' }}>Y</span>
        </div>
      </div>}
    </div>
  </section>
);

const Footer = ({ hasHastra, onNavigate }) => (
  <div style={{ background: '#1A1752', padding: '48px 48px 32px', color: 'rgba(255,255,255,0.35)', fontSize: 12, lineHeight: 1.7 }}>
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      {onNavigate && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 32, marginBottom: 32, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            {['Homepage', 'For Crypto', 'For Institutions', 'Developers & Ecosystems', 'Contact'].map((label, i) => (
              <a key={i} onClick={() => onNavigate(i)} style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 500, cursor: 'pointer', textDecoration: 'none', transition: '0.2s' }}>{label}</a>
            ))}
          </div>
          <a href="https://app.ylds.io" target="_blank" rel="noopener noreferrer" style={{ padding: '10px 28px', borderRadius: 9999, fontSize: 13, fontWeight: 700, background: S.purple, color: 'white', textDecoration: 'none', whiteSpace: 'nowrap' }}>Get YLDS</a>
        </div>
      )}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 24, marginBottom: 16 }}>
        <p style={{ marginBottom: 12 }}><strong style={{ color: 'rgba(255,255,255,0.5)' }}>Important Disclosures</strong></p>
        <p style={{ marginBottom: 12 }}>YLDS is a registered fixed-income security issued by Figure Certificate Corporation. It is not a stablecoin, deposit account, or money market fund. Investment products: Not FDIC Insured · No Bank Guarantee · May Lose Value. Not suitable for all investors.</p>
        <p style={{ marginBottom: 12 }}>* Yield is variable and based on SOFR minus 35 basis points. The ~4% rate reflects the current approximate yield and is subject to change. Past yield is not indicative of future results.</p>
        {hasHastra && <>
          <p style={{ marginBottom: 12 }}><strong style={{ color: 'rgba(255,255,255,0.5)' }}>About Hastra and wYLDS</strong></p>
          <p style={{ marginBottom: 12 }}>Hastra is an independent entity and is not affiliated with, owned by, or operated by Figure Certificate Corporation or Figure Advance LLC. wYLDS is a wrapped version of YLDS created and distributed solely by Hastra.</p>
        </>}
        <p>Please read the prospectus carefully before investing.</p>
      </div>
      <div style={{ textAlign: 'center' }}>© 2026 Figure Certificate Corporation. All rights reserved.</div>
    </div>
  </div>
);

const BottomCTA = ({ title, sub, cta1, cta2 }) => (
  <section style={{ background: `linear-gradient(180deg, ${S.dark} 0%, #3D38C9 50%, ${S.purple} 100%)`, padding: '96px 48px', textAlign: 'center', color: 'white' }}>
    <h2 style={{ fontSize: 40, fontWeight: 500, marginBottom: 12 }}>{title}</h2>
    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, marginBottom: 32 }}>{sub}</p>
    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', alignItems: 'center' }}>
      <Pill>{cta1 || 'Talk to Sales'}</Pill>
      {cta2 && <Pill variant="textLight" style={{ color: 'rgba(255,255,255,0.55)' }}>{cta2}</Pill>}
    </div>
  </section>
);

// ─── PAGE: HOMEPAGE ───
const HomePage = ({ onNavigate }) => (
  <>
    <Hero h1="Your stablecoins should be" h1Accent="earning." sub="YLDS accrues ~4% daily.* Send it anywhere. Settle instantly. The only registered fixed-income security that transfers peer-to-peer on-chain." cta1="Get YLDS" cta2="For large volumes, talk to our team →" coin />

    <Section><SectionTitle sub="Not a stablecoin. A security that happens to behave like one.">What makes YLDS different</SectionTitle>
      <Grid cols={4}><Card title="Earn ~4% by just holding it.">YLDS accrues yield every single day.* USDC and USDT pay you zero. You don't need to stake, lock, or do anything. Just hold it.</Card><Card title="Send it to anyone, anytime.">Transfer peer-to-peer on supported chains. No intermediaries. No waiting. 24/7/365.</Card><Card title="Settle at $1.00. Always.">Redeem to USD whenever you want. No gates, no redemption windows, no surprises. $1.00 NAV, KPMG-audited.</Card><Card title="Built for what's coming">Registered under the Investment Company Act. Compliant with GENIUS Act and CLARITY Act restrictions.</Card></Grid>
    </Section>

    <Section bg={S.purple} style={{ padding: '80px 48px' }}>
      <Grid cols={5} style={{ marginBottom: 48 }}><MetricCard val="$609M+" label="Ecosystem AUM" light /><MetricCard val="~4.0%" label="Current Yield (Variable)" light /><MetricCard val="$5.8M" label="Interest Paid" light /><MetricCard val="3" label="Chains Live" light /><MetricCard val="24/7" label="Settlement" light /></Grid>
      <Grid cols={3} gap={16}>{[['Issuer','Figure Certificate Corp.'],['Reserve Custodian','UMB Bank NA'],['Auditor','KPMG LLP'],['Investment Manager','Figure Investment Advisors'],['Transfer Agent','Figure Equity Solutions'],['Domicile','United States']].map(([r,n],i)=><div key={i} style={{display:'flex',justifyContent:'space-between',padding:'14px 20px',background:'rgba(255,255,255,0.08)',borderRadius:12,fontSize:14}}><span style={{opacity:0.6,fontSize:13}}>{r}</span><span style={{fontWeight:600}}>{n}</span></div>)}</Grid>
    </Section>

    <Section bg={S.lightBg}>
      <SectionTitle center sub="Audited reserves. Registered structure. NAV calculated daily.">Transparency</SectionTitle>
      <Grid cols={3} style={{ maxWidth: 900, margin: '0 auto' }}>
        {[['$609M+','Total AUM'],['$1.00','NAV per Share'],['KPMG','Annual Audit']].map(([v,l],i)=><div key={i} style={{background:'white',border:`1px solid ${S.border}`,borderRadius:16,padding:32,textAlign:'center'}}><div style={{fontSize:32,fontWeight:800,color:S.purple}}>{v}</div><div style={{fontSize:13,color:S.gray,marginTop:4}}>{l}</div></div>)}
      </Grid>
      <p style={{ color: S.lightGray, fontSize: 13, marginTop: 32, textAlign: 'center' }}>Reserve composition: US Treasuries, bank deposits, and repurchase agreements. <a style={{ color: S.purple, fontWeight: 600 }}>View prospectus →</a></p>
    </Section>

    <Section><SectionTitle center>How it works</SectionTitle>
      <Grid cols={4} gap={32}>{[['1','Mint','Deposit USD. Receive YLDS 1:1.'],['2','Accrue','~4% accrues daily (variable).* KPMG-audited reserves.'],['3','Use','Transfer, collateralize, or settle. 24/7.'],['4','Redeem','Typically same-day. Credit-line-backed liquidity.']].map(([n,t,d],i)=><div key={i} style={{textAlign:'center'}}><div style={{width:56,height:56,borderRadius:'50%',background:S.purple,color:'white',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',fontSize:22,fontWeight:800}}>{n}</div><h3 style={{fontSize:16,fontWeight:700,marginBottom:6}}>{t}</h3><p style={{color:S.gray,fontSize:13,lineHeight:1.5}}>{d}</p></div>)}</Grid>
    </Section>

    <Section bg={S.lightBg}><SectionTitle sub="YLDS meets you where you are.">One asset, every audience</SectionTitle>
      <Grid cols={3}>{[
        {t:'For Crypto',d:'Replace idle USDC/USDT with ~4% daily yield.* Composable via wYLDS. Compliant with GENIUS and CLARITY Acts.',a:'Treasuries · DAOs · VCs · DeFi',logos:['Ondo','Hastra','Solana']},
        {t:'For Institutions',d:'Registered security. KPMG-audited. $1.00 NAV. The structure your compliance team will approve and your treasury team has been asking for.',a:'Banks · Fintechs · Funds · Corporate',logos:['Fireblocks','Toku','Stellar']},
        {t:'Developers & Ecosystems',d:'Bring YLDS to your chain or integrate wYLDS into your protocol. Two forms, one asset, every audience.',a:'Foundations · Protocols · Wallets · Platforms',logos:['Provenance','Stellar','Solana']},
      ].map((c,i)=><div key={i} style={{background:'white',borderRadius:20,padding:36,border:`1px solid ${S.border}`}}><h3 style={{fontSize:22,fontWeight:700,marginBottom:8}}>{c.t}</h3><p style={{color:S.gray,fontSize:15,lineHeight:1.6,marginBottom:12}}>{c.d}</p><div style={{color:S.lightGray,fontSize:12,fontWeight:600,textTransform:'uppercase',letterSpacing:0.5}}>{c.a}</div><a style={{color:S.purple,fontSize:14,fontWeight:700,marginTop:16,display:'inline-block'}}>Explore →</a><div style={{display:'flex',gap:12,marginTop:20,paddingTop:20,borderTop:`1px solid ${S.lightBg}`}}>{c.logos.map((l,j)=><LogoPill key={j}>{l}</LogoPill>)}</div></div>)}</Grid>
    </Section>

    <Section><SectionTitle center sub="One asset, two access paths. Permissioned for institutions. Permissionless for DeFi.">Integrate YLDS</SectionTitle>
      <Grid cols={2}>{[
        {t:'YLDS — Institutional',d:'Direct access via KYB. Mint, redeem, and transfer through the Figure platform or API.',tags:['Provenance','Stellar','Fireblocks','BitGo','Copper'],cta:'Talk to Sales →'},
        {t:'wYLDS — Permissionless',d:'Wrapped YLDS via Hastra. No KYB required. Composable with DeFi protocols and liquidity pools.',tags:['Solana','More chains coming'],cta:'Learn about Hastra →'},
      ].map((c,i)=><div key={i} style={{border:`1px solid ${S.border}`,borderRadius:16,padding:32}}><h3 style={{fontSize:18,fontWeight:700,marginBottom:8}}>{c.t}</h3><p style={{color:S.gray,fontSize:14,lineHeight:1.6,marginBottom:16}}>{c.d}</p><div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>{c.tags.map((t,j)=><Tag key={j}>{t}</Tag>)}</div><a style={{color:S.purple,fontSize:14,fontWeight:700}}>{c.cta}</a></div>)}</Grid>
    </Section>

    <Section bg={S.lightBg} style={{ padding: '96px 48px' }}>
      <SectionTitle center>Frequently asked questions</SectionTitle>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <FAQItem open q="How is YLDS different from a stablecoin?" a="YLDS is a registered fixed-income security, not a stablecoin. It maintains a $1.00 NAV and accrues ~4% daily to holders* (variable rate, based on SOFR minus 35bps). Unlike stablecoins, YLDS is registered under the Investment Company Act and is structured to distribute yield to holders. Read the prospectus for full details." />
        <FAQItem q="What does 'registered under the Investment Company Act' mean?" a="It means YLDS is subject to a regulatory framework similar to mutual funds and money market funds. The fund's reserves, operations, and disclosures are subject to SEC oversight — a level of structural protection not typically associated with stablecoins." />
        <FAQItem q="Why is YLDS compliant with the GENIUS Act?" a="The GENIUS Act (signed into law July 2025) prohibits payment stablecoin issuers from paying yield to holders. Because YLDS is a registered security — not a payment stablecoin — it falls outside the scope of this restriction. The same logic applies to the pending CLARITY Act. YLDS is compliant with both." />
        <FAQItem q="How does daily accrual work?" a="YLDS accrues yield daily based on SOFR minus 35 basis points. No staking or lockups required — just hold it. The rate is variable and changes with prevailing market conditions. Accrual is calculated on your holdings at the end of each business day and accumulates as long as you hold YLDS." />
        <FAQItem q="What is wYLDS?" a="wYLDS is a wrapped, permissionless version of YLDS distributed by Hastra, an independent entity not affiliated with Figure Certificate Corporation. It allows DeFi protocols and permissionless applications to access YLDS yield without going through the KYB process directly. wYLDS is currently live on Solana, with additional chains coming." />
        <FAQItem q="How do I buy YLDS?" a="You can get YLDS directly through app.ylds.io. For large-volume allocations or institutional onboarding, contact our team." />
        <FAQItem q="What blockchains is YLDS on?" a="YLDS is live on Provenance and Stellar. wYLDS (the wrapped permissionless version via Hastra) is live on Solana. Additional chains are in the pipeline." />
      </div>
    </Section>

    <BottomCTA title="Over $305B in stablecoins are sitting idle. Don't be one of them." sub="Your dollar should be earning. Start now, or talk to our team for large allocations." cta1="Get YLDS" cta2="Contact our team →" />
    <Footer hasHastra onNavigate={onNavigate} />
  </>
);

// ─── PAGE: FOR CRYPTO ───
const CryptoPage = ({ onNavigate }) => (
  <>
    <Hero h1="Idle capital is" h1Accent="a choice." sub="Your treasury is sitting in stablecoins that can't pay you — and after GENIUS, never will. YLDS accrues ~4% daily,* moves on-chain, and is the only registered security that transfers peer-to-peer." cta1="Get YLDS" cta2="For large volumes, talk to our team →" stats={[{val:'~4.0%',label:'Variable Yield (SOFR - 35bps)'},{val:'$5.8M+',label:'Interest Earned by Holders'}]} />

    <Section><SectionTitle sub="Not a stablecoin. Not a wrapper. A registered security that behaves like one.">What makes YLDS different</SectionTitle>
      <Grid cols={4}><Card title="~4% APY. No staking. No lock-ups.">Hold it and earn. Paid monthly. No staking contracts, no claiming. Your dead capital starts working immediately.*</Card><Card title="The yield that's still legal.">GENIUS Act bans stablecoin yield. CLARITY Act extends it. YLDS is a registered security — compliant with both.</Card><Card title="Composable via wYLDS">Kamino. Morpho. Jupiter. wYLDS is live and composable today. Loop it, lend it, LP it. Real integrations, not a roadmap. No KYB for wYLDS.</Card><Card title="Reserve-backed. Not synthetic. Not subsidized.">Yield comes from U.S. Treasuries, not derivatives, governance votes, or protocol emissions. KPMG-audited. Your risk committee won't reject this one.</Card></Grid>
    </Section>

    <Section bg={S.dark} style={{ padding: '80px 48px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
        <SectionTitle center light sub="Congress banned stablecoin yield. YLDS was registered before they did — and it's structured to stay compliant through whatever comes next.">The regulatory landscape changed. YLDS didn't.</SectionTitle>
        <Grid cols={3}>{[{date:'2024',t:'YLDS registered',d:'Filed and registered under the Investment Company Act as a fixed-income security.'},{date:'July 2025',t:'GENIUS Act signed',d:'Bans payment stablecoin issuers from paying yield to holders. YLDS compliant.'},{date:'Pending',t:'CLARITY Act',d:'Extends yield restrictions to platforms. YLDS structured to remain compliant.'}].map((e,i)=><div key={i} style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:16,padding:24,textAlign:'center'}}><div style={{fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:1,color:S.accent,marginBottom:8}}>{e.date}</div><h3 style={{fontSize:16,fontWeight:700,marginBottom:6,color:'white'}}>{e.t}</h3><p style={{fontSize:13,color:'rgba(255,255,255,0.5)',lineHeight:1.5}}>{e.d}</p></div>)}</Grid>
        <p style={{ fontSize: 20, fontWeight: 500, color: S.accent, marginTop: 40 }}>Built before GENIUS. Ready for whatever follows.</p>
      </div>
    </Section>

    <Section bg={S.lightBg}><SectionTitle sub="Treasury, DeFi, payments — one asset across every use case.">What you can do with YLDS</SectionTitle>
      <Grid cols={3}><Card title="Hold as treasury">Replace idle USDC/USDT with YLDS. Accrue ~4% daily* on protocol reserves, DAO treasuries, or fund dry powder.</Card><Card title="Deploy in DeFi">Use wYLDS in liquidity pools, lending protocols, and vaults. Yield accrues on the underlying while deployed.</Card><Card title="Settle and send">Transfer on Stellar for &lt;$0.01. Accrue on float in transit. Cash out to 475K+ fiat access points.</Card></Grid>
    </Section>

    <Section bg={S.purple} style={{ padding: '80px 48px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <SectionTitle center light sub="What you're giving up by sitting in USDC.">YLDS vs. your current stablecoin position</SectionTitle>
        <CompTable headers={['','YLDS','USDC','USDT','sDAI','BUIDL']} rows={[['Daily yield to holders','~4%*','0%','0%','Variable','~4–5%'],['Registered security','Yes','No','No','No','Yes'],['GENIUS Act compliant','Compliant','Restricted','Restricted','Restricted','N/A'],['P2P transferable','Yes','Yes','Yes','Yes','Restricted'],['DeFi composable','wYLDS','Native','Native','Native','No'],['KPMG-audited reserves','Yes','No (attestation)','No','No','Yes'],['Dollar peg','$1.00 NAV','$1.00','$1.00','Variable','$1.00']]} />
      </div>
    </Section>

    <Section><SectionTitle sub="Real treasuries putting idle reserves to work.">How crypto organizations use YLDS</SectionTitle>
      <Grid cols={3}>
        <CaseStudy name="Ondo / Erebor" type="Treasury Allocation" title="$25M+ YLDS position" desc="Allocated treasury reserves into YLDS as a registered, yield-accruing alternative to idle stablecoin holdings." stat="$25M+" statLabel="YLDS purchased" />
        <CaseStudy name="Toku" type="Payroll" title="Cross-border payroll on YLDS" desc="Using YLDS for global payroll disbursements — accruing on float between funding and payout." />
        <CaseStudy name="Stellar Apps" type="Fintech Settlement" title="Fintechs building on Stellar + YLDS" desc="Fintech companies using YLDS for cross-border settlement with sub-penny transfers and daily yield accrual." />
      </Grid>
    </Section>

    <div style={{ background: S.lightBg, padding: '64px 48px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ color: S.lightGray, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 24 }}>Organizations holding YLDS</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>{['Protocol Name','DAO Name','Fund Name','Protocol Name','Fund Name','DAO Name'].map((n,i)=><PlaceholderLogo key={i}>{n}</PlaceholderLogo>)}</div>
      </div>
    </div>

    <BottomCTA title="Over $305B in stablecoins are sitting idle. Don't be one of them." sub="Your dollar should be earning. Start now, or talk to our team for large allocations." cta1="Get YLDS" cta2="Contact our team →" />
    <Footer hasHastra onNavigate={onNavigate} />
  </>
);

// ─── PAGE: FOR INSTITUTIONS ───
const InstitutionsPage = ({ onNavigate }) => (
  <>
    <Hero h1="A registered security that earns like a money market" h1Accent="and moves like a stablecoin." sub="YLDS is a registered fixed-income security — subject to the same regulatory framework as money market funds. ~4% daily accrual,* $1.00 NAV, KPMG-audited, and transferable peer-to-peer on-chain." cta1="Get YLDS" cta2="Talk to our team →" stats={[{val:'~4.0%',label:'Variable Yield (SOFR - 35bps)'},{val:'$609M+',label:'Ecosystem AUM'},{val:'KPMG',label:'Annual Audit'}]} />

    <Section><SectionTitle sub="The structure your compliance team will approve. The yield your treasury team has been looking for.">Built for regulated capital</SectionTitle>
      <Grid cols={4}><Card title="Registered under the Investment Company Act.">YLDS is registered under the same framework as money market funds. Filed with the SEC. Public prospectus. Your compliance team can review before committing.</Card><Card title="KPMG-audited">Annual audit by KPMG LLP. UMB Bank as reserve custodian. Reserve composition available on demand.</Card><Card title="NAV-stable at $1.00">Dollar peg maintained through short-dated US Treasuries, bank deposits, and repurchase agreements.</Card><Card title="Compliant with GENIUS & CLARITY">GENIUS Act bans stablecoin yield. CLARITY Act extends it. YLDS is a registered security — compliant with both. Structured for whatever comes next.</Card></Grid>
    </Section>

    <Section bg={S.dark} style={{ padding: '80px 48px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
        <div><h2 style={{ fontSize: 36, fontWeight: 500, color: 'white', marginBottom: 16 }}>What registration means for your organization</h2><p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16, lineHeight: 1.7 }}>YLDS isn't just compliant — it's structurally designed for institutional due diligence.</p></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{[['📋','SEC-filed prospectus','Full disclosure document. Your legal and compliance teams can review before committing.'],['🏦','Segregated reserves','Held at UMB Bank NA. Not commingled with operating capital.'],['📊','Audited by KPMG','Annual financial audit by a Big Four firm. Not an attestation — a full audit.'],['⚖️','Investment Company Act','Same governance and disclosure requirements as traditional money market funds.']].map(([icon,t,d],i)=><div key={i} style={{display:'flex',gap:16,alignItems:'flex-start'}}><div style={{width:40,height:40,borderRadius:10,background:'rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:18}}>{icon}</div><div><h3 style={{fontSize:15,fontWeight:700,color:'white',marginBottom:4}}>{t}</h3><p style={{fontSize:13,color:'rgba(255,255,255,0.5)',lineHeight:1.5}}>{d}</p></div></div>)}</div>
      </div>
    </Section>

    <Section>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
        <div><h2 style={{ fontSize: 36, fontWeight: 500, marginBottom: 8 }}>Cash sweep, on-chain</h2><p style={{ color: S.gray, fontSize: 16, lineHeight: 1.7, marginBottom: 16 }}>Cash sweep is a standard treasury operation — excess cash moves into a higher-yielding instrument, then sweeps back when needed. YLDS brings this to digital assets.</p><p style={{ color: S.gray, fontSize: 16, lineHeight: 1.7 }}>Set a reserve threshold. Excess auto-mints to YLDS. When outflows require it, YLDS redeems back to USD. No manual intervention.</p></div>
        <div style={{ background: S.lightBg, border: `1px solid ${S.border}`, borderRadius: 16, padding: 32 }}>
          {[['1','Set threshold','e.g., maintain $5M in operating reserves'],['2','Auto-mint','excess above threshold mints to YLDS'],['3','Accrue','YLDS earns ~4% daily* while held'],['4','Auto-redeem','sweeps back to USD when balance drops']].map(([n,t,d],i)=><div key={i}><div style={{display:'flex',alignItems:'center',gap:12,marginBottom:i<3?16:0}}><div style={{width:32,height:32,borderRadius:'50%',background:S.purple,color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:800,flexShrink:0}}>{n}</div><div style={{fontSize:14}}><strong>{t}</strong> <span style={{color:S.gray}}>— {d}</span></div></div>{i<3&&<div style={{width:2,height:16,background:S.border,marginLeft:15}} />}</div>)}
          <div style={{ marginTop: 16 }}><Tag>Fully automated</Tag><Tag>No lockups</Tag><Tag>Typically same-day</Tag></div>
        </div>
      </div>
    </Section>

    <Section bg={S.purple} style={{ padding: '80px 48px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <SectionTitle center light sub="How YLDS compares to what your treasury holds today.">YLDS vs. traditional alternatives</SectionTitle>
        <CompTable headers={['','YLDS','Money Market Fund','Stablecoins']} rows={[['Yield to holders','~4%*','~4–5%','0%'],['On-chain transferable','P2P','No','Yes'],['24/7 settlement','Yes','T+1','Yes'],['Registered security','Yes','Yes','No'],['GENIUS Act compliant','Compliant','N/A','Restricted'],['Cross-border settlement','<$0.01','Wire fees','Variable'],['Audited reserves','KPMG','Varies','Attestation']]} />
      </div>
    </Section>

    <Section><SectionTitle sub="Institutions using YLDS for treasury, payments, and settlement.">Trusted by leading organizations</SectionTitle>
      <Grid cols={3}>
        <CaseStudy name="Ondo / Erebor" type="Treasury Allocation" title="$25M+ YLDS position" desc="Allocated treasury reserves into YLDS as a registered, yield-accruing alternative to idle stablecoin holdings." stat="$25M+" statLabel="YLDS purchased" />
        <CaseStudy name="Toku" type="Payroll" title="Cross-border payroll on YLDS" desc="Using YLDS as the settlement layer for global payroll disbursements — accruing on float between funding and payout." />
        <CaseStudy name="Stellar Apps" type="Fintech Settlement" title="Fintech settlement on Stellar" desc="Fintech companies building on Stellar using YLDS for cross-border settlement with sub-penny transfer costs." />
      </Grid>
    </Section>

    <div style={{ background: S.lightBg, padding: '64px 48px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ color: S.lightGray, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 24 }}>Organizations holding YLDS</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: S.dark, background: S.lightBg, border: `1px solid ${S.border}`, padding: '14px 28px', borderRadius: 12 }}>Ondo</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: S.dark, background: S.lightBg, border: `1px solid ${S.border}`, padding: '14px 28px', borderRadius: 12 }}>Toku</span>
          {['Client Name','Client Name','Client Name','Client Name'].map((n,i)=><PlaceholderLogo key={i}>{n}</PlaceholderLogo>)}
        </div>
      </div>
    </div>

    <BottomCTA title="Ready to put idle capital to work?" sub="Get YLDS directly or talk to our team for treasury allocations and settlement flows." cta1="Get YLDS" cta2="Talk to our team →" />
    <Footer hasHastra={false} onNavigate={onNavigate} />
  </>
);

// ─── PAGE: DEVELOPERS ───
const DevelopersPage = ({ onNavigate }) => (
  <>
    <Hero h1="Bring YLDS to" h1Accent="your ecosystem." sub="YLDS exists in multiple forms across multiple chains. Whether you're a foundation, protocol, or platform — there's a path to bring compliant, yield-accruing digital assets to your users." cta1="Contact the Team" cta2="View docs →" stats={[{val:'3',label:'Chains Live'},{val:'$609M+',label:'Ecosystem AUM'},{val:'~4.0%',label:'Variable Yield'}]} />

    <Section><SectionTitle sub="YLDS exists in permissioned and permissionless forms. Both are backed by the same registered security and reserve pool.">Two forms, one asset</SectionTitle>
      <Grid cols={2}>{[
        {badge:'Permissioned',badgeColor:S.purple,t:'YLDS',d:'Issued directly by Figure Certificate Corporation. Requires KYB. For institutions, funds, and regulated entities.',items:['Registered fixed-income security','~4% variable daily accrual (SOFR - 35bps)','Direct mint/redeem via Figure platform or API','Custodian integrations: Fireblocks, BitGo, Copper','KYB required'],tags:['Provenance','Stellar'],note:'Issued by Figure Certificate Corporation, a registered investment company.',cta:'Bring YLDS to your chain →'},
        {badge:'Permissionless',badgeColor:S.gray,t:'wYLDS',d:'Wrapped version of YLDS distributed by Hastra. No KYB required. Composable with DeFi protocols and permissionless applications.',items:['Backed 1:1 by YLDS reserves','Permissionless — no KYB required','DeFi-composable: vaults, lending, LPs','Multi-chain by design','Distributed and managed by Hastra'],tags:['Solana','More chains coming'],note:'Hastra is an independent entity and is not affiliated with Figure Certificate Corporation or Figure Advance LLC. wYLDS is distributed solely by Hastra.',cta:'Talk to Hastra about wYLDS →'},
      ].map((c,i)=><div key={i} style={{borderRadius:16,padding:36,border:`1px solid ${S.border}`,background:'white'}}>
        <span style={{display:'inline-block',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:1,padding:'4px 12px',borderRadius:6,marginBottom:16,color:i===0?S.purple:S.dark,background:i===0?'#F0EFFF':'#E8E8F0'}}>{c.badge}</span>
        <h3 style={{fontSize:22,fontWeight:700,marginBottom:8}}>{c.t}</h3>
        <p style={{color:S.gray,fontSize:15,lineHeight:1.6,marginBottom:16}}>{c.d}</p>
        <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:20}}>{c.items.map((item,j)=><div key={j} style={{display:'flex',alignItems:'flex-start',gap:10,fontSize:14,color:S.gray}}><span style={{color:S.purple,fontWeight:700}}>✓</span>{item}</div>)}</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>{c.tags.map((t,j)=><Tag key={j}>{t}</Tag>)}</div>
        <div style={{fontSize:12,color:S.lightGray,padding:'12px 16px',background:S.lightBg,borderRadius:8,borderLeft:`3px solid ${S.border}`,lineHeight:1.5,marginBottom:12}}>{c.note}</div>
        <a style={{color:S.purple,fontSize:14,fontWeight:700}}>{c.cta}</a>
      </div>)}</Grid>
    </Section>

    <Section bg={S.lightBg}><SectionTitle sub="For chains, protocols, and platforms looking to attract institutional capital and offer compliant yield.">What YLDS adds to your ecosystem</SectionTitle>
      <Grid cols={4}><Card title="Institutional TVL">YLDS is a registered security. Institutions that can't touch unregistered tokens can hold YLDS — bringing new capital to your chain.</Card><Card title="Compliant yield">~4% daily accrual that survives GENIUS Act and CLARITY Act. Offer your users yield without regulatory risk.</Card><Card title="Settlement rail">Settles 24/7 with sub-penny costs on Stellar. Add a payment and settlement layer to your ecosystem.</Card><Card title="DeFi composability">wYLDS plugs into lending protocols, vaults, and liquidity pools. Yield-accruing collateral with a dollar peg.</Card></Grid>
    </Section>

    <Section bg={S.dark} style={{ padding: '80px 48px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
        <SectionTitle center light sub="Whether you're bringing YLDS or wYLDS to your chain — reach out and we'll scope the integration together.">Ready to integrate?</SectionTitle>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', alignItems: 'center', marginTop: 32 }}>
          <Pill>Contact the Team</Pill>
          <Pill variant="textLight">View docs →</Pill>
        </div>
      </div>
    </Section>

    <Section><SectionTitle sub="Live on three chains with more in the pipeline.">Where YLDS lives today</SectionTitle>
      <Grid cols={3}>{[{status:'● Live',color:'#22C55E',t:'Provenance',d:'YLDS minting, redemption, and P2P transfer. Full custodian support.',form:'YLDS (permissioned)'},{status:'● Live',color:'#22C55E',t:'Stellar',d:'Cross-border settlement and payment flows. Sub-penny transfers. 475K+ fiat off-ramps.',form:'YLDS (permissioned)'},{status:'● Live',color:'#22C55E',t:'Solana',d:'wYLDS via Hastra. Permissionless access for DeFi protocols and lending markets.',form:'wYLDS (permissionless, via Hastra)'}].map((c,i)=><div key={i} style={{border:`1px solid ${S.border}`,borderRadius:16,padding:28,background:'white'}}><div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:1,color:c.color,marginBottom:12}}>{c.status}</div><h3 style={{fontSize:18,fontWeight:700,marginBottom:6}}>{c.t}</h3><p style={{color:S.gray,fontSize:13,lineHeight:1.5,marginBottom:12}}>{c.d}</p><div style={{fontSize:11,color:S.lightGray,fontWeight:600}}>Form: {c.form}</div></div>)}</Grid>
    </Section>

    <Section bg={S.lightBg}><SectionTitle sub="If you're building something that could benefit from compliant, yield-accruing digital assets.">Who should reach out</SectionTitle>
      <Grid cols={4}><Card title="L1 / L2 foundations">Bring YLDS or wYLDS to your chain. Attract institutional capital and offer compliant yield.</Card><Card title="DeFi protocols">Integrate wYLDS as collateral, yield layer, or liquidity. Productive base asset for lending and vaults.</Card><Card title="Fintechs & neobanks">Embed YLDS into savings, payment, or settlement products. Registered security, white-label ready.</Card><Card title="Wallets & custodians">Support YLDS or wYLDS for your users. Custodian integration docs and API access available.</Card></Grid>
    </Section>

    <Section style={{ padding: '96px 48px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <SectionTitle center sub="Tell us about your ecosystem and what you're looking to build.">Get in touch</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div><label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>First name</label><input style={{ width: '100%', padding: '12px 16px', border: `1px solid ${S.border}`, borderRadius: 10, fontSize: 14, background: S.lightBg }} placeholder="Jane" /></div>
            <div><label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Last name</label><input style={{ width: '100%', padding: '12px 16px', border: `1px solid ${S.border}`, borderRadius: 10, fontSize: 14, background: S.lightBg }} placeholder="Smith" /></div>
          </div>
          <div><label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Email</label><input style={{ width: '100%', padding: '12px 16px', border: `1px solid ${S.border}`, borderRadius: 10, fontSize: 14, background: S.lightBg }} placeholder="jane@example.com" /></div>
          <div><label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Organization</label><input style={{ width: '100%', padding: '12px 16px', border: `1px solid ${S.border}`, borderRadius: 10, fontSize: 14, background: S.lightBg }} placeholder="Acme Protocol" /></div>
          <div><label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>I'm interested in</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['YLDS — Bringing the permissioned security to my chain (via Figure)','wYLDS — Bringing the permissionless wrapped version (via Hastra)','Both — Exploring permissioned and permissionless paths','Purchasing YLDS — I want to buy YLDS directly'].map((label,i)=><label key={i} style={{display:'flex',alignItems:'center',gap:10,fontSize:14,cursor:'pointer'}}><input type="checkbox" style={{width:18,height:18,accentColor:S.purple}} />{label}</label>)}
            </div>
          </div>
          <div><label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Tell us about your use case</label><textarea style={{ width: '100%', padding: '12px 16px', border: `1px solid ${S.border}`, borderRadius: 10, fontSize: 14, background: S.lightBg, minHeight: 100, resize: 'vertical', fontFamily: 'inherit' }} placeholder="What are you building? What chains are you on?" ></textarea></div>
          <div style={{ textAlign: 'center', marginTop: 12 }}><Pill variant="purple" style={{ padding: '16px 48px', fontSize: 16 }}>Submit</Pill></div>
        </div>
      </div>
    </Section>

    <BottomCTA title="The next chain to get YLDS could be yours." sub="Contact Figure for YLDS or Hastra for wYLDS." cta1="Contact the Team" cta2="View docs →" />
    <Footer hasHastra onNavigate={onNavigate} />
  </>
);

// ─── PAGE: CONTACT ───
const ContactPage = ({ onNavigate }) => (
  <>
    <section style={{ background: `linear-gradient(180deg, ${S.dark} 45%, ${S.mid} 85%, ${S.accent} 100%)`, padding: '160px 48px 80px', minHeight: '40vh', display: 'flex', alignItems: 'center' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ fontSize: 48, fontWeight: 500, color: 'white', lineHeight: 1.1 }}>Talk to our team</h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 18, lineHeight: 1.6, marginTop: 16 }}>Whether you're looking to allocate at scale, bring YLDS to your chain, or explore integration — we'll connect you with the right people.</p>
      </div>
    </section>

    <Section style={{ padding: '80px 48px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div><label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>First name</label><input style={{ width: '100%', padding: '12px 16px', border: `1px solid ${S.border}`, borderRadius: 10, fontSize: 14, background: S.lightBg }} placeholder="Jane" /></div>
            <div><label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Last name</label><input style={{ width: '100%', padding: '12px 16px', border: `1px solid ${S.border}`, borderRadius: 10, fontSize: 14, background: S.lightBg }} placeholder="Smith" /></div>
          </div>
          <div><label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Email</label><input style={{ width: '100%', padding: '12px 16px', border: `1px solid ${S.border}`, borderRadius: 10, fontSize: 14, background: S.lightBg }} placeholder="jane@example.com" /></div>
          <div><label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Organization</label><input style={{ width: '100%', padding: '12px 16px', border: `1px solid ${S.border}`, borderRadius: 10, fontSize: 14, background: S.lightBg }} placeholder="Acme Protocol" /></div>
          <div><label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>I'm interested in</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['Treasury allocation — purchasing YLDS at scale','Ecosystem integration — bringing YLDS or wYLDS to my chain','Protocol integration — using YLDS/wYLDS in DeFi, lending, or vaults','Payments & settlement — using YLDS for cross-border or B2B flows','Something else'].map((label,i)=><label key={i} style={{display:'flex',alignItems:'center',gap:10,fontSize:14,cursor:'pointer'}}><input type="checkbox" style={{width:18,height:18,accentColor:S.purple}} />{label}</label>)}
            </div>
          </div>
          <div><label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Estimated volume</label>
            <select style={{ width: '100%', padding: '12px 16px', border: `1px solid ${S.border}`, borderRadius: 10, fontSize: 14, background: S.lightBg, cursor: 'pointer' }}>
              <option>Select a range</option>
              <option>Under $100K</option>
              <option>$100K – $1M</option>
              <option>$1M – $10M</option>
              <option>$10M+</option>
              <option>Not sure yet</option>
            </select>
          </div>
          <div><label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Tell us more</label><textarea style={{ width: '100%', padding: '12px 16px', border: `1px solid ${S.border}`, borderRadius: 10, fontSize: 14, background: S.lightBg, minHeight: 100, resize: 'vertical', fontFamily: 'inherit' }} placeholder="What are you building or looking to do with YLDS?" ></textarea></div>
          <div style={{ textAlign: 'center', marginTop: 12 }}><Pill variant="purple" style={{ padding: '16px 48px', fontSize: 16 }}>Submit</Pill></div>
        </div>
        <p style={{ color: S.lightGray, fontSize: 12, marginTop: 24, textAlign: 'center' }}>For self-serve purchases, <a style={{ color: S.purple, fontWeight: 600, cursor: 'pointer' }}>get YLDS directly →</a></p>
      </div>
    </Section>

    <Footer hasHastra={false} onNavigate={onNavigate} />
  </>
);

// ─── MAIN APP ───
export default function YLDSPage() {
  const [page, setPage] = useState(0);
  const Page = [HomePage, CryptoPage, InstitutionsPage, DevelopersPage, ContactPage][page];

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif", color: S.dark }}>
      {/* Page switcher */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200, background: 'rgba(26,23,82,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 4, padding: '10px 24px' }}>
          {pages.map((p, i) => (
            <button key={i} onClick={() => setPage(i)} style={{ padding: '7px 16px', borderRadius: 9999, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: page === i ? S.purple : 'transparent', color: page === i ? 'white' : 'rgba(255,255,255,0.5)', transition: '0.2s', whiteSpace: 'nowrap' }}>{p}</button>
          ))}
          <a href="https://app.ylds.io" target="_blank" rel="noopener noreferrer" style={{ marginLeft: 'auto', padding: '8px 20px', borderRadius: 9999, fontSize: 13, fontWeight: 700, background: S.purple, color: 'white', textDecoration: 'none', whiteSpace: 'nowrap', transition: '0.2s' }}>Get YLDS</a>
        </div>
      </div>
      <div style={{ paddingTop: 52 }}><Page onNavigate={(i) => { setPage(i); window.scrollTo(0, 0); }} /></div>
    </div>
  );
}
