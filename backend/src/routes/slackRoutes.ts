import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

const router = Router();
const prisma = new PrismaClient();

// Redirect to Slack Authorize endpoint
// Expects a ?senderId query parameter to map the installation to the sender
router.get('/connect', (req: Request, res: Response) => {
  const { senderId } = req.query;

  if (!senderId) {
    res.status(400).send('Missing senderId query parameter. We need this to link your Slack workspace.');
    return;
  }

  const slackAuthUrl = `https://slack.com/oauth/v2/authorize` +
    `?client_id=${env.SLACK_CLIENT_ID}` +
    `&scope=incoming-webhook,chat:write` +
    `&redirect_uri=${encodeURIComponent(env.SLACK_REDIRECT_URI)}` +
    `&state=${senderId}`;

  console.log(`🔗 Redirecting user to Slack OAuth authorizing senderId: ${senderId}`);
  res.redirect(slackAuthUrl);
});

// Slack OAuth callback endpoint
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query;

  if (error) {
    console.error('❌ Slack OAuth redirection error:', error);
    res.status(400).send(`Slack integration failed: ${error}`);
    return;
  }

  if (!code || !state) {
    res.status(400).send('Invalid Slack callback parameters.');
    return;
  }

  const senderId = state as string;

  try {
    console.log(`🔄 Exchanging authorization code for access token/webhook...`);

    // Exchange the authorization code for token details using built-in fetch
    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: env.SLACK_CLIENT_ID,
        client_secret: env.SLACK_CLIENT_SECRET,
        code: code as string,
        redirect_uri: env.SLACK_REDIRECT_URI,
      }).toString(),
    });

    const data: any = await response.json();

    if (!data.ok) {
      console.error('❌ Slack token exchange error details:', data);
      res.status(500).send(`Slack token exchange failed: ${data.error}`);
      return;
    }

    const accessToken = data.access_token;
    const webhookUrl = data.incoming_webhook?.url;

    console.log(`✅ Slack credentials retrieved. Webhook: ${webhookUrl ? 'Available' : 'None'}`);

    // Store in PostgreSQL database mapped to the senderId
    await prisma.slackIntegration.upsert({
      where: { tenantId: senderId },
      update: {
        accessToken,
        webhookUrl,
        connectedAt: new Date(),
      },
      create: {
        tenantId: senderId,
        accessToken,
        webhookUrl,
        connectedAt: new Date(),
      },
    });

    console.log(`🎉 Slack workspace successfully connected and persisted for sender/tenant ${senderId}`);

    // Redirect to frontend or display success page
    res.send(`
      <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
        <h1 style="color: #4A154B;">🎉 Slack Connected!</h1>
        <p>Your Slack workspace has been successfully connected to your email sender account.</p>
        <p>You can close this tab now.</p>
      </div>
    `);

  } catch (err: any) {
    console.error('❌ Error during Slack OAuth callback:', err);
    res.status(500).send(`Slack OAuth callback error: ${err.message}`);
  }
});

// A manual seed endpoint for testing purposes (allows configuring a webhook URL directly without Slack OAuth registration)
router.post('/seed-webhook', async (req: Request, res: Response) => {
  const { senderId, webhookUrl } = req.body;

  if (!senderId || !webhookUrl) {
    res.status(400).json({ error: 'senderId and webhookUrl are required.' });
    return;
  }

  try {
    const integration = await prisma.slackIntegration.upsert({
      where: { tenantId: senderId },
      update: {
        webhookUrl,
        connectedAt: new Date(),
      },
      create: {
        tenantId: senderId,
        webhookUrl,
        connectedAt: new Date(),
      },
    });
    console.log(`✅ Manually seeded Slack webhook for sender ${senderId}`);
    res.status(201).json(integration);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Mock Slack Webhook Receiver
router.post('/test-webhook', (req: Request, res: Response) => {
  console.log('📬 [SLACK MOCK WEBHOOK RECEIVED MESSAGE]:');
  console.log(JSON.stringify(req.body, null, 2));
  res.send('ok');
});

export default router;
