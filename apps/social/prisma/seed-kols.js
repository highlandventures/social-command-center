/**
 * Seed script: Add Figure-relevant KOLs to the database.
 * Run with: node prisma/seed-kols.js
 *
 * Creates three cohorts and seeds KOLs into each:
 *   1. FIGR Analysts  — original organic advocates who cover FIGR
 *   2. KOLs           — key opinion leaders in the RWA / crypto space
 *   3. Adhoc KOLs     — additional influencers for opportunistic tracking
 *
 * Requires POSTGRES_PRISMA_URL to be set in environment.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ── Cohort definitions ──────────────────────────────────────

const cohorts = [
  { name: 'Figure Executives', description: 'Figure Technology Solutions leadership and company reps' },
  { name: 'FIGR Analysts', description: 'Organic advocates and analysts who regularly cover FIGR' },
  { name: 'KOLs', description: 'Key opinion leaders in the RWA and crypto space' },
  { name: 'Adhoc KOLs', description: 'Additional influencers for opportunistic tracking' },
];

// ── KOL definitions by cohort ───────────────────────────────

const kolsByCohort = {
  'Figure Executives': [
    { name: 'Mike Cagney',         username: 'mcagney',          relationshipType: 'COMPANY_EXEC' },
    { name: 'Michael Tannenbaum',  username: 'mbtannenbaum',     relationshipType: 'COMPANY_EXEC' },
  ],
  'FIGR Analysts': [
    { name: 'Covered Call',      username: 'covered_call',     relationshipType: 'RETAIL_ANALYST' },
    { name: 'Kross Roads',       username: 'Kross_Roads',      relationshipType: 'RETAIL_ANALYST' },
    { name: 'Nick Researcher',   username: 'Nick_Researcher',  relationshipType: 'RETAIL_ANALYST' },
    { name: 'TridentX Hodler',   username: 'tridentxhodler',   relationshipType: 'RETAIL_ANALYST' },
    { name: 'Dr Creeptic',       username: 'drcreeptic',       relationshipType: 'RETAIL_ANALYST' },
    { name: 'Aayush Trades',     username: 'aayushtrades',     relationshipType: 'RETAIL_ANALYST' },
    { name: 'MBarry',            username: 'Mbarry581',        relationshipType: 'RETAIL_ANALYST' },
    { name: 'Matthew Sigel',     username: 'matthew_sigel',    relationshipType: 'RETAIL_ANALYST' },
    { name: 'Manish Dutta',      username: 'dutta_manish',     relationshipType: 'RETAIL_ANALYST' },
    { name: 'Rex Salisbury',     username: 'rexsalisbury',     relationshipType: 'RETAIL_ANALYST' },
    { name: 'Mega Fund',         username: 'Mega_Fund',        relationshipType: 'RETAIL_ANALYST' },
    { name: 'Crenmy',            username: 'Crenmy1',          relationshipType: 'RETAIL_ANALYST' },
    { name: 'Manisha',           username: 'Manisha_kh',       relationshipType: 'RETAIL_ANALYST' },
    { name: 'Cosmonaut Stakes',  username: 'CosmonautStakes',  relationshipType: 'RETAIL_ANALYST' },
    { name: 'Bielzinn',          username: 'bielzinn',         relationshipType: 'RETAIL_ANALYST' },
  ],
  'KOLs': [
    { name: 'Rektonomist',       username: 'rektonomist_',     relationshipType: 'PAID_PARTNER' },
    { name: 'Tanaka L2',         username: 'Tanaka_L2',        relationshipType: 'PAID_PARTNER' },
    { name: 'Zeus RWA',          username: 'ZeusRWA',          relationshipType: 'PAID_PARTNER' },
    { name: 'Sol Nxxn',          username: 'sol_nxxn',         relationshipType: 'PAID_PARTNER' },
  ],
  'Adhoc KOLs': [
    { name: 'Altcoin Daily',     username: 'AltcoinDaily',     relationshipType: 'ORGANIC_ADVOCATE' },
    { name: '3orovik',           username: '3orovik',          relationshipType: 'ORGANIC_ADVOCATE' },
    { name: 'RWA Watchlist',     username: 'RWAwatchlist_',    relationshipType: 'ORGANIC_ADVOCATE' },
    { name: 'Crypto Rover',      username: 'cryptorover',      relationshipType: 'ORGANIC_ADVOCATE' },
    { name: 'Phteven Strong',    username: 'phtevenstrong',    relationshipType: 'ORGANIC_ADVOCATE' },
  ],
};

async function main() {
  // Get or create an admin user to set as addedBy
  let admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) {
    admin = await prisma.user.findFirst();
  }
  if (!admin) {
    console.error('No users found in database. Sign in first to create a user.');
    process.exit(1);
  }

  console.log(`Using admin user: ${admin.email} (${admin.id})`);

  // ── 1. Upsert cohorts ──────────────────────────────────────
  const cohortMap = {};
  for (const cohort of cohorts) {
    let existing = await prisma.kOLCohort.findFirst({
      where: { name: cohort.name },
    });

    if (!existing) {
      existing = await prisma.kOLCohort.create({
        data: {
          name: cohort.name,
          description: cohort.description,
          createdBy: admin.id,
        },
      });
      console.log(`  Created cohort: ${cohort.name}`);
    } else {
      console.log(`  Cohort exists: ${cohort.name}`);
    }
    cohortMap[cohort.name] = existing.id;
  }

  // ── 2. Seed KOLs per cohort ─────────────────────────────────
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const [cohortName, kols] of Object.entries(kolsByCohort)) {
    const cohortId = cohortMap[cohortName];
    console.log(`\n── ${cohortName} (${kols.length} KOLs) ──`);

    for (const kol of kols) {
      const existing = await prisma.kOL.findFirst({
        where: { username: kol.username, platform: 'X' },
      });

      if (existing) {
        // Update cohort and relationship type if changed
        const needsUpdate =
          existing.cohortId !== cohortId ||
          existing.relationshipType !== kol.relationshipType;
        if (needsUpdate) {
          await prisma.kOL.update({
            where: { id: existing.id },
            data: { cohortId, relationshipType: kol.relationshipType },
          });
          console.log(`  Updated: @${kol.username} → ${cohortName} (${kol.relationshipType})`);
          updated++;
        } else {
          console.log(`  Skip (exists): @${kol.username}`);
          skipped++;
        }
        continue;
      }

      await prisma.kOL.create({
        data: {
          name: kol.name,
          platform: 'X',
          username: kol.username,
          relationshipType: kol.relationshipType,
          cohortId,
          addedBy: admin.id,
          active: true,
        },
      });

      console.log(`  Added: @${kol.username} (${kol.name})`);
      added++;
    }
  }

  console.log(`\nDone. Added: ${added}, Updated cohort: ${updated}, Skipped: ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
