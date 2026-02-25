import { router } from './trpc';
import { campaignsRouter } from './routes/campaigns';
import { leadsRouter } from './routes/leads';
import { creativesRouter } from './routes/creatives';
import { budgetRouter } from './routes/budget';
import { agentsRouter } from './routes/agents-trpc';
import { dashboardRouter } from './routes/dashboard';

export const appRouter = router({
  campaigns: campaignsRouter,
  leads: leadsRouter,
  creatives: creativesRouter,
  budget: budgetRouter,
  agents: agentsRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;
