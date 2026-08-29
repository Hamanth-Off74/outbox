import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env';

export const esClient = new Client({
  node: env.ELASTICSEARCH_NODE,
});

export const INDEX_NAME = 'emails';

export const initElasticsearch = async () => {
  try {
    const exists = await esClient.indices.exists({ index: INDEX_NAME });
    if (!exists) {
      await esClient.indices.create({
        index: INDEX_NAME,
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              status: { type: 'keyword' },
              subject: { type: 'text' },
              body: { type: 'text' },
              recipient: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              senderId: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
              createdAt: { type: 'date' },
            },
          },
        },
      });
      console.log(`🔍 Elasticsearch index "${INDEX_NAME}" initialized successfully.`);
    } else {
      console.log(`🔍 Elasticsearch index "${INDEX_NAME}" already exists.`);
    }
  } catch (err) {
    console.error('❌ Failed to initialize Elasticsearch index:', err);
  }
};

export const indexEmail = async (email: {
  id: string;
  status: string;
  subject: string;
  body: string;
  recipient: string;
  senderId: string;
  scheduledAt: Date;
  sentAt?: Date | null;
  createdAt: Date;
}) => {
  try {
    await esClient.index({
      index: INDEX_NAME,
      id: email.id,
      document: {
        id: email.id,
        status: email.status,
        subject: email.subject,
        body: email.body,
        recipient: email.recipient,
        senderId: email.senderId,
        scheduledAt: email.scheduledAt.toISOString(),
        sentAt: email.sentAt ? email.sentAt.toISOString() : null,
        createdAt: email.createdAt.toISOString(),
      },
    });
    console.log(`✅ Indexed email ${email.id} into Elasticsearch`);
  } catch (err) {
    console.error(`❌ Failed to index email ${email.id} into Elasticsearch:`, err);
  }
};
