import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().url(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  ELASTICSEARCH_NODE: z.string().url(),
  WORKER_CONCURRENCY: z.coerce.number().default(5),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.coerce.number().default(10),
  GOOGLE_CLIENT_ID: z.string().default('placeholder-google-client-id'),
  GOOGLE_CLIENT_SECRET: z.string().default('placeholder-google-client-secret'),
  GOOGLE_REDIRECT_URI: z.string().default('http://localhost:5000/api/auth/google/callback'),
  SLACK_CLIENT_ID: z.string().default('placeholder-slack-client-id'),
  SLACK_CLIENT_SECRET: z.string().default('placeholder-slack-client-secret'),
  SLACK_REDIRECT_URI: z.string().default('http://localhost:5000/api/auth/slack/callback'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
