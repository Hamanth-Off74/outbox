# ReachInbox Outbox Engine 🚀

> A production-grade **Email Job Scheduling & Rate Limit Manager** built with **Express.js**, **TypeScript**, **BullMQ**, **Redis**, **PostgreSQL**, **Elasticsearch**, **Next.js**, and **Ethereal Email SMTP**.

---

## 📌 Project Overview

**ReachInbox Outbox Engine** is a high-throughput, distributed email job scheduling system designed to process, queue, throttle, and monitor bulk email campaigns.

### Key Capabilities
- ⚡ **Asynchronous Scheduling**: Schedule emails with specific start timestamps and delays between messages using **BullMQ** queues over **Redis**.
- 🛡️ **Atomic Hourly Rate Limiting**: Prevent sender account lockouts by enforcing configurable hourly sending limits per tenant via **Redis sliding hour windows**. Emails exceeding limits are automatically postponed to the next window.
- 🔔 **Slack Alerting**: Send real-time alert webhooks to Slack whenever a sender reaches their hourly rate limit.
- 📧 **Ethereal Email SMTP Integration**: Complete email dispatch with live Ethereal Email test preview URLs stored directly in the database and displayed in the frontend dashboard.
- 🔍 **Elasticsearch Search**: Full-text fuzzy search across campaign subjects, message bodies, recipients, and job status statuses.
- 🔐 **Google OAuth Authentication**: Secure user login via **NextAuth.js** integrated with Google OAuth 2.0.
- 📊 **Visual Queue Dashboard**: Live queue monitoring powered by **Bull-Board** mounted at `/admin/queues`.

---

## 🛠️ Technology Stack

### Backend
- **Language**: TypeScript (`v5.x`)
- **Framework**: Express.js
- **Database & ORM**: PostgreSQL (`v16+`), Prisma ORM (`v5.x`)
- **Queue System**: BullMQ (`v5.x`) backed by Redis
- **Search Engine**: Elasticsearch (`v8.x`)
- **Mail Service**: Nodemailer with Ethereal Email SMTP & connection pooling
- **Validation**: Zod schema validation

### Frontend
- **Framework**: Next.js 16 (App Router with Turbopack)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Authentication**: NextAuth.js (Google OAuth 2.0)

---

## 🏗️ Project Structure

```text
outbox/
├── backend/                  # Express.js + TypeScript API Server & Worker
│   ├── prisma/               # Database schema definitions & migrations
│   │   └── schema.prisma
│   ├── src/
│   │   ├── config/           # Environment validation & Zod schemas
│   │   ├── controllers/      # Route handler logic
│   │   ├── queues/           # BullMQ queue initialization
│   │   ├── routes/           # REST API endpoints (emails, slack, senders)
│   │   ├── services/         # Mail, Elasticsearch, & Redis services
│   │   ├── workers/          # BullMQ background job processing workers
│   │   └── index.ts          # Express application entrypoint
│   ├── .env.example          # Environment variables template
│   └── package.json
│
├── frontend/                 # Next.js 16 Web Application
│   ├── src/
│   │   ├── app/              # App router pages (login, dashboard, API routes)
│   │   │   ├── api/auth/     # NextAuth Google provider endpoints
│   │   │   ├── dashboard/    # Main campaign scheduling dashboard
│   │   │   └── login/        # Glassmorphic Google OAuth login page
│   │   └── components/       # Reusable UI components (Button, Modal, Table)
│   ├── .env.example          # Frontend environment variables template
│   └── package.json
│
├── .gitignore                # Git ignore patterns for secrets & build outputs
└── README.md                 # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
Ensure you have the following installed on your system:
- **Node.js**: `v18.x` or `v20.x`
- **PostgreSQL**: Running locally on port `5432`
- **Redis**: Running locally on port `6379`
- **Elasticsearch**: Running locally on port `9200`

---

### 1. Environment Setup

Copy `.env.example` to `.env` in both `backend/` and `frontend/`:

```bash
# Backend environment setup
cp backend/.env.example backend/.env

# Frontend environment setup
cp frontend/.env.example frontend/.env
```

#### Backend Environment (`backend/.env`):
```env
PORT=5000
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/outbox_db?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6379
ELASTICSEARCH_NODE=http://localhost:9200
WORKER_CONCURRENCY=5
MAX_EMAILS_PER_HOUR_PER_SENDER=10
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FRONTEND_URL=http://localhost:3000
```

#### Frontend Environment (`frontend/.env`):
```env
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret-key"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

---

### 2. Database Migration & Setup

From the `backend/` directory:

```bash
cd backend
npm install
npx prisma db push
```

---

### 3. Running the Application

#### Start the Backend API & Queue Worker:
```bash
cd backend
npm run dev
```
*The backend server will run on `http://localhost:5000`.*

#### Start the Frontend Web Application:
```bash
cd frontend
npm install
npm run dev
```
*The frontend dashboard will run on `http://localhost:3000`.*

---

## 📊 Monitoring & API Endpoints

- **Frontend Application**: `http://localhost:3000`
- **Backend Health Check**: `http://localhost:5000/health`
- **BullMQ Live Visual Dashboard**: `http://localhost:5000/admin/queues`
- **Elasticsearch Search API**: `http://localhost:5000/api/emails/search?q=keyword`
- **Schedule Emails API**: `POST http://localhost:5000/api/emails/schedule`

---

## 📝 License & Author
Built for the Software Development Intern Assignment.
