'use client';

import { createTRPCReact } from '@trpc/react-query';

/**
 * tRPC React hooks client.
 *
 * The generic type parameter is intentionally omitted here because the
 * AppRouter type lives in the server package and would create a circular
 * dependency if imported at the module level.  The typed router is inferred
 * at call-site when the tRPC provider wraps the app (see providers.jsx).
 *
 * Usage in any client component:
 *   import { trpc } from '@/lib/trpc-client';
 *   const { data } = trpc.analytics.dashboard.useQuery();
 */
export const trpc = createTRPCReact();
