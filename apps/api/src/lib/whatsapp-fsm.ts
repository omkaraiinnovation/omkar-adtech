/**
 * WhatsApp Cloud API — 7-State FSM
 * States: INITIAL → GREETING → QUALIFYING → QUALIFIED → SCHEDULING
 *         → CONFIRMED → ENROLLED | LOST (terminal)
 *
 * Intent scoring via Claude Sonnet (threshold 70 for lead to advance)
 * Human handoff to Slack when intent < 30 or state stalls
 */

import Anthropic from '@anthropic-ai/sdk';
import { prisma } from './prisma';
import { logger } from './logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WhatsAppState =
  | 'INITIAL'
  | 'GREETING'
  | 'QUALIFYING'
  | 'QUALIFIED'
  | 'SCHEDULING'
  | 'CONFIRMED'
  | 'ENROLLED'
  | 'LOST';

export type WhatsAppTemplateName =
  | 'workshop_welcome'          // Sent on lead creation
  | 'workshop_reminder_24h'     // 24h before workshop
  | 'workshop_reminder_1h'      // 1h before workshop
  | 'workshop_followup'         // 24h after workshop
  | 'lead_reengagement';        // 7-day dormant leads

export interface WhatsAppMessage {
  type: 'text' | 'interactive' | 'template' | 'image' | 'audio';
  body?: string;
  templateName?: WhatsAppTemplateName;
  templateParams?: string[];
  buttons?: Array<{ id: string; title: string }>;
}

export interface IntentAnalysis {
  score: number;       // 0–100
  intent: 'INTERESTED' | 'NEUTRAL' | 'OBJECTING' | 'REQUESTING_INFO' | 'READY_TO_ENROLL';
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  extractedInfo: {
    name?: string;
    city?: string;
    profession?: string;
    experience?: string;
    budget?: string;
  };
  suggestedResponse: string;
  escalateToHuman: boolean;
}

// ---------------------------------------------------------------------------
// WhatsApp Cloud API sender
// ---------------------------------------------------------------------------

const WA_BASE = 'https://graph.facebook.com/v20.0';

async function sendWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,  // E.164 format
  message: WhatsAppMessage
): Promise<string> {
  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
  };

  if (message.type === 'text' && message.body) {
    body.type = 'text';
    body.text = { body: message.body, preview_url: false };
  } else if (message.type === 'template' && message.templateName) {
    body.type = 'template';
    body.template = {
      name: message.templateName,
      language: { code: 'en_IN' },
      components: message.templateParams ? [
        {
          type: 'body',
          parameters: message.templateParams.map((text) => ({ type: 'text', text })),
        },
      ] : [],
    };
  } else if (message.type === 'interactive' && message.body && message.buttons) {
    body.type = 'interactive';
    body.interactive = {
      type: 'button',
      body: { text: message.body },
      action: {
        buttons: message.buttons.map((b) => ({
          type: 'reply',
          reply: { id: b.id, title: b.title },
        })),
      },
    };
  }

  const res = await fetch(`${WA_BASE}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WhatsApp API error ${res.status}: ${err}`);
  }

  const data = await res.json() as { messages?: Array<{ id: string }> };
  return data.messages?.[0]?.id ?? '';
}

// ---------------------------------------------------------------------------
// Claude intent scorer
// ---------------------------------------------------------------------------

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function analyzeIntent(
  userMessage: string,
  conversationHistory: string,
  leadContext: { name: string; city?: string | null }
): Promise<IntentAnalysis> {
  const prompt = `You are an AI sales assistant for Omkar AI Innovation, an AI training company in India.

Lead context: Name: ${leadContext.name}, City: ${leadContext.city ?? 'Unknown'}
Conversation history:
${conversationHistory}

Latest user message: "${userMessage}"

Analyze this message and respond with JSON:
{
  "score": <0-100 interest score>,
  "intent": "<INTERESTED|NEUTRAL|OBJECTING|REQUESTING_INFO|READY_TO_ENROLL>",
  "sentiment": "<POSITIVE|NEUTRAL|NEGATIVE>",
  "extractedInfo": {
    "name": "<if mentioned>",
    "city": "<if mentioned>",
    "profession": "<if mentioned>",
    "experience": "<if mentioned>",
    "budget": "<if mentioned>"
  },
  "suggestedResponse": "<natural, conversational Hindi/English response>",
  "escalateToHuman": <true if confused/angry/complex query>
}`;

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = msg.content[0];
  if (content?.type !== 'text') throw new Error('Claude returned non-text response');

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in Claude response');

  return JSON.parse(jsonMatch[0]) as IntentAnalysis;
}

// ---------------------------------------------------------------------------
// FSM transition logic
// ---------------------------------------------------------------------------

function getNextState(
  currentState: WhatsAppState,
  intent: IntentAnalysis
): WhatsAppState {
  // Terminal states
  if (currentState === 'ENROLLED' || currentState === 'LOST') return currentState;

  // Force human handoff → LOST (will escalate)
  if (intent.escalateToHuman) return currentState; // Stay in state, human takes over

  const score = intent.score;

  switch (currentState) {
    case 'INITIAL':
      return 'GREETING';

    case 'GREETING':
      if (score >= 70) return 'QUALIFYING';
      if (score < 20) return 'LOST';
      return 'GREETING';

    case 'QUALIFYING':
      if (score >= 70 && intent.intent === 'READY_TO_ENROLL') return 'QUALIFIED';
      if (score >= 50) return 'SCHEDULING';
      if (score < 20) return 'LOST';
      return 'QUALIFYING';

    case 'QUALIFIED':
      return 'SCHEDULING';

    case 'SCHEDULING':
      if (intent.intent === 'READY_TO_ENROLL' || score >= 80) return 'CONFIRMED';
      if (score < 20) return 'LOST';
      return 'SCHEDULING';

    case 'CONFIRMED':
      if (score >= 85) return 'ENROLLED';
      return 'CONFIRMED';

    default:
      return currentState;
  }
}

function getResponseForState(
  state: WhatsAppState,
  intent: IntentAnalysis,
  leadName: string
): WhatsAppMessage {
  const firstName = leadName.split(' ')[0] ?? leadName;

  switch (state) {
    case 'GREETING':
      return {
        type: 'interactive',
        body: `Hello ${firstName}! 👋 Thank you for your interest in Omkar AI Innovation's workshops.\n\nWe help professionals master AI and build real-world projects in just 3 days.\n\nAre you interested in learning more?`,
        buttons: [
          { id: 'yes_interested', title: 'Yes, tell me more!' },
          { id: 'not_now', title: 'Maybe later' },
        ],
      };

    case 'QUALIFYING':
      return {
        type: 'text',
        body: intent.suggestedResponse || `Great, ${firstName}! Our AI Workshop is designed for working professionals.\n\n✅ No coding experience needed\n✅ Hands-on projects\n✅ Certificate on completion\n\nWhat's your current role and experience with AI?`,
      };

    case 'SCHEDULING':
      return {
        type: 'interactive',
        body: `${firstName}, our next workshop is coming up soon!\n\n📅 3-Day AI Intensive\n💰 Limited seats available\n\nWould you like to reserve your seat?`,
        buttons: [
          { id: 'book_now', title: 'Book My Seat 🎯' },
          { id: 'more_info', title: 'I have questions' },
        ],
      };

    case 'CONFIRMED':
      return {
        type: 'template',
        templateName: 'workshop_reminder_24h',
        templateParams: [firstName],
      };

    case 'ENROLLED':
      return {
        type: 'text',
        body: `Congratulations ${firstName}! 🎉 You're officially enrolled in the Omkar AI Workshop!\n\nYou'll receive your joining instructions shortly. See you there!`,
      };

    case 'LOST':
      return {
        type: 'text',
        body: `No worries ${firstName}! If you change your mind, we're always here. 😊\n\nFeel free to reach out anytime!`,
      };

    default:
      return {
        type: 'text',
        body: intent.suggestedResponse || `Thank you for your message, ${firstName}! Let me connect you with our team.`,
      };
  }
}

// ---------------------------------------------------------------------------
// Send Slack human handoff notification
// ---------------------------------------------------------------------------

async function notifyHumanHandoff(
  leadId: string,
  leadName: string,
  phone: string,
  reason: string,
  lastMessage: string
): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `🚨 *Human Handoff Required*\n*Lead:* ${leadName} (${phone})\n*Lead ID:* ${leadId}\n*Reason:* ${reason}\n*Last Message:* "${lastMessage}"\n\nPlease take over this conversation.`,
    }),
  });
}

// ---------------------------------------------------------------------------
// Main handler: process incoming WhatsApp message
// ---------------------------------------------------------------------------

export async function processWhatsAppMessage(
  from: string,    // E.164 phone number
  messageBody: string,
  messageId: string
): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    logger.error('WhatsApp credentials not configured');
    return;
  }

  // Find lead by phone
  const lead = await prisma.lead.findUnique({
    where: { phone: from },
    include: { conversation: true },
  });

  if (!lead) {
    logger.warn({ phone: from }, 'WhatsApp message from unknown number — no lead found');
    return;
  }

  // Get or create conversation
  let conversation = lead.conversation;
  if (!conversation) {
    conversation = await prisma.whatsAppConversation.create({
      data: {
        leadId: lead.id,
        state: 'INITIAL',
        windowOpenAt: new Date(),
      },
    });
  }

  const currentState = conversation.state as WhatsAppState;

  // Build conversation history for context (last 10 messages from AgentLog)
  const recentLogs = await prisma.agentLog.findMany({
    where: { agentName: 'WhatsAppFSM', inputJson: { path: ['leadId'], equals: lead.id } },
    orderBy: { createdAt: 'asc' },
    take: 10,
    select: { inputJson: true, outputJson: true },
  });

  const history = recentLogs
    .map((log: { inputJson: unknown; outputJson: unknown }) => {
      const input = log.inputJson as { message?: string };
      const output = log.outputJson as { response?: string };
      return `User: ${input.message ?? ''}\nBot: ${output.response ?? ''}`;
    })
    .join('\n');

  // Score intent
  let intent: IntentAnalysis;
  try {
    intent = await analyzeIntent(messageBody, history, { name: lead.name, city: lead.city });
  } catch (err) {
    logger.error({ err }, 'Intent analysis failed');
    intent = {
      score: 50,
      intent: 'NEUTRAL',
      sentiment: 'NEUTRAL',
      extractedInfo: {},
      suggestedResponse: 'Let me connect you with our team.',
      escalateToHuman: true,
    };
  }

  // Determine next state
  const nextState = getNextState(currentState, intent);
  logger.info({ leadId: lead.id, from: currentState, to: nextState, score: intent.score }, 'FSM transition');

  // Build response message
  const response = getResponseForState(nextState, intent, lead.name);

  // Send WhatsApp message
  try {
    await sendWhatsAppMessage(phoneNumberId, accessToken, from, response);
  } catch (err) {
    logger.error({ err, leadId: lead.id }, 'Failed to send WhatsApp response');
  }

  // Update conversation state
  await prisma.whatsAppConversation.update({
    where: { id: conversation.id },
    data: {
      state: nextState,
      lastMsgAt: new Date(),
      messageCount: { increment: 1 },
      windowOpenAt: conversation.windowOpenAt ?? new Date(),
    },
  });

  // Update lead score and status
  const leadStatusUpdate: Partial<{ score: number; status: typeof lead.status }> = {
    score: intent.score,
  };
  if (nextState === 'ENROLLED') leadStatusUpdate.status = 'ENROLLED';
  if (nextState === 'LOST') leadStatusUpdate.status = 'LOST';
  if (nextState === 'QUALIFIED' || nextState === 'SCHEDULING') leadStatusUpdate.status = 'QUALIFYING';

  await prisma.lead.update({
    where: { id: lead.id },
    data: leadStatusUpdate,
  });

  // Update extracted info if any
  if (Object.keys(intent.extractedInfo).length > 0) {
    const updates: Partial<typeof lead> = {};
    if (intent.extractedInfo.city && !lead.city) updates.city = intent.extractedInfo.city;
    if (Object.keys(updates).length > 0) {
      await prisma.lead.update({ where: { id: lead.id }, data: updates });
    }
  }

  // Log the interaction
  await prisma.agentLog.create({
    data: {
      agentName: 'WhatsAppFSM',
      action: 'process_message',
      inputJson: { leadId: lead.id, message: messageBody, fromState: currentState } as object,
      outputJson: {
        toState: nextState,
        intentScore: intent.score,
        response: response.body ?? response.templateName,
      } as object,
      status: 'SUCCESS',
      ms: 0,
    },
  });

  // Human handoff if needed
  if (intent.escalateToHuman || nextState === 'LOST') {
    await notifyHumanHandoff(
      lead.id,
      lead.name,
      from,
      intent.escalateToHuman ? 'Low intent or complex query' : 'Lead marked as LOST',
      messageBody
    );
  }
}

// ---------------------------------------------------------------------------
// Send initial welcome template when lead is created
// ---------------------------------------------------------------------------

export async function sendWelcomeTemplate(leadId: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) return;

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return;

  try {
    await sendWhatsAppMessage(phoneNumberId, accessToken, lead.phone, {
      type: 'template',
      templateName: 'workshop_welcome',
      templateParams: [lead.name.split(' ')[0] ?? lead.name],
    });

    // Create conversation in GREETING state
    await prisma.whatsAppConversation.upsert({
      where: { leadId },
      create: { leadId, state: 'GREETING', windowOpenAt: new Date() },
      update: { state: 'GREETING', windowOpenAt: new Date() },
    });

    logger.info({ leadId }, 'Welcome template sent');
  } catch (err) {
    logger.error({ err, leadId }, 'Failed to send welcome template');
  }
}
