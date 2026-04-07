const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ------------------------------------------------------------------
  // 1. Admin user
  // ------------------------------------------------------------------
  const admin = await prisma.user.upsert({
    where: { email: 'miso@highlandventures.io' },
    update: {},
    create: {
      email: 'miso@highlandventures.io',
      name: 'Michelle So',
      role: 'ADMIN',
    },
  });
  console.log(`  Created admin user: ${admin.email} (${admin.id})`);

  // ------------------------------------------------------------------
  // 2. GTM Projects
  // ------------------------------------------------------------------
  console.log('\n  Seeding GTM Projects...');

  const now = new Date();
  const d = (offsetDays) => {
    const dt = new Date(now);
    dt.setDate(dt.getDate() + offsetDays);
    return dt;
  };

  // --- Project 1: Figure Pay Launch ---
  const proj1 = await prisma.gtmProject.create({
    data: {
      name: 'Figure Pay Launch',
      description: 'Full GTM launch for Figure Pay consumer mobile app — app store launch, press, influencer activations, and paid media blitz.',
      category: 'GTM',
      status: 'ACTIVE',
      healthStatus: 'ON_TRACK',
      ownerId: admin.id,
      startDate: d(-14),
      endDate: d(45),
    },
  });
  console.log(`  Created GTM project: ${proj1.name}`);

  // Tasks for Project 1
  const proj1Tasks = [
    { title: 'Finalize launch press release', status: 'DONE', priority: 'HIGH', dueDate: d(-5) },
    { title: 'Brief KOL partners on launch messaging', status: 'DONE', priority: 'HIGH', dueDate: d(-3) },
    { title: 'Publish App Store listing copy', status: 'IN_PROGRESS', priority: 'HIGH', dueDate: d(2) },
    { title: 'Launch paid social campaign (Meta + X)', status: 'TODO', priority: 'HIGH', dueDate: d(7) },
    { title: 'Schedule launch day X thread', status: 'TODO', priority: 'MEDIUM', dueDate: d(6) },
    { title: 'Post-launch performance report', status: 'TODO', priority: 'MEDIUM', dueDate: d(14) },
  ];
  for (const t of proj1Tasks) {
    await prisma.gtmTask.create({
      data: { projectId: proj1.id, ownerId: admin.id, ...t },
    });
  }
  console.log(`    ${proj1Tasks.length} tasks`);

  // Moments for Project 1
  const fpLaunchMoment = await prisma.gtmMoment.create({
    data: { projectId: proj1.id, label: 'Figure Pay Launch Week', type: 'LAUNCH', startDate: d(5), endDate: d(12) },
  });
  await prisma.gtmMoment.createMany({
    data: [
      { projectId: proj1.id, parentMomentId: fpLaunchMoment.id, label: 'Press embargo lifts', type: 'MILESTONE', date: d(5) },
      { projectId: proj1.id, parentMomentId: fpLaunchMoment.id, label: 'KOL posts go live', type: 'ACTIVATION', date: d(6) },
      { projectId: proj1.id, parentMomentId: fpLaunchMoment.id, label: 'Paid media flight begins', type: 'CAMPAIGN', date: d(7) },
      { projectId: proj1.id, parentMomentId: fpLaunchMoment.id, label: 'Founder AMA on X Spaces', type: 'ACTIVATION', date: d(9) },
    ],
  });
  console.log('    5 moments (1 parent + 4 children)');

  // --- Project 2: Consensus 2026 ---
  const proj2 = await prisma.gtmProject.create({
    data: {
      name: 'Consensus 2026',
      description: 'End-to-end event marketing for Consensus 2026 — booth, side events, speaking slots, content capture, and post-event follow-up.',
      category: 'GTM',
      status: 'PLANNING',
      healthStatus: 'ON_TRACK',
      ownerId: admin.id,
      startDate: d(30),
      endDate: d(75),
    },
  });
  console.log(`  Created GTM project: ${proj2.name}`);

  const proj2Tasks = [
    { title: 'Confirm speaking slot and panel topic', status: 'IN_PROGRESS', priority: 'HIGH', dueDate: d(10) },
    { title: 'Design booth creative and order materials', status: 'TODO', priority: 'HIGH', dueDate: d(20) },
    { title: 'Plan side event (rooftop mixer)', status: 'TODO', priority: 'MEDIUM', dueDate: d(25) },
    { title: 'Pre-event social content calendar', status: 'TODO', priority: 'MEDIUM', dueDate: d(28) },
    { title: 'Book video crew for content capture', status: 'TODO', priority: 'LOW', dueDate: d(30) },
  ];
  for (const t of proj2Tasks) {
    await prisma.gtmTask.create({
      data: { projectId: proj2.id, ownerId: admin.id, ...t },
    });
  }
  console.log(`    ${proj2Tasks.length} tasks`);

  const consensusMoment = await prisma.gtmMoment.create({
    data: { projectId: proj2.id, label: 'Consensus 2026 Event', type: 'EVENT', startDate: d(55), endDate: d(58) },
  });
  await prisma.gtmMoment.createMany({
    data: [
      { projectId: proj2.id, parentMomentId: consensusMoment.id, label: 'CEO keynote panel', type: 'ACTIVATION', date: d(55) },
      { projectId: proj2.id, parentMomentId: consensusMoment.id, label: 'Rooftop side event', type: 'ACTIVATION', date: d(56) },
      { projectId: proj2.id, parentMomentId: consensusMoment.id, label: 'Post-event recap thread', type: 'ACTIVATION', date: d(59) },
    ],
  });
  console.log('    4 moments (1 parent + 3 children)');

  // --- Project 3: Q2 Brand Campaign ---
  const proj3 = await prisma.gtmProject.create({
    data: {
      name: 'Q2 Brand Campaign',
      description: 'Always-on brand awareness campaign across X and Reddit — thought leadership threads, community engagement, and paid amplification.',
      category: 'EVERGREEN',
      status: 'ACTIVE',
      healthStatus: 'AT_RISK',
      ownerId: admin.id,
      startDate: d(-30),
      endDate: d(60),
    },
  });
  console.log(`  Created GTM project: ${proj3.name}`);

  const proj3Tasks = [
    { title: 'Draft Q2 messaging framework', status: 'DONE', priority: 'HIGH', dueDate: d(-25) },
    { title: 'Publish thought leadership thread #1', status: 'DONE', priority: 'MEDIUM', dueDate: d(-15) },
    { title: 'Publish thought leadership thread #2', status: 'IN_PROGRESS', priority: 'MEDIUM', dueDate: d(-1) },
    { title: 'Reddit AMA in r/fintech', status: 'TODO', priority: 'HIGH', dueDate: d(10) },
    { title: 'Mid-campaign performance review', status: 'TODO', priority: 'MEDIUM', dueDate: d(15) },
  ];
  for (const t of proj3Tasks) {
    await prisma.gtmTask.create({
      data: { projectId: proj3.id, ownerId: admin.id, ...t },
    });
  }
  console.log(`    ${proj3Tasks.length} tasks`);

  await prisma.gtmMoment.createMany({
    data: [
      { projectId: proj3.id, label: 'Q2 campaign kickoff', type: 'MILESTONE', date: d(-30) },
      { projectId: proj3.id, label: 'Reddit AMA day', type: 'ACTIVATION', date: d(10) },
      { projectId: proj3.id, label: 'Mid-campaign check-in', type: 'MILESTONE', date: d(15) },
      { projectId: proj3.id, label: 'Q2 campaign wrap', type: 'MILESTONE', date: d(60) },
    ],
  });
  console.log('    4 moments');

  // --- Project 4: YLDS Institutional Outreach ---
  const proj4 = await prisma.gtmProject.create({
    data: {
      name: 'YLDS Institutional Outreach',
      description: 'Targeted outreach to institutional investors and RIAs for YLDS — webinars, whitepapers, and compliance-approved collateral.',
      category: 'OPERATIONS',
      status: 'ACTIVE',
      healthStatus: 'ON_TRACK',
      ownerId: admin.id,
      startDate: d(-7),
      endDate: d(90),
    },
  });
  console.log(`  Created GTM project: ${proj4.name}`);

  const proj4Tasks = [
    { title: 'Finalize YLDS one-pager (compliance approved)', status: 'IN_PROGRESS', priority: 'HIGH', dueDate: d(3) },
    { title: 'Schedule webinar with RIA channel partners', status: 'TODO', priority: 'HIGH', dueDate: d(14) },
    { title: 'Publish YLDS explainer blog post', status: 'TODO', priority: 'MEDIUM', dueDate: d(10) },
    { title: 'Create LinkedIn ad campaign targeting RIAs', status: 'TODO', priority: 'MEDIUM', dueDate: d(20) },
  ];
  for (const t of proj4Tasks) {
    await prisma.gtmTask.create({
      data: { projectId: proj4.id, ownerId: admin.id, ...t },
    });
  }
  console.log(`    ${proj4Tasks.length} tasks`);

  await prisma.gtmMoment.createMany({
    data: [
      { projectId: proj4.id, label: 'YLDS webinar', type: 'EVENT', date: d(21) },
      { projectId: proj4.id, label: 'Whitepaper publish', type: 'MILESTONE', date: d(30) },
    ],
  });
  console.log('    2 moments');

  // ------------------------------------------------------------------
  // 7. GTM OKRs
  // ------------------------------------------------------------------
  console.log('\n  Seeding GTM OKRs...');

  const okr1 = await prisma.gtmOkr.create({
    data: {
      title: 'Drive awareness for Figure Pay launch',
      description: 'Maximize visibility and reach for the Figure Pay consumer launch through earned, owned, and paid channels.',
      quarter: 'Q2 2026',
    },
  });
  await prisma.gtmKeyResult.createMany({
    data: [
      { okrId: okr1.id, title: 'Total impressions', target: 50000000, current: 12000000, unit: 'count' },
      { okrId: okr1.id, title: 'Landing page visits', target: 500000, current: 89000, unit: 'count' },
      { okrId: okr1.id, title: 'Media placements', target: 15, current: 4, unit: 'count' },
    ],
  });
  console.log(`  Created OKR: ${okr1.title} (3 key results)`);

  const okr2 = await prisma.gtmOkr.create({
    data: {
      title: 'Grow social audience 25%',
      description: 'Expand follower base and engagement across X, Reddit, and LinkedIn through organic and KOL-driven content.',
      quarter: 'Q2 2026',
    },
  });
  await prisma.gtmKeyResult.createMany({
    data: [
      { okrId: okr2.id, title: 'Total followers', target: 150000, current: 118000, unit: 'count' },
      { okrId: okr2.id, title: 'Avg engagement rate', target: 3.5, current: 2.8, unit: 'percent' },
      { okrId: okr2.id, title: 'KOL activations', target: 50, current: 22, unit: 'count' },
    ],
  });
  console.log(`  Created OKR: ${okr2.title} (3 key results)`);

  const okr3 = await prisma.gtmOkr.create({
    data: {
      title: 'Establish thought leadership at Consensus',
      description: 'Secure speaking visibility, generate booth traffic, and capture qualified leads at Consensus 2026.',
      quarter: 'Q2 2026',
    },
  });
  await prisma.gtmKeyResult.createMany({
    data: [
      { okrId: okr3.id, title: 'Speaking slots', target: 3, current: 2, unit: 'count' },
      { okrId: okr3.id, title: 'Booth visits', target: 10000, current: 0, unit: 'count' },
      { okrId: okr3.id, title: 'Qualified leads', target: 200, current: 0, unit: 'count' },
    ],
  });
  console.log(`  Created OKR: ${okr3.title} (3 key results)`);

  // ------------------------------------------------------------------
  // 8. GTM Products
  // ------------------------------------------------------------------
  console.log('\n  Seeding GTM Products...');

  await prisma.gtmProduct.createMany({
    data: [
      {
        name: 'Figure Pay',
        description: 'Consumer payment platform enabling instant home equity access through a mobile app. Supports one-tap payments, merchant rewards, and real-time balance tracking.',
        positioning: 'For homeowners who want flexible payment options, Figure Pay is a digital payment platform that enables instant home equity access, unlike traditional lenders that take weeks to process.',
        messaging: 'Speed. Simplicity. Your home\'s value, unlocked.',
      },
      {
        name: 'Figure Lending',
        description: 'Home equity line of credit (HELOC) product offering fully digital origination, fast funding, and competitive rates. Blockchain-backed for transparency and efficiency.',
        positioning: 'For homeowners seeking fast access to home equity, Figure Lending provides a fully digital HELOC that funds in as few as 5 days.',
        messaging: 'The fastest way to tap your home equity.',
      },
      {
        name: 'Figure Technology Solutions',
        description: 'Blockchain infrastructure and capital markets technology powering loan origination, securitization, and trading for financial institutions.',
        positioning: 'For financial institutions modernizing their infrastructure, Figure Technology Solutions provides blockchain-based capital markets technology.',
        messaging: 'The future of capital markets, built on blockchain.',
      },
    ],
  });
  console.log('  Created 3 products: Figure Pay, Figure Lending, Figure Technology Solutions');

  console.log('\nSeed complete!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
