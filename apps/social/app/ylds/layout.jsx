export const metadata = {
  title: 'YLDS — Registered Digital Asset | Figure',
  description: 'YLDS is a registered fixed-income security that accrues ~4% daily yield (variable, SOFR-based), maintains a $1.00 NAV, and transfers peer-to-peer on-chain.',
};

export default function YLDSLayout({ children }) {
  return (
    <div style={{ margin: 0, padding: 0 }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      {children}
    </div>
  );
}
