const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const BRAND_PURPLE = '#5B56F5';

function emailWrapper(title, bodyContent) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color:${BRAND_PURPLE};padding:24px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${title}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${bodyContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;background-color:#f9f9fb;text-align:center;font-size:12px;color:#888;">
              <p style="margin:0;">You received this email because you are subscribed to our mailing list.</p>
              <p style="margin:8px 0 0;"><a href="{{unsubscribeUrl}}" style="color:${BRAND_PURPLE};">Unsubscribe</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const starterTemplates = [
  {
    id: 'starter-newsletter',
    name: 'Weekly Newsletter',
    category: 'newsletter',
    subject: 'Your Weekly Digest - {{date}}',
    htmlBody: emailWrapper('Weekly Newsletter', `
              <p style="margin:0 0 16px;font-size:16px;color:#333;">Hi {{firstName}},</p>
              <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">Here is your weekly digest of the latest updates and insights.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="padding:16px;background-color:#f9f9fb;border-radius:6px;border-left:4px solid ${BRAND_PURPLE};">
                    <h3 style="margin:0 0 8px;font-size:16px;color:#333;">This Week's Highlights</h3>
                    <p style="margin:0;font-size:14px;color:#555;line-height:1.5;">Add your weekly content highlights here. Share key metrics, top posts, and important updates.</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:16px;background-color:#f9f9fb;border-radius:6px;border-left:4px solid ${BRAND_PURPLE};">
                    <h3 style="margin:0 0 8px;font-size:16px;color:#333;">Coming Up Next Week</h3>
                    <p style="margin:0;font-size:14px;color:#555;line-height:1.5;">Preview upcoming content, events, or milestones for the week ahead.</p>
                  </td>
                </tr>
              </table>
    `),
  },
  {
    id: 'starter-announcement',
    name: 'Announcement',
    category: 'announcement',
    subject: 'Important Announcement',
    htmlBody: emailWrapper('Announcement', `
              <div style="text-align:center;padding:16px 0 32px;">
                <h2 style="margin:0 0 16px;font-size:24px;color:#333;font-weight:700;">Big News!</h2>
                <p style="margin:0 0 24px;font-size:16px;color:#555;line-height:1.6;">We have an exciting announcement to share with you, {{firstName}}. Add your announcement details here.</p>
                <a href="{{ctaUrl}}" style="display:inline-block;padding:14px 32px;background-color:${BRAND_PURPLE};color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:600;">Learn More</a>
              </div>
    `),
  },
  {
    id: 'starter-product_update',
    name: 'Product Update',
    category: 'product_update',
    subject: 'New Features & Improvements',
    htmlBody: emailWrapper('Product Update', `
              <p style="margin:0 0 16px;font-size:16px;color:#333;">Hi {{firstName}},</p>
              <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">We have been working hard on new features and improvements. Here is what is new:</p>
              <!-- Feature Card 1 -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td style="padding:20px;background-color:#f9f9fb;border-radius:8px;">
                    <h3 style="margin:0 0 8px;font-size:16px;color:${BRAND_PURPLE};">Feature Highlight</h3>
                    <p style="margin:0 0 12px;font-size:14px;color:#555;line-height:1.5;">Describe the new feature and its benefits here.</p>
                    <div style="background-color:#e8e8ed;border-radius:4px;height:160px;display:flex;align-items:center;justify-content:center;">
                      <p style="margin:0;color:#888;font-size:13px;">Screenshot placeholder</p>
                    </div>
                  </td>
                </tr>
              </table>
              <!-- Feature Card 2 -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="padding:20px;background-color:#f9f9fb;border-radius:8px;">
                    <h3 style="margin:0 0 8px;font-size:16px;color:${BRAND_PURPLE};">Improvement</h3>
                    <p style="margin:0;font-size:14px;color:#555;line-height:1.5;">Describe performance improvements, bug fixes, or quality-of-life changes.</p>
                  </td>
                </tr>
              </table>
              <div style="text-align:center;">
                <a href="{{ctaUrl}}" style="display:inline-block;padding:14px 32px;background-color:${BRAND_PURPLE};color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:600;">See All Updates</a>
              </div>
    `),
  },
  {
    id: 'starter-event_invite',
    name: 'Event Invitation',
    category: 'event_invite',
    subject: 'You are Invited: {{eventName}}',
    htmlBody: emailWrapper('Event Invitation', `
              <div style="text-align:center;padding:8px 0 24px;">
                <p style="margin:0 0 8px;font-size:14px;color:#888;text-transform:uppercase;letter-spacing:1px;">You are Invited</p>
                <h2 style="margin:0 0 24px;font-size:26px;color:#333;font-weight:700;">{{eventName}}</h2>
              </div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="padding:20px;background-color:#f9f9fb;border-radius:8px;text-align:center;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                      <tr>
                        <td style="padding:8px 16px;font-size:14px;color:#555;">
                          <strong style="color:#333;">Date:</strong> {{date}}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 16px;font-size:14px;color:#555;">
                          <strong style="color:#333;">Time:</strong> {{time}}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 16px;font-size:14px;color:#555;">
                          <strong style="color:#333;">Location:</strong> {{location}}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;text-align:center;">Hi {{firstName}}, we would love to see you there. Please RSVP to secure your spot.</p>
              <div style="text-align:center;">
                <a href="{{rsvpUrl}}" style="display:inline-block;padding:14px 32px;background-color:${BRAND_PURPLE};color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:600;">RSVP Now</a>
              </div>
    `),
  },
];

async function seedTemplates() {
  console.log('Seeding email templates...');

  for (const template of starterTemplates) {
    await prisma.emailTemplate.upsert({
      where: { id: template.id },
      update: {
        name: template.name,
        subject: template.subject,
        htmlBody: template.htmlBody,
        category: template.category,
        isStarter: true,
      },
      create: {
        id: template.id,
        name: template.name,
        subject: template.subject,
        htmlBody: template.htmlBody,
        category: template.category,
        isStarter: true,
        createdById: 'system',
      },
    });
    console.log(`  Upserted: ${template.name} (${template.id})`);
  }

  console.log('Email template seeding complete.');
}

module.exports = { seedTemplates };

// Run directly: node prisma/seed-email-templates.js
if (require.main === module) {
  seedTemplates()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
