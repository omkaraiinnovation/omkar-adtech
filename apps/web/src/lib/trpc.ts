import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@omkar-adtech/api';

// Full end-to-end type safety via the AppRouter type exported from the API package.
// `import type` ensures zero server-side code is bundled into the client.
export const trpc = createTRPCReact<AppRouter>();
