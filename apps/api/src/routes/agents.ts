import { Router } from 'express';
import { logger } from '../lib/logger';

export const agentRouter = Router();

// JSON-RPC 2.0 endpoint for Compliance Auditor Agent (A2A protocol)
agentRouter.post('/compliance', async (req, res): Promise<void> => {
  const { jsonrpc, method, params, id } = req.body;

  if (jsonrpc !== '2.0' || method !== 'audit') {
    res.json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Invalid request' },
      id: id ?? null,
    });
    return;
  }

  const { creative } = params as {
    creative: {
      imageUrl?: string;
      headline: string;
      description: string;
      platform: 'GOOGLE' | 'META';
    };
  };

  if (!creative) {
    res.json({
      jsonrpc: '2.0',
      error: { code: -32602, message: 'Missing creative parameter' },
      id,
    });
    return;
  }

  try {
    // TODO: Phase 3 — invoke real ComplianceAuditorAgent
    const mockResult = {
      compliant: true,
      score: 0.92,
      violations: [],
      suggestions: [],
    };

    logger.info({ headline: creative.headline, platform: creative.platform }, 'Compliance audit requested');

    res.json({
      jsonrpc: '2.0',
      result: mockResult,
      id,
    });
  } catch (err) {
    logger.error({ err }, 'Compliance audit error');
    res.json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Audit failed' },
      id,
    });
  }
});

// SSE endpoint for real-time agent activity stream
agentRouter.get('/activity-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const keepAlive = setInterval(() => {
    res.write(':keepalive\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(keepAlive);
  });
});
