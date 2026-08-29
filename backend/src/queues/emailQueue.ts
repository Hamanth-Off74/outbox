import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../config/env';

export const redisConnection = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null, // mandatory configuration for BullMQ
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
