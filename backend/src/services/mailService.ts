import nodemailer from 'nodemailer';
import { env } from '../config/env';

let transporter: nodemailer.Transporter | null = null;

export const getMailTransporter = async (): Promise<nodemailer.Transporter> => {
  if (transporter) return transporter;

  // Check if SMTP environment variables are defined
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    console.log(`🌐 Constructing real pooled SMTP Transporter connecting to: ${env.SMTP_HOST}:${env.SMTP_PORT ?? 587}`);
    transporter = nodemailer.createTransport({
      pool: true, // Enable connection pooling
      maxConnections: env.WORKER_CONCURRENCY || 5, // Match max connections to worker concurrency
      maxMessages: 100, // Send up to 100 messages per socket before recreating it
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      secure: env.SMTP_SECURE === 'true' || env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
    return transporter;
  }

  // Fallback to Ethereal Email (fake SMTP)
  console.log('🔄 Creating Ethereal SMTP test account...');
  const testAccount = await nodemailer.createTestAccount();
  
  console.log('📬 Ethereal SMTP Account Details:');
  console.log(`   User: ${testAccount.user}`);
  console.log(`   Pass: ${testAccount.pass}`);
  console.log(`   Web:  https://ethereal.email`);

  transporter = nodemailer.createTransport({
    pool: true, // Enable connection pooling for test mailers too
    maxConnections: env.WORKER_CONCURRENCY || 5,
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

  return transporter;
};
