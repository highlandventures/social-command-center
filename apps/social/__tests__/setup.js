/**
 * Vitest global setup file.
 * Mocks heavy dependencies (Prisma, external APIs) so unit tests
 * can run without a database or network access.
 */

import { vi } from 'vitest';

// Mock Prisma client — prevents PrismaClientInitializationError in unit tests
vi.mock('@/lib/db', () => ({
  prisma: {
    aPICallLog: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    account: {
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

// Mock the AI generateInsight function — prevents Anthropic API calls
vi.mock('@/lib/ai', () => ({
  generateInsight: vi.fn().mockResolvedValue({}),
}));
