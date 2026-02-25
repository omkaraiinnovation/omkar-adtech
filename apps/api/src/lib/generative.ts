/**
 * Generative Abstraction Layer
 * Unified interface for 7 AI generative models:
 *   Image: Adobe Firefly 3, Stable Diffusion (SDXL)
 *   Video: Veo 3 (Google), Sora 2 (OpenAI), Runway Gen-3 Alpha, Kling AI, Pika Labs 2.0
 *
 * All models are called via their respective REST APIs.
 * Returns a signed URL to the generated asset stored in Supabase Storage.
 */

import { logger } from './logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GenerativeModel =
  | 'veo3'
  | 'sora2'
  | 'runway-gen3'
  | 'kling-ai'
  | 'pika-labs'
  | 'firefly'
  | 'stable-diffusion';

export type GenerativeAssetType = 'image' | 'video';

export interface GenerativeRequest {
  model: GenerativeModel;
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: '9:16' | '16:9' | '1:1' | '4:5';
  durationSeconds?: number; // For video models
  style?: string;
  seed?: number;
  referenceImageUrl?: string;
}

export interface GenerativeResult {
  model: GenerativeModel;
  assetType: GenerativeAssetType;
  assetUrl: string;        // Direct URL from provider or Supabase Storage URL
  thumbnailUrl?: string;   // For video
  durationMs: number;
  promptUsed: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Model capability registry
// ---------------------------------------------------------------------------

export const MODEL_CAPABILITIES: Record<GenerativeModel, { type: GenerativeAssetType; maxDurationSec?: number }> = {
  'veo3':              { type: 'video', maxDurationSec: 60 },
  'sora2':             { type: 'video', maxDurationSec: 60 },
  'runway-gen3':       { type: 'video', maxDurationSec: 30 },
  'kling-ai':          { type: 'video', maxDurationSec: 30 },
  'pika-labs':         { type: 'video', maxDurationSec: 15 },
  'firefly':           { type: 'image' },
  'stable-diffusion':  { type: 'image' },
};

// ---------------------------------------------------------------------------
// Adobe Firefly 3
// https://developer.adobe.com/firefly-api/docs/
// ---------------------------------------------------------------------------

async function generateFirefly(req: GenerativeRequest): Promise<string> {
  const apiKey = process.env.ADOBE_FIREFLY_API_KEY;
  if (!apiKey) throw new Error('ADOBE_FIREFLY_API_KEY not configured');

  const res = await fetch('https://firefly-api.adobe.io/v3/images/generate', {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      prompt: req.prompt,
      negativePrompt: req.negativePrompt,
      contentClass: 'photo',
      numVariations: 1,
      size: req.aspectRatio === '9:16' ? { width: 1080, height: 1920 }
          : req.aspectRatio === '16:9' ? { width: 1920, height: 1080 }
          : req.aspectRatio === '4:5' ? { width: 1080, height: 1350 }
          : { width: 1080, height: 1080 },
      photoSettings: { aperture: 2.8, shutterSpeed: 200, fieldOfView: 35 },
    }),
  });

  if (!res.ok) throw new Error(`Firefly API error ${res.status}: ${await res.text()}`);
  const data = await res.json() as { outputs?: Array<{ image: { presignedUrl: string } }> };
  const url = data.outputs?.[0]?.image?.presignedUrl;
  if (!url) throw new Error('Firefly returned no image URL');
  return url;
}

// ---------------------------------------------------------------------------
// Stable Diffusion XL (via Stability AI)
// https://platform.stability.ai/docs/api-reference
// ---------------------------------------------------------------------------

async function generateStableDiffusion(req: GenerativeRequest): Promise<string> {
  const apiKey = process.env.STABILITY_AI_API_KEY;
  if (!apiKey) throw new Error('STABILITY_AI_API_KEY not configured');

  const [width, height] = req.aspectRatio === '9:16' ? [1080, 1920]
    : req.aspectRatio === '16:9' ? [1344, 768]
    : req.aspectRatio === '4:5' ? [1008, 1260]
    : [1024, 1024];

  const res = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      text_prompts: [
        { text: req.prompt, weight: 1 },
        ...(req.negativePrompt ? [{ text: req.negativePrompt, weight: -1 }] : []),
      ],
      cfg_scale: 7,
      height,
      width,
      samples: 1,
      steps: 30,
      ...(req.seed !== undefined && { seed: req.seed }),
    }),
  });

  if (!res.ok) throw new Error(`Stability AI error ${res.status}: ${await res.text()}`);
  const data = await res.json() as { artifacts?: Array<{ base64: string }> };
  const base64 = data.artifacts?.[0]?.base64;
  if (!base64) throw new Error('Stability AI returned no image');

  // Return data URL (caller should upload to Supabase Storage)
  return `data:image/png;base64,${base64}`;
}

// ---------------------------------------------------------------------------
// Runway Gen-3 Alpha Turbo
// https://docs.dev.runwayml.com/
// ---------------------------------------------------------------------------

async function generateRunway(req: GenerativeRequest): Promise<string> {
  const apiKey = process.env.RUNWAY_API_KEY;
  if (!apiKey) throw new Error('RUNWAY_API_KEY not configured');

  // Create generation task
  const createRes = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Runway-Version': '2024-11-06',
    },
    body: JSON.stringify({
      promptText: req.prompt,
      model: 'gen3a_turbo',
      duration: Math.min(req.durationSeconds ?? 10, 10),
      ratio: req.aspectRatio === '9:16' ? '720:1280' : '1280:720',
      ...(req.referenceImageUrl && { promptImage: req.referenceImageUrl }),
    }),
  });

  if (!createRes.ok) throw new Error(`Runway API error ${createRes.status}: ${await createRes.text()}`);
  const task = await createRes.json() as { id: string };

  // Poll for completion (max 2 minutes)
  const maxAttempts = 24;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 5000)); // 5s intervals

    const pollRes = await fetch(`https://api.dev.runwayml.com/v1/tasks/${task.id}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'X-Runway-Version': '2024-11-06',
      },
    });

    const status = await pollRes.json() as { status: string; output?: string[] };
    if (status.status === 'SUCCEEDED' && status.output?.[0]) {
      return status.output[0];
    }
    if (status.status === 'FAILED') {
      throw new Error('Runway generation failed');
    }
  }

  throw new Error('Runway generation timed out');
}

// ---------------------------------------------------------------------------
// Kling AI (via Kuaishou)
// https://klingai.com/api/docs
// ---------------------------------------------------------------------------

async function generateKling(req: GenerativeRequest): Promise<string> {
  const apiKey = process.env.KLING_AI_API_KEY;
  if (!apiKey) throw new Error('KLING_AI_API_KEY not configured');

  const createRes = await fetch('https://api.klingai.com/v1/videos/text2video', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'kling-v1',
      prompt: req.prompt,
      negative_prompt: req.negativePrompt ?? '',
      cfg_scale: 0.5,
      mode: 'std',
      duration: String(Math.min(req.durationSeconds ?? 5, 10)),
      aspect_ratio: req.aspectRatio === '9:16' ? '9:16' : '16:9',
    }),
  });

  if (!createRes.ok) throw new Error(`Kling AI error ${createRes.status}: ${await createRes.text()}`);
  const task = await createRes.json() as { data: { task_id: string } };
  const taskId = task.data.task_id;

  // Poll
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 5000));

    const pollRes = await fetch(`https://api.klingai.com/v1/videos/text2video/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    const result = await pollRes.json() as {
      data: { task_status: string; task_result?: { videos?: Array<{ url: string }> } }
    };

    if (result.data.task_status === 'succeed') {
      const url = result.data.task_result?.videos?.[0]?.url;
      if (!url) throw new Error('Kling returned no video URL');
      return url;
    }
    if (result.data.task_status === 'failed') {
      throw new Error('Kling generation failed');
    }
  }

  throw new Error('Kling generation timed out');
}

// ---------------------------------------------------------------------------
// Pika Labs 2.0
// https://pika.art/api
// ---------------------------------------------------------------------------

async function generatePika(req: GenerativeRequest): Promise<string> {
  const apiKey = process.env.PIKA_API_KEY;
  if (!apiKey) throw new Error('PIKA_API_KEY not configured');

  const res = await fetch('https://api.pika.art/generate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      promptText: req.prompt,
      negativePrompt: req.negativePrompt,
      frameRate: 24,
      resolution: '1080p',
      duration: Math.min(req.durationSeconds ?? 5, 15),
      aspectRatio: req.aspectRatio ?? '16:9',
    }),
  });

  if (!res.ok) throw new Error(`Pika Labs API error ${res.status}: ${await res.text()}`);

  type PikaResponse = {
    videos?: Array<{ resultUrl: string }>;
    video?: { resultUrl: string };
  };
  const data = await res.json() as PikaResponse;
  const url = data.videos?.[0]?.resultUrl ?? data.video?.resultUrl;
  if (!url) throw new Error('Pika returned no video URL');
  return url;
}

// ---------------------------------------------------------------------------
// Veo 3 (Google DeepMind)
// Via Vertex AI — requires Google Cloud project
// ---------------------------------------------------------------------------

async function generateVeo3(req: GenerativeRequest): Promise<string> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1';
  if (!projectId) throw new Error('GOOGLE_CLOUD_PROJECT_ID not configured');

  // Get access token from service account
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — google-auth-library is an optional peer dependency for Veo3
  const { GoogleAuth } = await import('google-auth-library');
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token;

  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/veo-003:generateVideo`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      instances: [{ prompt: req.prompt }],
      parameters: {
        sampleCount: 1,
        durationSeconds: Math.min(req.durationSeconds ?? 8, 60),
        aspectRatio: req.aspectRatio ?? '16:9',
      },
    }),
  });

  if (!res.ok) throw new Error(`Veo 3 API error ${res.status}: ${await res.text()}`);
  const data = await res.json() as { predictions?: Array<{ video: { uri: string } }> };
  const uri = data.predictions?.[0]?.video?.uri;
  if (!uri) throw new Error('Veo 3 returned no video URI');
  return uri;
}

// ---------------------------------------------------------------------------
// Sora 2 (OpenAI) — API access via waitlist / enterprise
// ---------------------------------------------------------------------------

async function generateSora(req: GenerativeRequest): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const res = await fetch('https://api.openai.com/v1/videos/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sora-v2',
      prompt: req.prompt,
      duration: Math.min(req.durationSeconds ?? 10, 60),
      resolution: req.aspectRatio === '9:16' ? '480x854' : '1280x720',
      n: 1,
    }),
  });

  if (!res.ok) throw new Error(`Sora API error ${res.status}: ${await res.text()}`);
  const data = await res.json() as { data?: Array<{ url: string }> };
  const url = data.data?.[0]?.url;
  if (!url) throw new Error('Sora returned no video URL');
  return url;
}

// ---------------------------------------------------------------------------
// Main router function
// ---------------------------------------------------------------------------

export async function generate(req: GenerativeRequest): Promise<GenerativeResult> {
  const start = Date.now();
  const assetType = MODEL_CAPABILITIES[req.model]?.type ?? 'image';

  logger.info({ model: req.model, assetType }, 'Starting generative request');

  let assetUrl: string;

  try {
    switch (req.model) {
      case 'firefly':           assetUrl = await generateFirefly(req); break;
      case 'stable-diffusion':  assetUrl = await generateStableDiffusion(req); break;
      case 'runway-gen3':       assetUrl = await generateRunway(req); break;
      case 'kling-ai':          assetUrl = await generateKling(req); break;
      case 'pika-labs':         assetUrl = await generatePika(req); break;
      case 'veo3':              assetUrl = await generateVeo3(req); break;
      case 'sora2':             assetUrl = await generateSora(req); break;
      default:
        throw new Error(`Unknown model: ${req.model}`);
    }
  } catch (err) {
    logger.error({ err, model: req.model }, 'Generative request failed');
    throw err;
  }

  const durationMs = Date.now() - start;
  logger.info({ model: req.model, durationMs }, 'Generative request complete');

  return {
    model: req.model,
    assetType,
    assetUrl,
    durationMs,
    promptUsed: req.prompt,
  };
}

// ---------------------------------------------------------------------------
// Select best model for a given brief
// ---------------------------------------------------------------------------

export function selectModel(
  assetType: GenerativeAssetType,
  platform: 'GOOGLE' | 'META',
  priority: 'quality' | 'speed' | 'cost' = 'quality'
): GenerativeModel {
  if (assetType === 'image') {
    return priority === 'cost' ? 'stable-diffusion' : 'firefly';
  }

  // Video model selection
  if (priority === 'speed') return 'pika-labs';
  if (priority === 'cost') return 'kling-ai';

  // Quality: prefer Veo 3 for Google (same ecosystem), Runway for Meta (wider support)
  return platform === 'GOOGLE' ? 'veo3' : 'runway-gen3';
}
