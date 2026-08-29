import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { emailQueue } from '../queues/emailQueue';
import { indexEmail, esClient, INDEX_NAME } from '../services/elasticService';

const router = Router();
const prisma = new PrismaClient();

// Helper to create / retrieve a sender for easy testing
router.post('/senders', async (req: Request, res: Response) => {
  const { email, name } = req.body;

  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  try {
    const sender = await prisma.sender.upsert({
      where: { email },
      update: { name },
      create: { email, name },
    });
    res.status(201).json(sender);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET all senders
router.get('/senders', async (req: Request, res: Response) => {
  try {
    const senders = await prisma.sender.findMany();
    res.json(senders);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET sender by email (auto-create if not found)
router.get('/senders/email/:email', async (req: Request, res: Response) => {
  const { email } = req.params;
  try {
    const sender = await prisma.sender.upsert({
      where: { email },
      update: {},
      create: { email, name: email.split('@')[0] },
    });
    res.json(sender);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/emails/schedule
router.post('/emails/schedule', async (req: Request, res: Response) => {
  const {
    subject,
    body,
    recipients,
    senderId,
    scheduledAt,
    delayBetweenEmailsMs = 0,
    hourlyLimit, // will be integrated in Phase 4 rate limiting
  } = req.body;

  // Validation
  if (!subject || !body || !recipients || !Array.isArray(recipients) || !senderId || !scheduledAt) {
    res.status(400).json({
      error: 'Missing required parameters: subject, body, recipients[], senderId, and scheduledAt are required.',
    });
    return;
  }

  try {
    // 1. Verify that the sender exists
    const sender = await prisma.sender.findUnique({
      where: { id: senderId },
    });
    if (!sender) {
      res.status(404).json({ error: `Sender with ID ${senderId} not found.` });
      return;
    }

    const scheduledDate = new Date(scheduledAt);
    const now = Date.now();
    const scheduledJobs = [];

    // 2. Iterate and schedule for each recipient
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i].trim();
      if (!recipient) continue;

      // Compute specific run time for this recipient based on delayBetweenEmailsMs
      const targetTime = new Date(scheduledDate.getTime() + i * delayBetweenEmailsMs);
      const delay = Math.max(0, targetTime.getTime() - now);

      // Create email record in Postgres (default status: SCHEDULED)
      const emailRecord = await prisma.email.create({
        data: {
          status: 'SCHEDULED',
          subject,
          body,
          recipient,
          senderId,
          scheduledAt: targetTime,
        },
      });

      // Index email on write (immediately upon creation)
      await indexEmail(emailRecord);

      // DETERMINISTIC JOB ID FOR IDEMPOTENCY:
      // We use the database record ID combined with the target time.
      // This guarantees idempotency for a specific scheduled run, while
      // allowing us to easily reschedule the email to a new timestamp
      // without running into Redis job active lock conflicts.
      const jobId = `${emailRecord.id}:${targetTime.getTime()}`;

      const job = await emailQueue.add(
        'send-scheduled-email',
        { 
          emailId: emailRecord.id,
          hourlyLimit: hourlyLimit ? parseInt(hourlyLimit) : undefined
        },
        {
          delay,
          jobId, // Set the structured deterministic jobId
        }
      );

      // Save the job association back to PostgreSQL
      const updatedRecord = await prisma.email.update({
        where: { id: emailRecord.id },
        data: { jobId: job.id },
      });

      scheduledJobs.push({
        emailId: updatedRecord.id,
        jobId: updatedRecord.jobId,
        recipient: updatedRecord.recipient,
        scheduledAt: updatedRecord.scheduledAt,
      });
    }

    res.status(202).json({
      message: `Successfully scheduled ${scheduledJobs.length} email jobs.`,
      jobs: scheduledJobs,
    });

  } catch (err: any) {
    console.error('❌ Error scheduling emails:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET all emails (for validation/monitoring)
router.get('/emails', async (req: Request, res: Response) => {
  try {
    const emails = await prisma.email.findMany({
      orderBy: { createdAt: 'desc' },
      include: { sender: true },
    });
    res.json(emails);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/emails/search
router.get('/emails/search', async (req: Request, res: Response) => {
  const { q } = req.query;

  if (!q) {
    res.status(400).json({ error: 'Query parameter q is required.' });
    return;
  }

  try {
    console.log(`🔍 Querying Elasticsearch for term: "${q}"`);
    const result = await esClient.search({
      index: INDEX_NAME,
      body: {
        query: {
          multi_match: {
            query: q as string,
            fields: ['subject', 'body', 'recipient', 'status'],
            fuzziness: 'AUTO',
          },
        },
      },
    });

    // Map and return documents
    const hits = result.hits.hits.map((hit: any) => hit._source);
    res.json(hits);
  } catch (err: any) {
    console.error('❌ Elasticsearch search error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
