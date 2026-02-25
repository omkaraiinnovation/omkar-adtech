import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { verifyMetaWebhookSignature, getMetaAdsCreds } from '../lib/meta-ads';
import { processWhatsAppMessage, sendWelcomeTemplate } from '../lib/whatsapp-fsm';
import type {
  MetaLeadAdsWebhookPayload,
  WhatsAppIncomingWebhook,
} from '@omkar-adtech/types';

export const webhookRouter = Router();

// ===== META LEAD ADS WEBHOOK =====
// POST /webhooks/meta
webhookRouter.post('/meta', async (req, res): Promise<void> => {
  // 1. Verify HMAC-SHA256 signature using the shared verifier
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  const appSecret = process.env.META_APP_SECRET ?? '';
  const rawBody = JSON.stringify(req.body);

  if (!signature || !verifyMetaWebhookSignature(rawBody, signature, appSecret)) {
    logger.warn({ signature }, 'Meta webhook signature verification failed');
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  const payload = req.body as MetaLeadAdsWebhookPayload;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'leadgen') continue;

      const { leadgen_id, campaign_id, form_id } = change.value;

      try {
        // 2. Fetch full lead from Meta API
        const leadData = await fetchMetaLead(leadgen_id);
        if (!leadData) continue;

        // 3. Find campaign record
        const campaign = await prisma.campaign.findFirst({
          where: { externalId: campaign_id },
        });
        if (!campaign) {
          logger.warn({ campaign_id }, 'Campaign not found for Meta lead');
          continue;
        }

        // 4. Upsert lead (conflict resolution on phone — dedup key)
        const lead = await prisma.lead.upsert({
          where: { phone: leadData.phone },
          update: {
            name: leadData.name,
            ...(leadData.email && { email: leadData.email }),
          },
          create: {
            name: leadData.name,
            phone: leadData.phone,
            ...(leadData.email && { email: leadData.email }),
            ...(leadData.city && { city: leadData.city }),
            source: 'META',
            campaignId: campaign.id,
            metadata: { leadgen_id, form_id, rawData: leadData },
          },
        });

        logger.info({ leadId: lead.id, campaignId: campaign.id }, 'Meta lead captured');

        // 5. Send WhatsApp welcome message (async — don't block response)
        setImmediate(() => sendWelcomeTemplate(lead.id).catch((err) =>
          logger.error({ err, leadId: lead.id }, 'Failed to send WhatsApp welcome')
        ));

        // 6. Notify Slack #new-leads
        await notifySlack(lead);

      } catch (err) {
        logger.error({ err, leadgen_id }, 'Error processing Meta lead');
      }
    }
  }

  res.json({ status: 'ok' });
});

// Meta webhook verification (GET challenge)
webhookRouter.get('/meta', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.status(403).json({ error: 'Verification failed' });
  }
});

// ===== WHATSAPP WEBHOOK =====
// POST /webhooks/whatsapp
webhookRouter.post('/whatsapp', async (req, res): Promise<void> => {
  // Verify WhatsApp webhook signature
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  const appSecret = process.env.META_APP_SECRET ?? '';

  if (signature && !verifyMetaWebhookSignature(JSON.stringify(req.body), signature, appSecret)) {
    logger.warn('WhatsApp webhook signature mismatch');
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  const payload = req.body as WhatsAppIncomingWebhook;

  // Respond immediately with 200 — WhatsApp requires fast ACK
  res.json({ status: 'ok' });

  // Process messages asynchronously
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value.messages ?? []) {
        const messageBody =
          message.type === 'text' ? (message as { text?: { body?: string } }).text?.body ?? '' :
          message.type === 'interactive' ?
            // Extract button reply text
            (message as { interactive?: { button_reply?: { title?: string } } }).interactive?.button_reply?.title ?? '' :
          '';

        if (!messageBody) continue;

        setImmediate(() =>
          processWhatsAppMessage(message.from, messageBody, message.id).catch((err) =>
            logger.error({ err, from: message.from }, 'WhatsApp FSM processing failed')
          )
        );
      }
    }
  }
});

// WhatsApp webhook verification
webhookRouter.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.status(403).json({ error: 'Verification failed' });
  }
});

// ===== GOOGLE LEAD FORM POLLER WEBHOOK =====
// Called by cron every 5 minutes to pull Google lead form submissions
// POST /webhooks/google-lead-poller
webhookRouter.post('/google-lead-poller', async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  const internalSecret = process.env.INTERNAL_WEBHOOK_SECRET;

  if (!internalSecret || authHeader !== `Bearer ${internalSecret}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { campaignId } = req.body as { campaignId?: string };
  if (!campaignId) {
    res.status(400).json({ error: 'campaignId required' });
    return;
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, externalId: true, platform: true },
  });

  if (!campaign?.externalId || campaign.platform !== 'GOOGLE') {
    res.status(404).json({ error: 'Google campaign not found' });
    return;
  }

  // Import and run the poller inline
  const { getGoogleAdsCreds, getGoogleAdsLeadFormSubmissions } = await import('../lib/google-ads');
  const creds = getGoogleAdsCreds();
  if (!creds) {
    res.status(503).json({ error: 'Google Ads not configured' });
    return;
  }

  try {
    const since = new Date(Date.now() - 5 * 60 * 1000); // Last 5 minutes
    const submissions = await getGoogleAdsLeadFormSubmissions(creds, campaign.externalId, since);

    logger.info({ count: submissions.length, campaignId }, 'Google lead form poll complete');
    res.json({ status: 'ok', count: submissions.length });
  } catch (err) {
    logger.error({ err, campaignId }, 'Google lead form poll failed');
    res.status(500).json({ error: 'Poll failed' });
  }
});

// ===== HELPERS =====

async function fetchMetaLead(leadgenId: string): Promise<{
  name: string; phone: string; email?: string; city?: string;
} | null> {
  const creds = getMetaAdsCreds();
  if (!creds) {
    logger.warn('Meta credentials not configured for lead fetch');
    return null;
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${leadgenId}?fields=field_data&access_token=${creds.accessToken}`
    );

    if (!res.ok) return null;

    const data = await res.json() as {
      field_data?: Array<{ name: string; values: string[] }>;
    };

    if (!data.field_data) return null;

    // Parse field_data into structured lead
    const fields: Record<string, string> = {};
    for (const field of data.field_data) {
      fields[field.name] = field.values[0] ?? '';
    }

    const phone = fields['phone_number'] ?? fields['mobile_number'] ?? fields['phone'] ?? '';
    const name = [fields['first_name'], fields['last_name']].filter(Boolean).join(' ')
      || fields['full_name']
      || fields['name']
      || 'Unknown';

    if (!phone) return null;

    return {
      name,
      phone: phone.startsWith('+') ? phone : `+91${phone}`, // Default India prefix
      ...(fields['email'] && { email: fields['email'] }),
      ...(fields['city'] && { city: fields['city'] }),
    };
  } catch (err) {
    logger.error({ err, leadgenId }, 'Failed to fetch Meta lead data');
    return null;
  }
}

async function notifySlack(lead: { id: string; name: string; phone: string }): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🎯 New Lead: *${lead.name}* (${lead.phone}) | <${process.env.FRONTEND_URL}/leads/${lead.id}|View in CRM>`,
      }),
    });
  } catch (err) {
    logger.warn({ err }, 'Slack notification failed');
  }
}
