// ===== WHATSAPP FSM STATES =====

export type WhatsAppState =
  | 'INITIAL'
  | 'AWAITING_REPLY'
  | 'QUALIFYING'
  | 'QUALIFIED'
  | 'NURTURING'
  | 'HUMAN_HANDOFF'
  | 'REMINDER_SEQUENCE'
  | 'ATTENDING'
  | 'LOST'
  | 'WINDOW_EXPIRED';

// ===== TEMPLATE NAMES =====

export type WhatsAppTemplateName =
  | 'workshop_welcome'
  | 'workshop_reminder_7d'
  | 'workshop_reminder_3d'
  | 'workshop_reminder_1d'
  | 're_engagement';

// ===== WHATSAPP MESSAGE TYPES =====

export interface WhatsAppTemplateMessage {
  type: 'template';
  template: {
    name: WhatsAppTemplateName;
    language: { code: 'en' | 'hi' };
    components: Array<{
      type: 'header' | 'body' | 'button';
      parameters: Array<
        | { type: 'text'; text: string }
        | { type: 'image'; image: { link: string } }
        | { type: 'date_time'; date_time: { fallback_value: string } }
      >;
    }>;
  };
}

export interface WhatsAppInteractiveListMessage {
  type: 'interactive';
  interactive: {
    type: 'list';
    header?: { type: 'text'; text: string };
    body: { text: string };
    footer?: { text: string };
    action: {
      button: string;          // List button label (max 20 chars)
      sections: Array<{
        title: string;
        rows: Array<{
          id: string;
          title: string;       // Max 24 chars
          description?: string; // Max 72 chars
        }>;
      }>;
    };
  };
}

export interface WhatsAppInteractiveButtonMessage {
  type: 'interactive';
  interactive: {
    type: 'button';
    body: { text: string };
    action: {
      buttons: Array<{
        type: 'reply';
        reply: { id: string; title: string }; // title max 20 chars
      }>;
    };
  };
}

// ===== WHATSAPP INCOMING MESSAGE WEBHOOK =====

export interface WhatsAppIncomingWebhook {
  object: 'whatsapp_business_account';
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: 'whatsapp';
        metadata: { display_phone_number: string; phone_number_id: string };
        contacts?: Array<{ profile: { name: string }; wa_id: string }>;
        messages?: Array<{
          from: string;          // Phone number
          id: string;            // Message ID
          timestamp: string;
          type: 'text' | 'interactive' | 'button';
          text?: { body: string };
          interactive?: {
            type: 'list_reply' | 'button_reply';
            list_reply?: { id: string; title: string };
            button_reply?: { id: string; title: string };
          };
        }>;
        statuses?: Array<{
          id: string;
          status: 'sent' | 'delivered' | 'read' | 'failed';
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: 'messages';
    }>;
  }>;
}

// ===== INTENT SCORE =====

export interface IntentScore {
  leadId: string;
  score: number;             // 0–100
  reasoning: string;         // Claude AI explanation
  recommendation: 'ROUTE_TO_HUMAN' | 'CONTINUE_NURTURING' | 'MARK_LOST';
  scoredAt: Date;
  scoredBy: 'claude-sonnet-4-6';
}

// ===== STATE TRANSITION =====

export interface WhatsAppStateTransition {
  leadId: string;
  fromState: WhatsAppState;
  toState: WhatsAppState;
  trigger: string;
  messageSent?: string;      // Template or message content
  intentScore?: IntentScore;
  transitionedAt: Date;
}
