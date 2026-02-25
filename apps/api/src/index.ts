import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './router';
import { createContext } from './trpc';
import { logger } from './lib/logger';
import { generalLimiter, webhookLimiter } from './middleware/rateLimit';

const app = express();
const PORT = process.env.PORT ?? 4000;

// ===== SECURITY MIDDLEWARE =====
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// ===== HEALTH CHECK =====
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ===== A2A AGENT CARDS =====
app.get('/.well-known/agent-card.json', (_req, res) => {
  res.json({
    name: 'ComplianceAuditorAgent',
    version: '1.0.0',
    description: 'Validates ad creatives against Meta and Google advertising policies',
    capabilities: ['image_analysis', 'text_policy_check', 'video_frame_audit'],
    endpoint: `${process.env.API_URL}/agents/compliance`,
    protocol: 'JSON-RPC 2.0 over HTTP+SSE',
    inputSchema: {
      creative: {
        type: 'object',
        required: ['imageUrl', 'headline', 'description', 'platform'],
      },
    },
    outputSchema: {
      compliant: 'boolean',
      score: 'number (0-1)',
      violations: 'string[]',
      suggestions: 'string[]',
    },
  });
});

// ===== RATE LIMITING =====
// General: 100 req/min per IP on tRPC and agent routes
// Webhooks: 300 req/min (Meta/WhatsApp may send burst callbacks)
app.use('/trpc', generalLimiter);
app.use('/agents', generalLimiter);

// ===== TRPC API =====
app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// ===== WEBHOOK ROUTES (imported separately for signature verification) =====
import('./routes/webhooks').then(({ webhookRouter }) => {
  app.use('/webhooks', webhookLimiter, webhookRouter);
});

// ===== AGENT RPC ROUTES =====
import('./routes/agents').then(({ agentRouter }) => {
  app.use('/agents', agentRouter);
});

// ===== ERROR HANDLER =====
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal Server Error' });
});

// ===== START =====
app.listen(PORT, () => {
  logger.info(`API server running on port ${PORT}`);

  // Start 15-minute metrics poller
  import('./lib/metrics-poller').then(({ startMetricsPoller }) => {
    startMetricsPoller();
  });
});

export type { AppRouter } from './router';
