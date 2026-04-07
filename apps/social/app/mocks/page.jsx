import Link from 'next/link';

export default function MocksIndex() {
  const cards = [
    { href: '/mocks/wireframe', title: 'YLDS Wireframe', desc: 'Full interactive wireframe — Homepage, For Crypto, For Institutions, Developers & Ecosystems, Contact. All 5 pages with tab navigation.', tag: 'Interactive' },
    { href: '/mocks/personas', title: 'Persona Research Briefs', desc: '4 deep-dive research briefs — Crypto Treasury Manager, DeFi Protocol / Stellar, Digitally Forward Bank, Payment / Payroll / Cross-Border.', tag: '4 Briefs' },
    { href: '/mocks/strategy', title: 'Website Strategy', desc: 'Complete YLDS website upgrade strategy — information architecture, messaging framework, persona routing, compliance guidelines.', tag: 'Strategy' },
    { href: '/mocks/competitive', title: 'Circle / USDC Teardown', desc: 'Competitive analysis of Circle.com — what they do well, where YLDS can win, and priority actions for the site rebuild.', tag: 'Competitive' },
  ];

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif", background: '#F8F8FF', minHeight: '100vh' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '80px 48px' }}>
        <h1 style={{ fontSize: 36, fontWeight: 500, color: '#262364', marginBottom: 8 }}>YLDS Website Mocks</h1>
        <p style={{ fontSize: 16, color: '#6B6B9B', marginBottom: 48 }}>Internal reference for the YLDS.com site rebuild. Strategy, personas, competitive intel, and the full interactive wireframe.</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {cards.map((card) => (
            <Link key={card.href} href={card.href} style={{ textDecoration: 'none' }}>
              <div style={{
                background: 'white', border: '1px solid #E8E8F0', borderRadius: 16, padding: 28,
                transition: '0.2s', cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#5B56F5', background: '#F0EFFF', padding: '3px 10px', borderRadius: 6 }}>{card.tag}</span>
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#262364', marginBottom: 6 }}>{card.title}</h2>
                <p style={{ fontSize: 14, color: '#6B6B9B', lineHeight: 1.6 }}>{card.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
