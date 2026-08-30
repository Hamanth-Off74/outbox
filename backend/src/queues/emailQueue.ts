import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../config/env';

export const redisConnection = env.REDIS_URL
  ? new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
      tls: env.REDIS_URL.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
    })
  : new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
    });

// Handle connection warnings without crashing Node process
redisConnection.on('error', (err) => {
  console.warn('⚠️ Redis Connection Event:', err.message);
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

console.log(`📡 Redis connecting target: ${env.REDIS_URL ? 'Cloud REDIS_URL' : `${env.REDIS_HOST}:${env.REDIS_PORT}`}`);
console.log('📦 BullMQ Queue "email-queue" initialized.');
