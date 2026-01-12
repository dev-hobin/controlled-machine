/**
 * Type inference tests
 *
 * These tests verify TypeScript type inference at compile time.
 * If types are wrong, TypeScript will error during build.
 */

import { describe, it, expectTypeOf } from 'vitest'
import { createMachine, type AllPayloads } from '../index'

// Test types
type TestInput = {
  isOpen: boolean
  items: { id: string; name: string }[]
  onSelect: (id: string) => void
}

type TestEvents = {
  OPEN: undefined
  CLOSE: undefined
  SELECT: { id: string }
  UPDATE_ITEMS: { items: { id: string; name: string }[] }
}

type TestComputed = {
  hasItems: boolean
}

type TestActions = 'open' | 'close' | 'select' | 'updateItems'
type TestGuards = 'isOpen' | 'isClosed' | 'hasItems'

describe('Type Inference', () => {
  describe('AllPayloads utility type', () => {
    it('should be union of all event payloads', () => {
      type Payloads = AllPayloads<{
        events: TestEvents
      }>

      // AllPayloads should be: undefined | { id: string } | { items: ... }
      expectTypeOf<Payloads>().toEqualTypeOf<
        undefined | { id: string } | { items: { id: string; name: string }[] }
      >()
    })
  })

  describe('Inline handler in on', () => {
    it('should infer specific payload type for inline handler', () => {
      createMachine<{
        input: TestInput
        events: TestEvents
        computed: TestComputed
        actions: TestActions
        guards: TestGuards
      }>({
        computed: {
          hasItems: (input) => input.items.length > 0,
        },
        on: {
          // Inline handler - should have specific payload type
          SELECT: (ctx, payload) => {
            // payload should be { id: string }, not union
            expectTypeOf(payload).toEqualTypeOf<{ id: string }>()
            expectTypeOf(ctx.isOpen).toEqualTypeOf<boolean>()
            expectTypeOf(ctx.hasItems).toEqualTypeOf<boolean>()
          },

          UPDATE_ITEMS: (ctx, payload) => {
            // payload should be { items: ... }
            expectTypeOf(payload).toEqualTypeOf<{
              items: { id: string; name: string }[]
            }>()
          },

          OPEN: (ctx, payload) => {
            // payload should be undefined for events with no payload
            expectTypeOf(payload).toEqualTypeOf<undefined>()
          },
        },
        actions: {
          open: () => {},
          close: () => {},
          select: () => {},
          updateItems: () => {},
        },
        guards: {
          isOpen: (ctx) => ctx.isOpen,
          isClosed: (ctx) => !ctx.isOpen,
          hasItems: (ctx) => ctx.hasItems,
        },
      })
    })
  })

  describe('Named action payload type', () => {
    it('should have union payload type for named actions', () => {
      createMachine<{
        input: TestInput
        events: TestEvents
        computed: TestComputed
        actions: TestActions
        guards: TestGuards
      }>({
        computed: {
          hasItems: (input) => input.items.length > 0,
        },
        on: {
          SELECT: 'select',
          UPDATE_ITEMS: 'updateItems',
        },
        actions: {
          open: () => {},
          close: () => {},
          select: (ctx, payload) => {
            // payload is union type - need type guard
            expectTypeOf(payload).toEqualTypeOf<
              | undefined
              | { id: string }
              | { items: { id: string; name: string }[] }
              | undefined // from optional
            >()

            // Type guard narrows the type
            if (payload && 'id' in payload) {
              expectTypeOf(payload.id).toEqualTypeOf<string>()
            }
          },
          updateItems: (ctx, payload) => {
            // Same union type
            if (payload && 'items' in payload) {
              expectTypeOf(payload.items).toEqualTypeOf<
                { id: string; name: string }[]
              >()
            }
          },
        },
        guards: {
          isOpen: (ctx) => ctx.isOpen,
          isClosed: (ctx) => !ctx.isOpen,
          hasItems: (ctx) => ctx.hasItems,
        },
      })
    })
  })

  describe('Guard payload type', () => {
    it('should have optional union payload type for guards', () => {
      createMachine<{
        input: TestInput
        events: TestEvents
        computed: TestComputed
        actions: TestActions
        guards: TestGuards
      }>({
        computed: {
          hasItems: (input) => input.items.length > 0,
        },
        on: {
          SELECT: [{ when: 'hasItems', do: 'select' }],
        },
        actions: {
          open: () => {},
          close: () => {},
          select: () => {},
          updateItems: () => {},
        },
        guards: {
          isOpen: (ctx, payload) => {
            // payload is optional union type
            expectTypeOf(payload).toEqualTypeOf<
              | undefined
              | { id: string }
              | { items: { id: string; name: string }[] }
              | undefined
            >()
            return ctx.isOpen
          },
          isClosed: (ctx) => !ctx.isOpen,
          hasItems: (ctx) => ctx.hasItems,
        },
      })
    })
  })

  describe('Inline guard in Rule', () => {
    it('should infer specific payload type for inline guard', () => {
      createMachine<{
        input: TestInput
        events: TestEvents
        computed: TestComputed
        actions: TestActions
      }>({
        computed: {
          hasItems: (input) => input.items.length > 0,
        },
        on: {
          SELECT: [
            {
              // Inline guard - should have specific payload type
              when: (ctx, payload) => {
                expectTypeOf(payload).toEqualTypeOf<{ id: string }>()
                return payload.id !== ''
              },
              do: 'select',
            },
          ],
          UPDATE_ITEMS: [
            {
              when: (ctx, payload) => {
                expectTypeOf(payload).toEqualTypeOf<{
                  items: { id: string; name: string }[]
                }>()
                return payload.items.length > 0
              },
              do: 'updateItems',
            },
          ],
        },
        actions: {
          open: () => {},
          close: () => {},
          select: () => {},
          updateItems: () => {},
        },
      })
    })
  })
})
