/**
 * Type Inference Tests
 *
 * Compile-time tests verifying the type system works correctly.
 * Uses vitest's expectTypeOf for type-level assertions.
 *
 * Key test areas:
 * - Key overlap detection (Input/Internal/Computed conflicts → never)
 * - State key conflict detection (FSM state vs Internal/Computed)
 * - Context flattening (Input + Internal + Computed)
 * - Snapshot structure (Internal + Computed + state, excludes Input)
 * - Event payload inference
 * - Type extraction helpers
 */

import { describe, it, expectTypeOf } from 'vitest'
import type {
  MachineTypes,
  Context,
  Snapshot,
  Send,
  Input,
  Internal,
  Computed,
  State,
} from '../index'

// ============================================
// Key Overlap Detection Tests
// Verifies that overlapping keys between Input/Internal/Computed
// result in Context becoming 'never' (compile-time error)
// ============================================

describe('Key Overlap Detection', () => {
  describe('Input/Internal overlap', () => {
    it('should make Context never when Input and Internal have same key', () => {
      type T = { input: { x: number }; internal: { x: string } }
      expectTypeOf<Context<T>>().toBeNever()
    })

    it('should allow Context when Input and Internal have different keys', () => {
      type T = { input: { a: number }; internal: { b: string } }
      expectTypeOf<Context<T>>().toHaveProperty('a')
      expectTypeOf<Context<T>>().toHaveProperty('b')
    })
  })

  describe('Input/Computed overlap', () => {
    it('should make Context never when Input and Computed have same key', () => {
      type T = { input: { x: number }; computed: { x: number } }
      expectTypeOf<Context<T>>().toBeNever()
    })

    it('should allow Context when Input and Computed have different keys', () => {
      type T = { input: { a: number }; computed: { b: number } }
      expectTypeOf<Context<T>>().toHaveProperty('a')
      expectTypeOf<Context<T>>().toHaveProperty('b')
    })
  })

  describe('Internal/Computed overlap', () => {
    it('should make Context never when Internal and Computed have same key', () => {
      type T = { internal: { x: number }; computed: { x: number } }
      expectTypeOf<Context<T>>().toBeNever()
    })

    it('should allow Context when Internal and Computed have different keys', () => {
      type T = { internal: { a: number }; computed: { b: number } }
      expectTypeOf<Context<T>>().toHaveProperty('a')
      expectTypeOf<Context<T>>().toHaveProperty('b')
    })
  })

  describe('Multiple overlaps', () => {
    it('should make Context never with triple overlap', () => {
      type T = { input: { x: number }; internal: { x: string }; computed: { x: boolean } }
      expectTypeOf<Context<T>>().toBeNever()
    })

    it('should make Context never with partial overlap', () => {
      // Input and Computed overlap, Internal is fine
      type T = { input: { a: number }; internal: { b: string }; computed: { a: boolean } }
      expectTypeOf<Context<T>>().toBeNever()
    })
  })
})

// ============================================
// State Key Conflict Detection Tests
// Verifies that 'state' key in Internal/Computed works with FSM state definition
// When Internal/Computed already has 'state', we use that instead of adding duplicate
// ============================================

describe('State Key Handling', () => {
  describe('Internal state key with FSM state', () => {
    it('should use internal.state when Internal has state key and FSM state is defined', () => {
      type T = { internal: { state: string }; state: 'idle' | 'active' }
      // Snapshot should have 'state' from internal, not be 'never'
      expectTypeOf<Snapshot<T>>().toHaveProperty('state')
    })

    it('should allow Snapshot when Internal has state key but no FSM state', () => {
      type T = { internal: { state: string } }
      expectTypeOf<Snapshot<T>>().toHaveProperty('state')
    })
  })

  describe('Computed state key with FSM state', () => {
    it('should use computed.state when Computed has state key and FSM state is defined', () => {
      type T = { computed: { state: string }; state: 'idle' | 'active' }
      // Snapshot should have 'state' from computed, not be 'never'
      expectTypeOf<Snapshot<T>>().toHaveProperty('state')
    })

    it('should allow Snapshot when Computed has state key but no FSM state', () => {
      type T = { computed: { state: string } }
      expectTypeOf<Snapshot<T>>().toHaveProperty('state')
    })
  })

  describe('No conflict', () => {
    it('should allow Snapshot with FSM state and no state key in Internal/Computed', () => {
      type T = { internal: { count: number }; state: 'idle' | 'active' }
      expectTypeOf<Snapshot<T>>().toHaveProperty('count')
      expectTypeOf<Snapshot<T>>().toHaveProperty('state')
    })
  })

  describe('Internal.state with FSM state (common pattern)', () => {
    it('should preserve internal.state type in Snapshot', () => {
      // Common FSM pattern: internal.state holds the actual state value
      type T = {
        internal: { state: 'idle' | 'loading' | 'error' }
        events: { FETCH: undefined; SUCCESS: undefined }
        state: 'idle' | 'loading' | 'error'
      }
      type Snap = Snapshot<T>

      // Snapshot should have 'state' with the correct type from internal
      expectTypeOf<Snap>().toHaveProperty('state')
      expectTypeOf<Snap['state']>().toEqualTypeOf<'idle' | 'loading' | 'error'>()
    })

    it('should work with additional internal properties', () => {
      type T = {
        internal: { state: 'idle' | 'active'; count: number; isOpen: boolean }
        state: 'idle' | 'active'
      }
      type Snap = Snapshot<T>

      // All internal properties should be in Snapshot
      expectTypeOf<Snap>().toHaveProperty('state')
      expectTypeOf<Snap>().toHaveProperty('count')
      expectTypeOf<Snap>().toHaveProperty('isOpen')
      expectTypeOf<Snap['state']>().toEqualTypeOf<'idle' | 'active'>()
      expectTypeOf<Snap['count']>().toEqualTypeOf<number>()
    })

    it('should work with computed alongside internal.state', () => {
      type T = {
        internal: { state: 'idle' | 'loading'; progress: number }
        computed: { isLoading: boolean; progressPercent: string }
        state: 'idle' | 'loading'
      }
      type Snap = Snapshot<T>

      // Both internal and computed should be in Snapshot
      expectTypeOf<Snap>().toHaveProperty('state')
      expectTypeOf<Snap>().toHaveProperty('progress')
      expectTypeOf<Snap>().toHaveProperty('isLoading')
      expectTypeOf<Snap>().toHaveProperty('progressPercent')
    })

    it('should exclude input when using internal.state FSM pattern', () => {
      type T = {
        input: { onSuccess: () => void; onError: (msg: string) => void }
        internal: { state: 'idle' | 'loading' | 'error'; errorMessage: string }
        state: 'idle' | 'loading' | 'error'
      }
      type Snap = Snapshot<T>

      // Input should NOT be in Snapshot
      type HasOnSuccess = 'onSuccess' extends keyof Snap ? true : false
      type HasOnError = 'onError' extends keyof Snap ? true : false
      expectTypeOf<HasOnSuccess>().toEqualTypeOf<false>()
      expectTypeOf<HasOnError>().toEqualTypeOf<false>()

      // Internal should be in Snapshot
      expectTypeOf<Snap>().toHaveProperty('state')
      expectTypeOf<Snap>().toHaveProperty('errorMessage')
    })
  })
})

// ============================================
// Context Flattening Tests
// Verifies Input + Internal + Computed merge into flat Context
// All properties accessible at the same level
// ============================================

describe('Context Flattening', () => {
  it('should flatten Input + Internal + Computed into single object', () => {
    type T = {
      input: { items: string[] }
      internal: { isOpen: boolean }
      computed: { count: number }
    }
    type Ctx = Context<T>

    expectTypeOf<Ctx>().toHaveProperty('items')
    expectTypeOf<Ctx>().toHaveProperty('isOpen')
    expectTypeOf<Ctx>().toHaveProperty('count')
  })

  it('should preserve property types', () => {
    type T = {
      input: { items: string[] }
      internal: { isOpen: boolean }
      computed: { count: number }
    }
    type Ctx = Context<T>

    expectTypeOf<Ctx['items']>().toEqualTypeOf<string[]>()
    expectTypeOf<Ctx['isOpen']>().toEqualTypeOf<boolean>()
    expectTypeOf<Ctx['count']>().toEqualTypeOf<number>()
  })
})

// ============================================
// Snapshot Structure Tests
// Verifies Snapshot = Internal + Computed + state (excludes Input)
// This is the return value of getSnapshot() and useMachine()
// ============================================

describe('Snapshot Structure', () => {
  it('should include Internal but exclude Input', () => {
    type T = {
      input: { items: string[] }
      internal: { isOpen: boolean }
    }
    type Snap = Snapshot<T>

    expectTypeOf<Snap>().toHaveProperty('isOpen')
    // Input should not be in Snapshot - verify by checking items is not accessible
    type HasItems = 'items' extends keyof Snap ? true : false
    expectTypeOf<HasItems>().toEqualTypeOf<false>()
  })

  it('should include Computed', () => {
    type T = {
      internal: { count: number }
      computed: { doubled: number }
    }
    type Snap = Snapshot<T>

    expectTypeOf<Snap>().toHaveProperty('count')
    expectTypeOf<Snap>().toHaveProperty('doubled')
  })

  it('should include state when FSM state is defined', () => {
    type T = {
      internal: { count: number }
      state: 'idle' | 'active'
    }
    type Snap = Snapshot<T>

    expectTypeOf<Snap>().toHaveProperty('state')
    expectTypeOf<Snap['state']>().toEqualTypeOf<'idle' | 'active'>()
  })

  it('should not include state property when FSM state is not defined', () => {
    type T = {
      internal: { count: number }
    }
    type Snap = Snapshot<T>

    expectTypeOf<Snap>().toHaveProperty('count')
    // Verify 'state' is not a key in Snapshot
    type HasState = 'state' extends keyof Snap ? true : false
    expectTypeOf<HasState>().toEqualTypeOf<false>()
  })
})

// ============================================
// Event Payload Inference Tests
// Verifies Send function type requires correct payload types
// undefined events: no payload required, defined events: payload required
// ============================================

describe('Event Payload Inference', () => {
  it('should require payload for events with defined payload type', () => {
    type TEvents = { SET: { value: number } }
    type SendFn = Send<TEvents>

    // This tests the function signature
    expectTypeOf<SendFn>().toBeFunction()
    // Verify it's callable with event name and payload
    expectTypeOf<SendFn>().toBeCallableWith('SET', { value: 1 })
  })

  it('should allow call without payload for undefined events', () => {
    type TEvents = { CLICK: undefined }
    type SendFn = Send<TEvents>

    expectTypeOf<SendFn>().toBeFunction()
    // Verify it's callable with just event name
    expectTypeOf<SendFn>().toBeCallableWith('CLICK')
  })

  it('should handle mixed event types', () => {
    type TEvents = { CLICK: undefined; SET: { value: number } }
    type SendFn = Send<TEvents>

    expectTypeOf<SendFn>().toBeFunction()
    // Verify both event types are valid keys
    expectTypeOf<SendFn>().parameter(0).toEqualTypeOf<'CLICK' | 'SET'>()
  })
})

// ============================================
// Type Extraction Tests
// Verifies Input<T>, Internal<T>, Computed<T>, State<T>
// extract correct types from MachineTypes
// ============================================

describe('Type Extraction', () => {
  describe('Input extraction', () => {
    it('should extract Input type', () => {
      type T = { input: { foo: string } }
      expectTypeOf<Input<T>>().toEqualTypeOf<{ foo: string }>()
    })

    it('should default to empty object when not defined', () => {
      type T = {}
      expectTypeOf<Input<T>>().toEqualTypeOf<{}>()
    })
  })

  describe('Internal extraction', () => {
    it('should extract Internal type', () => {
      type T = { internal: { count: number } }
      expectTypeOf<Internal<T>>().toEqualTypeOf<{ count: number }>()
    })

    it('should default to empty object when not defined', () => {
      type T = {}
      expectTypeOf<Internal<T>>().toEqualTypeOf<{}>()
    })
  })

  describe('Computed extraction', () => {
    it('should extract Computed type', () => {
      type T = { computed: { doubled: number } }
      expectTypeOf<Computed<T>>().toEqualTypeOf<{ doubled: number }>()
    })

    it('should default to empty object when not defined', () => {
      type T = {}
      expectTypeOf<Computed<T>>().toEqualTypeOf<{}>()
    })
  })

  describe('State extraction', () => {
    it('should extract State type', () => {
      type T = { state: 'idle' | 'active' }
      expectTypeOf<State<T>>().toEqualTypeOf<'idle' | 'active'>()
    })

    it('should default to string when not defined', () => {
      type T = {}
      expectTypeOf<State<T>>().toEqualTypeOf<string>()
    })
  })
})

// ============================================
// Default Type Behavior Tests
// Verifies types work correctly with partial or empty definitions
// Empty {} should not cause type errors
// ============================================

describe('Default Type Behavior', () => {
  it('should work with empty type parameter', () => {
    type T = {}
    // Context should be empty object
    expectTypeOf<Context<T>>().toEqualTypeOf<{}>()
    // Snapshot should not be never
    expectTypeOf<Snapshot<T>>().not.toBeNever()
  })

  it('should work with only input defined', () => {
    type T = { input: { foo: string } }
    expectTypeOf<Context<T>>().toEqualTypeOf<{ foo: string }>()
    // Snapshot should not contain input properties
    type HasFoo = 'foo' extends keyof Snapshot<T> ? true : false
    expectTypeOf<HasFoo>().toEqualTypeOf<false>()
  })

  it('should work with only internal defined', () => {
    type T = { internal: { count: number } }
    expectTypeOf<Context<T>>().toEqualTypeOf<{ count: number }>()
    // Snapshot should contain internal properties
    expectTypeOf<Snapshot<T>>().toHaveProperty('count')
    expectTypeOf<Snapshot<T>['count']>().toEqualTypeOf<number>()
  })
})

// ============================================
// MachineTypes Constraint Tests
// Verifies various configurations are valid MachineTypes
// Full, partial, and empty configurations should all be valid
// ============================================

describe('MachineTypes Constraint', () => {
  it('should accept valid MachineTypes', () => {
    type ValidMachine = {
      input: { items: string[] }
      internal: { isOpen: boolean }
      events: { TOGGLE: undefined }
      computed: { count: number }
      actions: 'save' | 'cancel'
      guards: 'isValid'
      state: 'idle' | 'active'
    }

    // Should be assignable to MachineTypes
    type IsValid = ValidMachine extends MachineTypes ? true : false
    expectTypeOf<IsValid>().toEqualTypeOf<true>()
  })

  it('should accept partial MachineTypes', () => {
    type PartialMachine = {
      input: { foo: string }
    }

    type IsValid = PartialMachine extends MachineTypes ? true : false
    expectTypeOf<IsValid>().toEqualTypeOf<true>()
  })

  it('should accept empty MachineTypes', () => {
    type EmptyMachine = {}

    type IsValid = EmptyMachine extends MachineTypes ? true : false
    expectTypeOf<IsValid>().toEqualTypeOf<true>()
  })
})

// ============================================
// Factory Pattern Type Inference Tests
// Verifies that createMachine and useMachine properly infer types
// from factory functions without explicit type annotations
// ============================================

describe('Factory Pattern Type Inference', () => {
  it('should infer types from createMachine factory function', () => {
    // This simulates the factory pattern from README
    type FactoryMachine = {
      internal: { count: number }
      events: { INCREMENT: undefined }
      computed: { currentCount: number }
    }

    // Verify Snapshot includes internal and computed
    type Snap = Snapshot<FactoryMachine>
    expectTypeOf<Snap>().toHaveProperty('count')
    expectTypeOf<Snap>().toHaveProperty('currentCount')
    expectTypeOf<Snap['count']>().toEqualTypeOf<number>()
    expectTypeOf<Snap['currentCount']>().toEqualTypeOf<number>()

    // Verify Send type is correct
    type SendFn = Send<FactoryMachine['events']>
    expectTypeOf<SendFn>().toBeCallableWith('INCREMENT')
  })

  it('should infer types when factory has parameters', () => {
    // Factory function signature: (initialCount: number) => MachineInstance<T>
    type FactoryMachine = {
      internal: { count: number }
      events: { INCREMENT: undefined; SET: { value: number } }
      computed: { doubled: number }
    }

    type Snap = Snapshot<FactoryMachine>
    expectTypeOf<Snap>().toHaveProperty('count')
    expectTypeOf<Snap>().toHaveProperty('doubled')

    // Verify Send accepts both event types
    type SendFn = Send<FactoryMachine['events']>
    expectTypeOf<SendFn>().toBeFunction()
    expectTypeOf<SendFn>().parameter(0).toEqualTypeOf<'INCREMENT' | 'SET'>()
  })

  it('should handle factory with input type', () => {
    type FactoryMachine = {
      input: { multiplier: number }
      internal: { count: number }
      computed: { total: number }
      events: { INCREMENT: undefined }
    }

    // Context includes input
    type Ctx = Context<FactoryMachine>
    expectTypeOf<Ctx>().toHaveProperty('multiplier')
    expectTypeOf<Ctx>().toHaveProperty('count')
    expectTypeOf<Ctx>().toHaveProperty('total')

    // Snapshot excludes input
    type Snap = Snapshot<FactoryMachine>
    type HasMultiplier = 'multiplier' extends keyof Snap ? true : false
    expectTypeOf<HasMultiplier>().toEqualTypeOf<false>()
    expectTypeOf<Snap>().toHaveProperty('count')
    expectTypeOf<Snap>().toHaveProperty('total')
  })
})
