/**
 * Seed script: Add Figure-relevant KOLs to the database.
 * Run with: node prisma/seed-kols.js
 *
 * Requires POSTGRES_PRISMA_URL to be set in environment.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const kols = [
  { name: 'Covered Call',      username: 'covered_call',     relationshipType: 'ORGANIC_ADVOCATE' },
  { name: 'Kross Roads',       username: 'Kross_Roads',      relationshipType: 'ORGANIC_ADVOCATE' },
  { name: 'Nick Researcher',   username: 'Nick_Researcher',  relationshipType: 'ORGANIC_ADVOCATE' },
  { name: 'TridentX Hodler',   username: 'tridentxhodler',   relationshipType: 'ORGANIC_ADVOCATE' },
  { name: 'Dr Creeptic',       username: 'drcreeptic',       relationshipType: 'ORGANIC_ADVOCATE' },
  { name: 'Aayush Trades',     username: 'aayushtrades',     relationshipType: 'ORGANIC_ADVOCATE' },
  { name: 'MBarry',            username: 'Mbarry581',        relationshipType: 'ORGANIC_ADVOCATE' },
  { name: 'Matthew Sigel',     username: 'matthew_sigel',    relationshipType: 'ORGANIC_ADVOCATE' },
  { name: 'Manish Dutta',      username: 'dutta_manish',     relationshipType: 'ORGANIC_ADVOCATE' },
  { name: 'Rex Salisbury',     username: 'rexsalisbury',     relationshipType: 'ORGANIC_ADVOCATE' },
  { name: 'Mega Fund',         username: 'Mega_Fund',        relationshipType: 'ORGANIC_ADVOCATE' },
  { name: 'Crenmy',            username: 'Crenmy1',          relationshipType: 'ORGANIC_ADVOCATE' },
  { name: 'Manisha',           username: 'Manisha_kh',       relationshipType: 'ORGANIC_ADVOCATE' },
  { name: 'Cosmonaut Stakes',  username: 'CosmonautStakes',  relationshipType: 'ORGANIC_ADVOCATE' },
  { name: 'Bielzinn',          username: 'bielzinn',         relationshipType: 'ORGANIC_ADVOCATE' },
];

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

  let added = 0;
  let skipped = 0;

  for (const kol of kols) {
    // Check if this KOL already exists (by username + platform)
    const existing = await prisma.kOL.findFirst({
      where: { username: kol.username, platform: 'X' },
    });

    if (existing) {
      console.log(`  Skip (exists): @${kol.username}`);
      skipped++;
      continue;
    }

    await prisma.kOL.create({
      data: {
        name: kol.name,
        platform: 'X',
        username: kol.username,
        relationshipType: kol.relationshipType,
        addedBy: admin.id,
        active: true,
      },
    });

    console.log(`  Added: @${kol.username} (${kol.name})`);
    added++;
  }

  console.log(`\nDone. Added: ${added}, Skipped: ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
