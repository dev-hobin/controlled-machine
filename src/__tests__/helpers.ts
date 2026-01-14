/**
 * Shared Test Helpers
 *
 * Reusable machine factories and utilities for testing.
 * These helpers reduce boilerplate in test files.
 */

import { createMachine } from '../index'

// ============================================
// Common Machine Factories
// ============================================

/**
 * Create a counter machine with internal state
 * Uses assign to update count instead of external setter
 *
 * @param initialCount - Starting count value (default: 0)
 * @returns Machine instance with INCREMENT/DECREMENT events
 *
 * @example
 * const machine = createInternalCounterMachine(10)
 * machine.send('INCREMENT', {})
 * expect(machine.getSnapshot({}).currentCount).toBe(11)
 */
export function createInternalCounterMachine(initialCount = 0) {
  return createMachine<{
    input: {}
    internal: { count: number }
    events: { INCREMENT: undefined; DECREMENT: undefined }
    computed: { currentCount: number }
  }>({
    internal: { count: initialCount },
    computed: {
      currentCount: (ctx) => ctx.count,
    },
    on: {
      INCREMENT: (ctx, _, assign) => assign({ count: ctx.count + 1 }),
      DECREMENT: (ctx, _, assign) => assign({ count: ctx.count - 1 }),
    },
  })
}
