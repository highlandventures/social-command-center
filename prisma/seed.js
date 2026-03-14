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
  // 2. Social accounts — X (Twitter)
  // ------------------------------------------------------------------
  const xAccount1 = await prisma.account.upsert({
    where: {
      platform_platformUserId: {
        platform: 'X',
        platformUserId: 'x_highland_vc_id',
      },
    },
    update: {},
    create: {
      platform: 'X',
      platformUserId: 'x_highland_vc_id',
      username: 'highland_vc',
      displayName: 'Highland Ventures',
      accessToken: 'placeholder_encrypted_access_token_highland_vc',
      refreshToken: 'placeholder_encrypted_refresh_token_highland_vc',
    },
  });
  console.log(`  Created X account: @${xAccount1.username}`);

  const xAccount2 = await prisma.account.upsert({
    where: {
      platform_platformUserId: {
        platform: 'X',
        platformUserId: 'x_highland_official_id',
      },
    },
    update: {},
    create: {
      platform: 'X',
      platformUserId: 'x_highland_official_id',
      username: 'highland_official',
      displayName: 'Highland Official',
      accessToken: 'placeholder_encrypted_access_token_highland_official',
      refreshToken: 'placeholder_encrypted_refresh_token_highland_official',
    },
  });
  console.log(`  Created X account: @${xAccount2.username}`);

  // ------------------------------------------------------------------
  // 3. Social account — Reddit
  // ------------------------------------------------------------------
  const redditAccount = await prisma.account.upsert({
    where: {
      platform_platformUserId: {
        platform: 'REDDIT',
        platformUserId: 'reddit_highland_ventures_id',
      },
    },
    update: {},
    create: {
      platform: 'REDDIT',
      platformUserId: 'reddit_highland_ventures_id',
      username: 'highland_ventures',
      displayName: 'Highland Ventures',
      accessToken: 'placeholder_encrypted_access_token_reddit',
      refreshToken: 'placeholder_encrypted_refresh_token_reddit',
    },
  });
  console.log(`  Created Reddit account: u/${redditAccount.username}`);

  // ------------------------------------------------------------------
  // 4. Grant the admin access to all accounts
  // ------------------------------------------------------------------
  for (const account of [xAccount1, xAccount2, redditAccount]) {
    await prisma.userAccountAccess.upsert({
      where: {
        userId_accountId: {
          userId: admin.id,
          accountId: account.id,
        },
      },
      update: {},
      create: {
        userId: admin.id,
        accountId: account.id,
      },
    });
  }
  console.log('  Granted admin access to all accounts');

  // ------------------------------------------------------------------
  // 5. Sample posts with different statuses
  // ------------------------------------------------------------------
  const post1 = await prisma.post.create({
    data: {
      accountId: xAccount1.id,
      platform: 'X',
      content:
        'Excited to announce our latest portfolio addition! More details coming soon. #VentureCapital #Web3',
      contentType: 'POST',
      status: 'DRAFT',
      createdById: admin.id,
    },
  });
  console.log(`  Created post (DRAFT): ${post1.id}`);

  const scheduledDate = new Date();
  scheduledDate.setDate(scheduledDate.getDate() + 2);
  scheduledDate.setHours(14, 0, 0, 0);

  const post2 = await prisma.post.create({
    data: {
      accountId: xAccount1.id,
      platform: 'X',
      content:
        'The future of decentralized infrastructure is being built right now. Here is what we are watching closely this quarter.',
      contentType: 'POST',
      status: 'SCHEDULED',
      scheduledFor: scheduledDate,
      createdById: admin.id,
    },
  });
  console.log(`  Created post (SCHEDULED): ${post2.id}`);

  const publishedDate = new Date();
  publishedDate.setDate(publishedDate.getDate() - 3);

  const post3 = await prisma.post.create({
    data: {
      accountId: xAccount2.id,
      platform: 'X',
      content:
        'Great conversations at the crypto summit today. The builder energy is incredible. Looking forward to sharing our takeaways.',
      contentType: 'POST',
      status: 'PUBLISHED',
      platformPostId: 'x_post_placeholder_123',
      publishedAt: publishedDate,
      createdById: admin.id,
    },
  });
  console.log(`  Created post (PUBLISHED): ${post3.id}`);

  const post4 = await prisma.post.create({
    data: {
      accountId: redditAccount.id,
      platform: 'REDDIT',
      content:
        'We have been researching L2 scaling solutions and wanted to share our analysis with the community. What are your thoughts on the current landscape?',
      contentType: 'POST',
      status: 'DRAFT',
      subreddit: 'r/ethereum',
      createdById: admin.id,
    },
  });
  console.log(`  Created post (DRAFT / Reddit): ${post4.id}`);

  const post5 = await prisma.post.create({
    data: {
      accountId: redditAccount.id,
      platform: 'REDDIT',
      content:
        'Our take on the recent DeFi governance proposals and why community voting matters more than ever.',
      contentType: 'POST',
      status: 'PUBLISHED',
      subreddit: 'r/defi',
      platformPostId: 'reddit_post_placeholder_456',
      publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      createdById: admin.id,
    },
  });
  console.log(`  Created post (PUBLISHED / Reddit): ${post5.id}`);

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
