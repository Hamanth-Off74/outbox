import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Creating Ethereal account for backfilling...');
  const testAccount = await nodemailer.createTestAccount();
  const transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  const emails = await prisma.email.findMany({
    where: {
      status: 'SENT',
      etherealUrl: null,
    },
  });

  console.log(`Found ${emails.length} sent emails without Ethereal URLs. Generating preview links...`);

  for (const email of emails) {
    try {
      const info = await transporter.sendMail({
        from: `"Outbox System" <${testAccount.user}>`,
        to: email.recipient,
        subject: email.subject,
        text: email.body,
      });

      const testUrl = nodemailer.getTestMessageUrl(info);
      if (testUrl) {
        await prisma.email.update({
          where: { id: email.id },
          data: { etherealUrl: testUrl },
        });
        console.log(`✅ Backfilled email ${email.id} -> ${testUrl}`);
      }
    } catch (err: any) {
      console.error(`Failed to backfill email ${email.id}:`, err.message);
    }
  }

  console.log('🎉 Finished backfilling all sent emails with Ethereal preview links!');
}

main().catch(console.error);
