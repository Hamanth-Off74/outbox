import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { redisConnection, emailQueue } from '../queues/emailQueue';
import { getMailTransporter } from '../services/mailService';
import { indexEmail } from '../services/elasticService';
import { env } from '../config/env';

const prisma = new PrismaClient();

export const emailWorker = new Worker(
  'email-queue',
  async (job: Job) => {
    const { emailId, hourlyLimit } = job.data;
    console.log(`👷 Worker processing email job ${job.id} for email record ${emailId}`);

    // 1. Retrieve the email from the database
    const email = await prisma.email.findUnique({
      where: { id: emailId },
      include: { sender: true },
    });

    if (!email) {
      console.warn(`⚠️ Email record ${emailId} not found in database. Skipping.`);
      return;
    }

    if (email.status !== 'SCHEDULED') {
      console.log(`ℹ️ Email ${emailId} is already in state: ${email.status}. Skipping.`);
      return;
    }

    // --- HOURLY RATE LIMIT CHECK ---
    const limit = hourlyLimit || env.MAX_EMAILS_PER_HOUR_PER_SENDER;
    const currentHourWindow = new Date().toISOString().substring(0, 13); // format: "YYYY-MM-DDTHH"
    const redisKey = `ratelimit:${email.senderId}:${currentHourWindow}`;

    // Atomically increment the send counter for this hour window
    const count = await redisConnection.incr(redisKey);
    if (count === 1) {
      await redisConnection.expire(redisKey, 3600); // 1 hour TTL
    }

    if (count > limit) {
      // Decrement the counter back so we don't skew the rate limit count
      await redisConnection.decr(redisKey);

      console.log(`⚠️ Rate limit hit for sender ${email.senderId} (${count}/${limit} emails). Rescheduling email ${emailId}...`);

      // Shifting by exactly 1 hour preserves the relative order and delay spacing
      const nextSendTime = new Date(email.scheduledAt.getTime() + 3600 * 1000);
      const nextDelay = Math.max(0, nextSendTime.getTime() - Date.now());
      const nextJobId = `${emailId}:${nextSendTime.getTime()}`;

      // Update the planned scheduledAt and the jobId in PostgreSQL
      await prisma.email.update({
        where: { id: emailId },
        data: {
          scheduledAt: nextSendTime,
          jobId: nextJobId,
        },
      });

      // Re-enqueue the job with the new delay and nextJobId
      await emailQueue.add(
        'send-scheduled-email',
        { emailId, hourlyLimit },
        {
          delay: nextDelay,
          jobId: nextJobId,
        }
      );

      console.log(`✅ Email ${emailId} rescheduled to run at ${nextSendTime.toISOString()} (delay: ${nextDelay}ms) with JobID: ${nextJobId}`);

      // --- TRIGGER SLACK NOTIFICATION ON RATE LIMIT HIT ---
      try {
        const slackIntegration = await prisma.slackIntegration.findUnique({
          where: { tenantId: email.senderId },
        });

        if (slackIntegration && slackIntegration.webhookUrl) {
          console.log(`💬 Sending Slack rate limit alert for sender ${email.senderId}...`);
          const alertMessage = {
            text: `⚠️ *Rate Limit Alert* for sender *${email.sender.name || email.sender.email}*:\n` +
                  `Hourly sending limit of *${limit}* emails was reached.\n` +
                  `Email to *${email.recipient}* has been postponed to the next hour window: *${nextSendTime.toLocaleTimeString()}*.`
          };

          const slackResponse = await fetch(slackIntegration.webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(alertMessage),
          });

          if (slackResponse.ok) {
            console.log(`✅ Slack notification sent successfully for sender ${email.senderId}`);
          } else {
            console.warn(`⚠️ Slack webhook returned status ${slackResponse.status}`);
          }
        }
      } catch (slackErr: any) {
        console.error('❌ Failed to send Slack notification:', slackErr.message);
        // Skip silently, do not fail the core email queue job
      }

      return; // Return early, bypassing send and database update to SENT
    }

    try {
      // 2. Fetch the mail transporter
      const transporter = await getMailTransporter();

      // 3. Send the email
      console.log(`📨 Sending email to ${email.recipient}...`);
      const info = await transporter.sendMail({
        from: `"${email.sender.name || 'Outbox Sender'}" <${email.sender.email}>`,
        to: email.recipient,
        subject: email.subject,
        text: email.body,
        html: `<p>${email.body.replace(/\n/g, '<br>')}</p>`,
      });

      console.log(`✅ Email sent successfully! MessageId: ${info.messageId}`);
      
      // In Ethereal, we get a URL to view the message:
      const testUrl = getTestMessageUrl(info);
      if (testUrl) {
        console.log(`🔗 Preview URL: ${testUrl}`);
      }

      // 4. Update status in Database
      const updatedEmail = await prisma.email.update({
        where: { id: emailId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          etherealUrl: testUrl || null,
        },
      });

      // 5. Index into Elasticsearch
      await indexEmail(updatedEmail);

    } catch (err: any) {
      console.error(`❌ Error sending email ${emailId}:`, err);

      // Update DB to failed status
      const updatedEmail = await prisma.email.update({
        where: { id: emailId },
        data: {
          status: 'FAILED',
          error: err.message,
        },
      });

      // Index failed state into Elasticsearch
      await indexEmail(updatedEmail);

      throw err; // bubble up error to let BullMQ track retry count
    }
  },
  {
    connection: redisConnection,
    concurrency: env.WORKER_CONCURRENCY,
  }
);

// Helper to extract Ethereal preview URL
const getTestMessageUrl = (info: any): string | false => {
  const nodemailer = require('nodemailer');
  return nodemailer.getTestMessageUrl(info);
};

console.log(`👷 BullMQ Worker initialized with concurrency ${env.WORKER_CONCURRENCY}.`);
export default emailWorker;
