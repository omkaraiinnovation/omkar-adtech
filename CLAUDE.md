# CLAUDE.md — Omkar AI Innovation Ad-Tech Platform

## Project Goal
World-class AI marketing engine: Google Ads + Meta Ads + WhatsApp automation.
Drive registrations for 'AI Unlock All' live workshops.
Target: Billion-dollar global entity | Proprietary, Confidential Blueprint.

## Tech Stack
- Frontend: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, Three.js
- Backend: Node.js, Express, tRPC, Prisma ORM
- Database: PostgreSQL (Supabase), Redis (Upstash)
- Streaming: Kafka (Upstash Serverless)
- AI: Claude Sonnet API (claude-sonnet-4-6), LangGraph
- Deployment: Vercel (web) + Railway (api)
- Auth: Clerk
- Monitoring: Sentry + Datadog + PostHog

## Monorepo Structure
- `apps/web/` — Next.js 14 frontend (port 3000)
- `apps/api/` — Express.js backend (port 4000)
- `packages/types/` — Shared TypeScript interfaces
- `packages/ui/` — Shared component library
- `packages/config/` — Shared ESLint, TS, Tailwind configs
- Tool: pnpm workspaces + Turborepo

## Code Standards
- TypeScript strict mode everywhere (`"strict": true` in tsconfig)
- tRPC with Zod validation for ALL API routes — no untyped routes
- Tailwind utility classes only (no custom CSS files, no inline styles)
- Vitest + React Testing Library for all tests
- MSW for API mocking in tests
- Playwright for E2E tests

## Naming Conventions
- Components: PascalCase (`GlassCard.tsx`, `KPICard.tsx`)
- Files/dirs: kebab-case (`lead-router.ts`, `ucb-engine.ts`)
- tRPC procedures: camelCase (`getCampaigns`, `createCampaign`)
- Env vars: UPPER_SNAKE_CASE

## Core Conventions
- Dark Glassmorphism UI ONLY — no light mode, no white backgrounds ever
- Currency: stored in INR paisa (integer × 100), displayed as ₹ rupees
- Multi-agent system uses LangGraph StateGraph pattern
- WhatsApp: Cloud API via Meta Graph API v20.0 only
- All secrets in Doppler vault — NEVER hardcode credentials
- All PII fields encrypted at rest (CMEK in Supabase)
- Rate limiting on all public endpoints: 100 req/min per IP via Upstash Redis
- PDPB compliance: consent capture, right-to-deletion API required

## AI Agent Architecture (6 Agents)
1. Creative Assembly Agent — builds ad variants from brand library
2. Context Evaluation Agent — selects optimal creative per audience/time
3. Generative Output Agent — generates copy/images/video prompts for 7 AI models
4. Compliance Auditor Agent — validates against Meta + Google policies (threshold: 0.85)
5. Identity Resolution Agent — cookieless personalization via cohort signals
6. Performance Monitor Agent — real-time ROAS monitoring + anomaly detection (CUSUM)

## MAB Budget Engine
- Algorithm: UCB1 + CUSUM change-point detection
- Cold start: Thompson Sampling (beta dist) for first 24h
- Redis key: `mab:arm:{campaignId}:{adSetId}:{creativeId}`
- Recalibration trigger: CUSUM threshold h=5.0 exceeded

## WhatsApp FSM States
INITIAL → AWAITING_REPLY → QUALIFYING → QUALIFIED/NURTURING → HUMAN_HANDOFF/REMINDER_SEQUENCE → ATTENDING/LOST/WINDOW_EXPIRED

## Database Models (9)
User, Campaign, AdSet, Creative, Lead, WhatsAppConversation, BudgetAllocation, AgentLog, ComplianceAudit

## Kafka Topics
ad.metrics.polled | lead.captured | creative.generated | budget.reallocated | conversion.event | anomaly.detected | whatsapp.msg.received

## Active Claude Code Workflow
- Start every session with /init to load this file
- Use /plan before implementing any new feature
- Prefix complex reasoning with: "Think step by step before answering:"
- Commit with: "Commit all changes with message: feat(<scope>): <description>"
- Run `pnpm turbo build` after major changes to catch TypeScript errors early
- Run `pnpm vitest run` after logic changes
- Run `pnpm playwright test` after UI changes

## Phase Status
- [x] Phase 0 — Claude Code Init + CLAUDE.md
- [x] Phase 1 — Monorepo, Auth, DB Schema, CI/CD
      - pnpm workspaces + Turborepo, Next.js 14, Express+tRPC, Prisma 9-model schema
      - Clerk auth, shared Tailwind tokens, Dark Glassmorphism CSS
      - All 10 dashboard components: KPICard, GlassCard, PerformanceChart, AgentActivityFeed,
        CampaignTable, BudgetHeatmap, LeadPipeline, DashboardNav, Sidebar, Skeleton
      - Dev server running on port 3000 (start-omkar-adtech.js launcher)
- [x] Phase 2 — Google Ads + Meta API Integration Layer
      - apps/api/src/lib/google-ads.ts — Google Ads REST API v17, OAuth2, GAQL queries
      - apps/api/src/lib/meta-ads.ts — Meta Graph API v20.0, CAPI, HMAC verification
      - apps/api/src/lib/normalizer.ts — Unified metrics normalizer (paisa convention)
      - apps/api/src/lib/metrics-poller.ts — 15-minute cron, Redis cache invalidation
      - tRPC campaigns router updated: pause/resume + platform API calls, launchForecast (Claude)
      - tRPC leads router: sendEnrollmentCAPI procedure
      - Prisma schema: BudgetAllocation @@unique([campaignId, date]), platform field added
- [x] Phase 3 — Multi-Agent System + Generative AI Engine
      - apps/api/src/agents/state.ts — LangGraph AdTechAgentStateAnnotation
      - apps/api/src/agents/nodes.ts — 6 agent nodes (all using claude-sonnet-4-6)
      - apps/api/src/agents/pipeline.ts — StateGraph with parallel IdentityResolution + PerformanceMonitor
      - apps/api/src/lib/generative.ts — 7-model abstraction (Veo3, Sora2, Runway, Kling, Pika, Firefly, SDXL)
      - tRPC agents router: runCreativePipeline (async), getPipelineStatus
- [x] Phase 4 — MAB Budget Engine
      - apps/api/src/lib/mab-engine.ts — UCB1 + Thompson Sampling cold-start + CUSUM
      - tRPC budget router: triggerMAB, recordArmReward procedures
- [x] Phase 5 — Lead Capture + Webhook Middleware + CRM Sync
      - apps/api/src/routes/webhooks.ts — Meta Lead Ads, WhatsApp FSM, Google Lead Form poller
      - HMAC-SHA256 signature verification on all webhooks
      - Meta CAPI enrollment events, Slack notifications
- [x] Phase 6 — WhatsApp Cloud API + FSM Automation
      - apps/api/src/lib/whatsapp-fsm.ts — 7-state FSM, Claude intent scorer (threshold 70)
      - 5 Meta-approved templates, human handoff via Slack
- [x] Phase 7 — Dark Glassmorphism Dashboard UI
      - /campaigns — list with filters, stats
      - /campaigns/[id] — detail with metrics chart, AI forecast, pause/resume
      - /leads — Kanban + list view with search/filters
      - /creatives — grid with compliance scores
      - /budgets — UCB1 MAB allocation panel
      - /agents — agent log feed with stats
- [x] Phase 8 — QA, Testing & Deployment Infrastructure
      - Vitest unit tests: 41/41 passing (UCB1 MAB, Thompson Sampling, CUSUM, normalizer)
      - Playwright E2E tests: smoke + auth + dashboard + page structure suites
        (apps/web/tests/e2e/{smoke,auth,dashboard,pages}.spec.ts)
      - Rate limiting middleware: Upstash Redis sliding window (100/300/20 req/min tiers)
        (apps/api/src/middleware/rateLimit.ts)
      - Railway deployment: Dockerfile + railway.json (apps/api/)
      - Vercel deployment: vercel.json with bom1 region + security headers (apps/web/)
      - GitHub Actions deploy workflow (.github/workflows/deploy.yml)
      - React error boundary: ErrorBoundary component + Next.js error.tsx + not-found.tsx
        (apps/web/src/components/ui/ErrorBoundary.tsx)
      - Dashboard layout wrapped with DashboardErrorBoundary

## Key Files (Phase 2+)
- apps/api/src/lib/google-ads.ts — Google Ads API v17
- apps/api/src/lib/meta-ads.ts — Meta Graph API v20.0
- apps/api/src/lib/normalizer.ts — Metrics normalizer (Google micros → paisa, Meta string → paisa)
- apps/api/src/lib/metrics-poller.ts — 15-min cron
- apps/api/src/lib/mab-engine.ts — UCB1+CUSUM budget allocator
- apps/api/src/lib/whatsapp-fsm.ts — 7-state WhatsApp FSM
- apps/api/src/lib/generative.ts — 7-model generative abstraction
- apps/api/src/agents/pipeline.ts — LangGraph 6-agent StateGraph
- apps/api/src/middleware/rateLimit.ts — Upstash Redis sliding window rate limiter
- apps/api/Dockerfile — Multi-stage build for Railway
- apps/api/railway.json — Railway deploy config (2 replicas, ap-south-1)
- apps/web/vercel.json — Vercel deploy config (bom1, security headers)
- apps/web/playwright.config.ts — E2E test config
- apps/web/tests/e2e/ — Playwright test suites
- apps/web/src/components/ui/ErrorBoundary.tsx — React error boundary
- apps/web/src/app/(dashboard)/error.tsx — Next.js segment error boundary
