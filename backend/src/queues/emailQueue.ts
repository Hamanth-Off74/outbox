import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../config/env';

export const redisConnection = env.REDIS_URL
  ? new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      tls: env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
    })
  : new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
    });

// Create the email scheduling queue
export const emailQueue = new Queue('email-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true, // remove completed jobs to save redis memory
    removeOnFail: false,   // keep failed jobs for debugging
  },
});

console.log('📦 BullMQ Queue "email-queue" initialized.');
