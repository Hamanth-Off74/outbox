import express, { Request, Response } from 'express';
import cors from 'cors';
import { env } from './config/env';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { Client as ElasticClient } from '@elastic/elasticsearch';
import { initElasticsearch } from './services/elasticService';
import emailRouter from './routes/emailRoutes';
import slackRouter from './routes/slackRoutes';

// Import Bull-board Queue Monitor Dashboard packages
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue } from './queues/emailQueue';

// Import worker to start listening on boot
import './workers/emailWorker';

const app = express();
app.use(cors());
app.use(express.json());

// Initialize clients
const prisma = new PrismaClient();
const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null, // needed for BullMQ
});
const esClient = new ElasticClient({
  node: env.ELASTICSEARCH_NODE,
});

// Configure Bull-board adapter
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');
createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

// Mount routes
app.use('/api', emailRouter);
app.use('/api/auth/slack', slackRouter);
app.use('/admin/queues', serverAdapter.getRouter());

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  const healthStatus: {
    status: 'healthy' | 'unhealthy';
    postgres: 'connected' | 'error';
    redis: 'connected' | 'error';
    elasticsearch: 'connected' | 'error';
    error?: string;
  } = {
    status: 'healthy',
    postgres: 'connected',
    redis: 'connected',
    elasticsearch: 'connected',
  };

  try {
    // 1. Check Postgres
    await prisma.$queryRaw`SELECT 1`;
  } catch (err: any) {
    healthStatus.postgres = 'error';
    healthStatus.status = 'unhealthy';
    healthStatus.error = `Postgres error: ${err.message}`;
  }

  try {
    // 2. Check Redis
    const pong = await redis.ping();
    if (pong !== 'PONG') {
      healthStatus.redis = 'error';
      healthStatus.status = 'unhealthy';
    }
  } catch (err: any) {
    healthStatus.redis = 'error';
    healthStatus.status = 'unhealthy';
    healthStatus.error = (healthStatus.error || '') + ` Redis error: ${err.message}`;
  }

  try {
    // 3. Check Elasticsearch
    const esPing = await esClient.ping();
    if (!esPing) {
      healthStatus.elasticsearch = 'error';
      healthStatus.status = 'unhealthy';
    }
  } catch (err: any) {
    healthStatus.elasticsearch = 'error';
    healthStatus.status = 'unhealthy';
    healthStatus.error = (healthStatus.error || '') + ` ES error: ${err.message}`;
  }

  res.status(healthStatus.status === 'healthy' ? 200 : 500).json(healthStatus);
});

// Boot verification
const startServer = async () => {
  console.log('🔄 Checking service connections on boot...');
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Connected to PostgreSQL');
  } catch (err) {
    console.error('❌ Failed to connect to PostgreSQL:', err);
  }

  try {
    await redis.ping();
    console.log('✅ Connected to Redis');
  } catch (err) {
    console.error('❌ Failed to connect to Redis:', err);
  }

  try {
    await esClient.ping();
    console.log('✅ Connected to Elasticsearch');
  } catch (err) {
    console.error('❌ Failed to connect to Elasticsearch:', err);
  }

  // Initialize Elasticsearch Index
  await initElasticsearch();

  app.listen(env.PORT, () => {
    console.log(`🚀 Backend server running on port ${env.PORT}`);
  });
};

startServer().catch((err) => {
  console.error('💥 Server boot error:', err);
});
