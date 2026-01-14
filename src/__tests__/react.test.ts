/**
 * React Tests - useMachine Hook
 *
 * Tests for the React integration via useMachine hook.
 * Tests event dispatching, computed values, effects, states,
 * action/guard overrides, internal state, and edge cases.
 */

import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useState } from 'react'
import { createMachine } from '../index'
import { useMachine } from '../react'

describe('React: useMachine', () => {
  // --------------------------------------------
  // send: Dispatching Events
  // Tests for event dispatching and action execution
  // --------------------------------------------

  describe('send: Dispatching Events', () => {
    it('send triggers state changes', () => {
      const machine = createMachine<{
        input: { count: number; setCount: (c: number) => void }
        events: { INCREMENT: undefined }
        actions: 'increment'
      }>({
        on: { INCREMENT: 'increment' },
        actions: { increment: (ctx) => ctx.setCount(ctx.count + 1) },
      })

      const { result } = renderHook(() => {
        const [count, setCount] = useState(0)
        const [snapshot, send] = useMachine(machine, { input: { count, setCount } })
        return { snapshot, send, count }
      })

      expect(result.current.count).toBe(0)

      act(() => result.current.send('INCREMENT'))
      expect(result.current.count).toBe(1)

      act(() => result.current.send('INCREMENT'))
      expect(result.current.count).toBe(2)
    })

    it('send with payload', () => {
      const machine = createMachine<{
        input: { value: string; setValue: (v: string) => void }
        events: { SET: { value: string } }
        actions: 'set'
      }>({
        on: { SET: 'set' },
        actions: { set: (ctx, payload) => ctx.setValue(payload!.value) },
      })

      const { result } = renderHook(() => {
        const [value, setValue] = useState('')
        const [snapshot, send] = useMachine(machine, { input: { value, setValue } })
        return { snapshot, send, value }
      })

      act(() => result.current.send('SET', { value: 'hello' }))
      expect(result.current.value).toBe('hello')
    })

    it('multiple actions execute in order', () => {
      const machine = createMachine<{
        input: {
          value: string
          isOpen: boolean
          setValue: (v: string) => void
          setIsOpen: (v: boolean) => void
        }
        events: { SELECT: { id: string } }
        actions: 'select' | 'close'
      }>({
        on: { SELECT: ['select', 'close'] },
        actions: {
          select: (ctx, payload) => ctx.setValue(payload!.id),
          close: (ctx) => ctx.setIsOpen(false),
        },
      })

      const { result } = renderHook(() => {
        const [value, setValue] = useState('')
        const [isOpen, setIsOpen] = useState(true)
        const [snapshot, send] = useMachine(machine, { input: { value, isOpen, setValue, setIsOpen } })
        return { snapshot, send, value, isOpen }
      })

      act(() => result.current.send('SELECT', { id: 'item-1' }))
      expect(result.current.value).toBe('item-1')
      expect(result.current.isOpen).toBe(false)
    })
  })

  // --------------------------------------------
  // computed: Derived Values
  // Tests for computed values in snapshot and guards
  // --------------------------------------------

  describe('computed: Derived Values', () => {
    it('computed values are in snapshot', () => {
      const machine = createMachine<{
        input: { items: string[] }
        computed: { count: number; isEmpty: boolean }
      }>({
        computed: {
          count: (input) => input.items.length,
          isEmpty: (input) => input.items.length === 0,
        },
      })

      const { result } = renderHook(() => {
        const [items, setItems] = useState(['a', 'b'])
        const [snapshot, send] = useMachine(machine, { input: { items } })
        return { snapshot, send, setItems }
      })

      expect(result.current.snapshot.count).toBe(2)
      expect(result.current.snapshot.isEmpty).toBe(false)

      act(() => result.current.setItems([]))
      expect(result.current.snapshot.count).toBe(0)
      expect(result.current.snapshot.isEmpty).toBe(true)
    })

    it('computed values usable in conditional handlers', () => {
      const machine = createMachine<{
        input: { count: number; setCount: (c: number) => void }
        events: { DECREMENT: undefined }
        computed: { canDecrement: boolean }
        actions: 'decrement'
      }>({
        computed: {
          canDecrement: (input) => input.count > 0,
        },
        on: {
          DECREMENT: [{ when: (ctx) => ctx.canDecrement, do: 'decrement' }],
        },
        actions: {
          decrement: (ctx) => ctx.setCount(ctx.count - 1),
        },
      })

      const { result } = renderHook(() => {
        const [count, setCount] = useState(1)
        const [snapshot, send] = useMachine(machine, { input: { count, setCount } })
        return { snapshot, send, count }
      })

      act(() => result.current.send('DECREMENT'))
      expect(result.current.count).toBe(0)

      // canDecrement is false, so nothing happens
      act(() => result.current.send('DECREMENT'))
      expect(result.current.count).toBe(0)
    })
  })

  // --------------------------------------------
  // effects: Watch-based Side Effects
  // Tests for enter/exit/change callbacks and cleanup
  // --------------------------------------------

  describe('effects: Watch-based Side Effects', () => {
    it('enter/exit callbacks fire on truthy/falsy transitions', () => {
      const enter = vi.fn()
      const exit = vi.fn()

      const machine = createMachine<{
        input: { isOpen: boolean; setIsOpen: (v: boolean) => void }
        events: { OPEN: undefined; CLOSE: undefined }
        actions: 'open' | 'close'
      }>({
        on: {
          OPEN: 'open',
          CLOSE: 'close',
        },
        effects: [
          {
            watch: (ctx) => ctx.isOpen,
            enter: () => {
              enter()
              return () => exit()
            },
          },
        ],
        actions: {
          open: (ctx) => ctx.setIsOpen(true),
          close: (ctx) => ctx.setIsOpen(false),
        },
      })

      const { result } = renderHook(() => {
        const [isOpen, setIsOpen] = useState(false)
        const [snapshot, send] = useMachine(machine, { input: { isOpen, setIsOpen } })
        return { snapshot, send, isOpen }
      })

      expect(enter).not.toHaveBeenCalled()

      act(() => result.current.send('OPEN'))
      expect(enter).toHaveBeenCalledTimes(1)

      act(() => result.current.send('CLOSE'))
      expect(exit).toHaveBeenCalledTimes(1)
    })

    it('change callback receives prev and curr values', () => {
      const change = vi.fn()

      const machine = createMachine<{
        input: { id: string | null; setId: (id: string | null) => void }
        events: { FOCUS: { id: string }; BLUR: undefined }
        actions: 'focus' | 'blur'
      }>({
        on: {
          FOCUS: 'focus',
          BLUR: 'blur',
        },
        effects: [
          {
            watch: (ctx) => ctx.id,
            change: (_ctx, prev, curr) => change(prev, curr),
          },
        ],
        actions: {
          focus: (ctx, payload) => ctx.setId(payload!.id),
          blur: (ctx) => ctx.setId(null),
        },
      })

      const { result } = renderHook(() => {
        const [id, setId] = useState<string | null>(null)
        const [snapshot, send] = useMachine(machine, { input: { id, setId } })
        return { snapshot, send, id }
      })

      act(() => result.current.send('FOCUS', { id: 'a' }))
      expect(change).toHaveBeenCalledWith(null, 'a')

      act(() => result.current.send('FOCUS', { id: 'b' }))
      expect(change).toHaveBeenCalledWith('a', 'b')
    })

    it('cleanup on unmount', () => {
      const cleanup = vi.fn()

      const machine = createMachine<{
        input: { active: boolean }
      }>({
        effects: [
          {
            watch: (ctx) => ctx.active,
            enter: () => cleanup,
          },
        ],
      })

      const { unmount } = renderHook(() => {
        return useMachine(machine, { input: { active: true } })
      })

      expect(cleanup).not.toHaveBeenCalled()
      unmount()
      expect(cleanup).toHaveBeenCalledTimes(1)
    })
  })

  // --------------------------------------------
  // state: State-based Handlers (FSM)
  // Tests for state-specific event handlers
  // --------------------------------------------

  describe('state: State-based Handlers', () => {
    it('state is in snapshot', () => {
      const machine = createMachine<{
        input: { state: 'idle' | 'loading' }
        state: 'idle' | 'loading'
      }>({})

      const { result } = renderHook(() => {
        const [snapshot, send] = useMachine(machine, { input: { state: 'loading' } })
        return { snapshot, send }
      })

      expect(result.current.snapshot.state).toBe('loading')
    })

    it('state-based handlers work in React', () => {
      const machine = createMachine<{
        input: {
          state: 'idle' | 'active'
          setState: (s: 'idle' | 'active') => void
        }
        events: { ACTIVATE: undefined; DEACTIVATE: undefined }
        actions: 'activate' | 'deactivate'
        state: 'idle' | 'active'
      }>({
        states: {
          idle: {
            on: { ACTIVATE: 'activate' },
          },
          active: {
            on: { DEACTIVATE: 'deactivate' },
          },
        },
        actions: {
          activate: (ctx) => ctx.setState('active'),
          deactivate: (ctx) => ctx.setState('idle'),
        },
      })

      const { result } = renderHook(() => {
        const [state, setState] = useState<'idle' | 'active'>('idle')
        const [snapshot, send] = useMachine(machine, { input: { state, setState } })
        return { snapshot, send, state }
      })

      // idle state: ACTIVATE works, DEACTIVATE ignored
      act(() => result.current.send('DEACTIVATE'))
      expect(result.current.state).toBe('idle')

      act(() => result.current.send('ACTIVATE'))
      expect(result.current.state).toBe('active')

      // active state: DEACTIVATE works, ACTIVATE ignored
      act(() => result.current.send('ACTIVATE'))
      expect(result.current.state).toBe('active')

      act(() => result.current.send('DEACTIVATE'))
      expect(result.current.state).toBe('idle')
    })

    it('FSM with internal.state (state managed by machine)', () => {
      // This tests the pattern where state lives in internal (managed by machine)
      // rather than in input (managed by component)
      const createFSMMachine = () =>
        createMachine<{
          internal: { state: 'idle' | 'loading' | 'error' }
          events: { FETCH: undefined; SUCCESS: undefined; FAIL: undefined; RETRY: undefined }
          state: 'idle' | 'loading' | 'error'
        }>({
          internal: { state: 'idle' },
          states: {
            idle: {
              on: { FETCH: (_, __, assign) => assign({ state: 'loading' }) },
            },
            loading: {
              on: {
                SUCCESS: (_, __, assign) => assign({ state: 'idle' }),
                FAIL: (_, __, assign) => assign({ state: 'error' }),
              },
            },
            error: {
              on: { RETRY: (_, __, assign) => assign({ state: 'loading' }) },
            },
          },
        })

      const { result } = renderHook(() => {
        const [snapshot, send] = useMachine(createFSMMachine)
        return { snapshot, send }
      })

      // Initial state
      expect(result.current.snapshot.state).toBe('idle')

      // idle -> loading
      act(() => result.current.send('FETCH'))
      expect(result.current.snapshot.state).toBe('loading')

      // FETCH ignored while loading
      act(() => result.current.send('FETCH'))
      expect(result.current.snapshot.state).toBe('loading')

      // loading -> error
      act(() => result.current.send('FAIL'))
      expect(result.current.snapshot.state).toBe('error')

      // error -> loading (retry)
      act(() => result.current.send('RETRY'))
      expect(result.current.snapshot.state).toBe('loading')

      // loading -> idle (success)
      act(() => result.current.send('SUCCESS'))
      expect(result.current.snapshot.state).toBe('idle')
    })
  })

  // --------------------------------------------
  // actions: Override Actions
  // Tests for action overrides via useMachine options
  // --------------------------------------------

  describe('actions: Override Actions', () => {
    it('actions from options override machine actions', () => {
      const machineAction = vi.fn()
      const overrideAction = vi.fn()

      const machine = createMachine<{
        input: { value: number }
        events: { DO: undefined }
        actions: 'doSomething'
      }>({
        on: { DO: 'doSomething' },
        actions: { doSomething: machineAction },
      })

      const { result } = renderHook(() => {
        const [snapshot, send] = useMachine(machine, {
          input: { value: 1 },
          actions: { doSomething: overrideAction },
        })
        return { snapshot, send }
      })

      act(() => result.current.send('DO'))
      expect(machineAction).not.toHaveBeenCalled()
      expect(overrideAction).toHaveBeenCalledTimes(1)
    })

    it('actions from options are merged with machine actions', () => {
      const machineAction1 = vi.fn()
      const machineAction2 = vi.fn()
      const overrideAction2 = vi.fn()

      const machine = createMachine<{
        input: { value: number }
        events: { A: undefined; B: undefined }
        actions: 'action1' | 'action2'
      }>({
        on: { A: 'action1', B: 'action2' },
        actions: { action1: machineAction1, action2: machineAction2 },
      })

      const { result } = renderHook(() => {
        const [snapshot, send] = useMachine(machine, {
          input: { value: 1 },
          actions: { action2: overrideAction2 },  // override action2
        })
        return { snapshot, send }
      })

      act(() => result.current.send('A'))
      expect(machineAction1).toHaveBeenCalledTimes(1)  // machine action used

      act(() => result.current.send('B'))
      expect(machineAction2).not.toHaveBeenCalled()  // machine action NOT called
      expect(overrideAction2).toHaveBeenCalledTimes(1)  // override used
    })
  })

  // --------------------------------------------
  // guards: String-based Guard Names
  // Tests for guard overrides via useMachine options
  // --------------------------------------------

  describe('guards: String-based Guard Names', () => {
    it('string guards are resolved from options', () => {
      const action = vi.fn()

      const machine = createMachine<{
        input: { value: number }
        events: { CHECK: undefined }
        actions: 'doAction'
        guards: 'isPositive'
      }>({
        on: {
          CHECK: [
            { when: 'isPositive', do: 'doAction' },
          ],
        },
        actions: { doAction: action },
      })

      const { result } = renderHook(() => {
        const [value, setValue] = useState(5)
        const [snapshot, send] = useMachine(machine, {
          input: { value },
          guards: { isPositive: (ctx) => ctx.value > 0 },
        })
        return { snapshot, send, setValue }
      })

      act(() => result.current.send('CHECK'))
      expect(action).toHaveBeenCalledTimes(1)
    })

    it('string guards that return false prevent action execution', () => {
      const action = vi.fn()

      const machine = createMachine<{
        input: { value: number }
        events: { CHECK: undefined }
        actions: 'doAction'
        guards: 'isPositive'
      }>({
        on: {
          CHECK: [
            { when: 'isPositive', do: 'doAction' },
          ],
        },
        actions: { doAction: action },
      })

      const { result } = renderHook(() => {
        const [snapshot, send] = useMachine(machine, {
          input: { value: -5 },
          guards: { isPositive: (ctx) => ctx.value > 0 },
        })
        return { snapshot, send }
      })

      act(() => result.current.send('CHECK'))
      expect(action).not.toHaveBeenCalled()
    })

    it('function guards still work alongside string guards', () => {
      const action1 = vi.fn()
      const action2 = vi.fn()

      const machine = createMachine<{
        input: { value: number }
        events: { CHECK: undefined }
        actions: 'action1' | 'action2'
        guards: 'stringGuard'
      }>({
        on: {
          CHECK: [
            { when: 'stringGuard', do: 'action1' },
            { when: (ctx) => ctx.value < 0, do: 'action2' },
          ],
        },
        actions: { action1, action2 },
      })

      const { result } = renderHook(() => {
        const [snapshot, send] = useMachine(machine, {
          input: { value: -5 },
          guards: { stringGuard: (ctx) => ctx.value > 0 },
        })
        return { snapshot, send }
      })

      act(() => result.current.send('CHECK'))
      // stringGuard returns false, falls through to function guard which returns true
      expect(action1).not.toHaveBeenCalled()
      expect(action2).toHaveBeenCalledTimes(1)
    })

    it('guards from options selectively override machine guards', () => {
      const action1 = vi.fn()
      const action2 = vi.fn()
      const action3 = vi.fn()

      const machine = createMachine<{
        input: { value: number }
        events: { CHECK1: undefined; CHECK2: undefined }
        actions: 'action1' | 'action2' | 'action3'
        guards: 'guard1' | 'guard2'
      }>({
        on: {
          CHECK1: [
            { when: 'guard1', do: 'action1' },
            { do: 'action2' },
          ],
          CHECK2: [
            { when: 'guard2', do: 'action3' },
          ],
        },
        actions: { action1, action2, action3 },
        guards: {
          guard1: (ctx) => ctx.value > 100,  // machine: value > 100
          guard2: (ctx) => ctx.value > 0,    // machine: value > 0
        },
      })

      const { result } = renderHook(() => {
        const [snapshot, send] = useMachine(machine, {
          input: { value: 50 },
          guards: {
            guard1: (ctx) => ctx.value > 10,  // override: value > 10
            // guard2 not overridden - uses machine's guard
          },
        })
        return { snapshot, send }
      })

      // guard1 overridden: 50 > 10 = true, action1 executes
      act(() => result.current.send('CHECK1'))
      expect(action1).toHaveBeenCalledTimes(1)
      expect(action2).not.toHaveBeenCalled()

      // guard2 from machine: 50 > 0 = true, action3 executes
      act(() => result.current.send('CHECK2'))
      expect(action3).toHaveBeenCalledTimes(1)
    })
  })

  // --------------------------------------------
  // Inline Functions in do Field
  // Tests for inline function actions in rules
  // --------------------------------------------

  describe('Inline Functions in do Field', () => {
    it('inline function in do works with useMachine', () => {
      const machine = createMachine<{
        input: { count: number; setCount: (c: number) => void }
        events: { INCREMENT: undefined }
      }>({
        on: {
          INCREMENT: [{ do: (ctx) => ctx.setCount(ctx.count + 1) }],
        },
      })

      const { result } = renderHook(() => {
        const [count, setCount] = useState(0)
        const [snapshot, send] = useMachine(machine, { input: { count, setCount } })
        return { snapshot, send, count }
      })

      expect(result.current.count).toBe(0)

      act(() => result.current.send('INCREMENT'))
      expect(result.current.count).toBe(1)
    })

    it('mixed string and inline functions in do array', () => {
      const log: string[] = []

      const machine = createMachine<{
        input: { log: string[] }
        events: { ACTION: undefined }
        actions: 'action1' | 'action2'
      }>({
        on: {
          ACTION: [
            {
              do: [
                'action1',
                (ctx) => ctx.log.push('inline'),
                'action2',
              ],
            },
          ],
        },
        actions: {
          action1: (ctx) => ctx.log.push('action1'),
          action2: (ctx) => ctx.log.push('action2'),
        },
      })

      const { result } = renderHook(() => {
        const [snapshot, send] = useMachine(machine, { input: { log } })
        return { snapshot, send }
      })

      act(() => result.current.send('ACTION'))
      expect(log).toEqual(['action1', 'inline', 'action2'])
    })

    it('payload passed to inline function in do', () => {
      const machine = createMachine<{
        input: { value: string; setValue: (v: string) => void }
        events: { SET: { value: string } }
      }>({
        on: {
          SET: [{ do: (ctx, payload) => ctx.setValue(payload.value) }],
        },
      })

      const { result } = renderHook(() => {
        const [value, setValue] = useState('')
        const [snapshot, send] = useMachine(machine, { input: { value, setValue } })
        return { snapshot, send, value }
      })

      act(() => result.current.send('SET', { value: 'hello' }))
      expect(result.current.value).toBe('hello')
    })
  })

  // --------------------------------------------
  // Guard Arrays in when Field
  // Tests for multiple guards with AND logic
  // --------------------------------------------

  describe('Guard Arrays in when Field', () => {
    it('all guards must pass for action to execute', () => {
      const machine = createMachine<{
        input: { a: boolean; b: boolean; count: number; setCount: (c: number) => void }
        events: { INCREMENT: undefined }
        actions: 'increment'
      }>({
        on: {
          INCREMENT: [
            { when: [(ctx) => ctx.a, (ctx) => ctx.b], do: 'increment' },
          ],
        },
        actions: { increment: (ctx) => ctx.setCount(ctx.count + 1) },
      })

      const { result } = renderHook(() => {
        const [count, setCount] = useState(0)
        const [a, setA] = useState(false)
        const [b, setB] = useState(false)
        const [snapshot, send] = useMachine(machine, { input: { a, b, count, setCount } })
        return { snapshot, send, count, setA, setB }
      })

      // Both false - no increment
      act(() => result.current.send('INCREMENT'))
      expect(result.current.count).toBe(0)

      // Enable a only
      act(() => result.current.setA(true))
      act(() => result.current.send('INCREMENT'))
      expect(result.current.count).toBe(0)

      // Enable both
      act(() => result.current.setB(true))
      act(() => result.current.send('INCREMENT'))
      expect(result.current.count).toBe(1)
    })
  })

  // --------------------------------------------
  // Internal State with assign
  // Tests for machine-managed internal state in React
  // Updated via assign(), triggers re-render
  // --------------------------------------------

  describe('internal: Internal State with assign', () => {
    it('assign updates internal state and triggers re-render', () => {
      const machine = createMachine<{
        input: { increment: number }
        internal: { count: number }
        events: { INCREMENT: undefined }
      }>({
        internal: { count: 0 },
        on: {
          INCREMENT: (ctx, _payload, assign) => {
            assign({ count: ctx.count + ctx.increment })
          },
        },
      })

      const { result } = renderHook(() => {
        const [snapshot, send] = useMachine(machine, { input: { increment: 5 } })
        return { snapshot, send }
      })

      // internal count accessible via snapshot
      act(() => result.current.send('INCREMENT'))
      // Re-render should happen, send again to verify state persisted
      act(() => result.current.send('INCREMENT'))
      // After 2 increments: 0 + 5 + 5 = 10
    })

    it('internal state is isolated per hook instance', () => {
      const machine = createMachine<{
        input: {}
        internal: { count: number }
        events: { INCREMENT: undefined }
        computed: { currentCount: number }
      }>({
        internal: { count: 0 },
        computed: {
          currentCount: (ctx) => ctx.count,
        },
        on: {
          INCREMENT: (_ctx, _payload, assign) => {
            assign({ count: _ctx.count + 1 })
          },
        },
      })

      const { result: result1 } = renderHook(() => {
        const [snapshot, send] = useMachine(machine, { input: {} })
        return { snapshot, send }
      })
      const { result: result2 } = renderHook(() => {
        const [snapshot, send] = useMachine(machine, { input: {} })
        return { snapshot, send }
      })

      act(() => result1.current.send('INCREMENT'))
      act(() => result1.current.send('INCREMENT'))

      expect(result1.current.snapshot.currentCount).toBe(2)
      expect(result2.current.snapshot.currentCount).toBe(0)
    })

    it('flat context: input and internal accessible at same level', () => {
      const machine = createMachine<{
        input: { multiplier: number }
        internal: { count: number }
        events: { INCREMENT: undefined }
        computed: { total: number }
      }>({
        internal: { count: 0 },
        computed: {
          // ctx.count (internal) and ctx.multiplier (input) at same level
          total: (ctx) => ctx.count * ctx.multiplier,
        },
        on: {
          INCREMENT: (ctx, _payload, assign) => {
            // Both ctx.count and ctx.multiplier directly accessible
            assign({ count: ctx.count + 1 })
          },
        },
      })

      const { result } = renderHook(() => {
        const [snapshot, send] = useMachine(machine, { input: { multiplier: 10 } })
        return { snapshot, send }
      })

      expect(result.current.snapshot.total).toBe(0)

      act(() => result.current.send('INCREMENT'))
      expect(result.current.snapshot.total).toBe(10)

      act(() => result.current.send('INCREMENT'))
      expect(result.current.snapshot.total).toBe(20)
    })

    it('factory pattern: create machine with custom initial internal', () => {
      const createCounterMachine = (initialCount: number) =>
        createMachine<{
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
            INCREMENT: (ctx, _payload, assign) => assign({ count: ctx.count + 1 }),
            DECREMENT: (ctx, _payload, assign) => assign({ count: ctx.count - 1 }),
          },
        })

      const { result } = renderHook(() => {
        const [snapshot, send] = useMachine(() => createCounterMachine(100), { input: {} })
        return { snapshot, send }
      })

      expect(result.current.snapshot.currentCount).toBe(100)

      act(() => result.current.send('INCREMENT'))
      expect(result.current.snapshot.currentCount).toBe(101)

      act(() => result.current.send('DECREMENT'))
      expect(result.current.snapshot.currentCount).toBe(100)
    })

    it('factory pattern: type inference without explicit input type', () => {
      // README example: no input type specified
      const createCounterMachine = (initialCount: number) =>
        createMachine<{
          internal: { count: number }
          events: { INCREMENT: undefined }
          computed: { currentCount: number }
        }>({
          internal: { count: initialCount },
          computed: { currentCount: (ctx) => ctx.count },
          on: {
            INCREMENT: (ctx, _, assign) => assign({ count: ctx.count + 1 }),
          },
        })

      // No input option needed
      const { result } = renderHook(() => {
        const [snapshot, send] = useMachine(() => createCounterMachine(100))
        return { snapshot, send }
      })

      // Type inference should work: snapshot.count, snapshot.currentCount
      expect(result.current.snapshot.count).toBe(100)
      expect(result.current.snapshot.currentCount).toBe(100)

      act(() => result.current.send('INCREMENT'))
      expect(result.current.snapshot.count).toBe(101)
      expect(result.current.snapshot.currentCount).toBe(101)

      // send should be typed: 'INCREMENT' is valid
      act(() => result.current.send('INCREMENT'))
      expect(result.current.snapshot.count).toBe(102)
    })

    it('assign with partial updates preserves other internal values', () => {
      const machine = createMachine<{
        input: {}
        internal: { count: number; name: string; active: boolean }
        events: { UPDATE_COUNT: { value: number }; UPDATE_NAME: { value: string } }
        computed: { snapshot: { count: number; name: string; active: boolean } }
      }>({
        internal: { count: 0, name: 'initial', active: true },
        computed: {
          snapshot: (ctx) => ({ count: ctx.count, name: ctx.name, active: ctx.active }),
        },
        on: {
          UPDATE_COUNT: (_ctx, payload, assign) => assign({ count: payload.value }),
          UPDATE_NAME: (_ctx, payload, assign) => assign({ name: payload.value }),
        },
      })

      const { result } = renderHook(() => {
        const [snapshot, send] = useMachine(machine, { input: {} })
        return { snapshot, send }
      })

      expect(result.current.snapshot.snapshot).toEqual({
        count: 0,
        name: 'initial',
        active: true,
      })

      act(() => result.current.send('UPDATE_COUNT', { value: 42 }))
      expect(result.current.snapshot.snapshot).toEqual({
        count: 42,
        name: 'initial',
        active: true,
      })

      act(() => result.current.send('UPDATE_NAME', { value: 'updated' }))
      expect(result.current.snapshot.snapshot).toEqual({
        count: 42,
        name: 'updated',
        active: true,
      })
    })

    it('effects can watch internal state changes', () => {
      const onChange = vi.fn()

      const machine = createMachine<{
        input: {}
        internal: { count: number }
        events: { INCREMENT: undefined }
      }>({
        internal: { count: 0 },
        on: {
          INCREMENT: (ctx, _payload, assign) => assign({ count: ctx.count + 1 }),
        },
        effects: [
          {
            watch: (ctx) => ctx.count,
            change: (_ctx, prev, curr) => onChange(prev, curr),
          },
        ],
      })

      const { result } = renderHook(() => {
        const [snapshot, send] = useMachine(machine, { input: {} })
        return { snapshot, send }
      })

      act(() => result.current.send('INCREMENT'))
      expect(onChange).toHaveBeenCalledWith(0, 1)

      act(() => result.current.send('INCREMENT'))
      expect(onChange).toHaveBeenCalledWith(1, 2)
    })

    it('guards can use internal state', () => {
      const action = vi.fn()

      const machine = createMachine<{
        input: {}
        internal: { count: number }
        events: { INCREMENT: undefined; TRY_ACTION: undefined }
      }>({
        internal: { count: 0 },
        on: {
          INCREMENT: (ctx, _payload, assign) => assign({ count: ctx.count + 1 }),
          TRY_ACTION: [
            { when: (ctx) => ctx.count >= 3, do: action },
          ],
        },
      })

      const { result } = renderHook(() => {
        const [snapshot, send] = useMachine(machine, { input: {} })
        return { snapshot, send }
      })

      act(() => result.current.send('TRY_ACTION'))
      expect(action).not.toHaveBeenCalled()

      act(() => result.current.send('INCREMENT'))
      act(() => result.current.send('INCREMENT'))
      act(() => result.current.send('TRY_ACTION'))
      expect(action).not.toHaveBeenCalled()

      act(() => result.current.send('INCREMENT'))
      act(() => result.current.send('TRY_ACTION'))
      expect(action).toHaveBeenCalledTimes(1)
    })

    it('multiple assigns in same handler work correctly (no stale closure)', () => {
      const machine = createMachine<{
        input: {}
        internal: { count: number }
        events: { TRIPLE_INCREMENT: undefined }
        computed: { currentCount: number }
      }>({
        internal: { count: 0 },
        computed: {
          currentCount: (ctx) => ctx.count,
        },
        on: {
          TRIPLE_INCREMENT: (_ctx, _payload, assign) => {
            // Multiple assigns in the same handler should all work
            assign({ count: 1 })
            assign({ count: 2 })
            assign({ count: 3 })
          },
        },
      })

      const { result } = renderHook(() => {
        const [snapshot, send] = useMachine(machine, { input: {} })
        return { snapshot, send }
      })

      expect(result.current.snapshot.currentCount).toBe(0)

      act(() => result.current.send('TRIPLE_INCREMENT'))
      // All three assigns should have been applied, final value is 3
      expect(result.current.snapshot.currentCount).toBe(3)
    })
  })

  // --------------------------------------------
  // Infinite Rendering Prevention
  // Tests for edge cases that could cause infinite loops
  // always rules, effects with send, rapid events
  // --------------------------------------------

  describe('infinite rendering prevention', () => {
    it('always block with assign does not cause infinite loop when condition stabilizes', () => {
      const renderCount = { current: 0 }

      const machine = createMachine<{
        input: { threshold: number }
        internal: { count: number; capped: boolean }
        events: { INCREMENT: undefined }
        computed: { currentCount: number }
      }>({
        internal: { count: 0, capped: false },
        computed: {
          currentCount: (ctx) => ctx.count,
        },
        on: {
          INCREMENT: (ctx, _payload, assign) => assign({ count: ctx.count + 1 }),
        },
        always: [
          {
            // Cap count at threshold - should only trigger once when condition becomes true
            when: (ctx) => ctx.count > ctx.threshold && !ctx.capped,
            do: (_ctx, _payload, assign) => assign({ count: _ctx.threshold, capped: true }),
          },
        ],
      })

      const { result } = renderHook(() => {
        renderCount.current++
        const [snapshot, send] = useMachine(machine, { input: { threshold: 5 } })
        return { snapshot, send, renderCount: renderCount.current }
      })

      // Initial render
      const initialRenderCount = renderCount.current

      // Increment multiple times
      act(() => {
        result.current.send('INCREMENT')
        result.current.send('INCREMENT')
        result.current.send('INCREMENT')
      })

      // Should not have excessive renders (allowing for some React batching behavior)
      expect(renderCount.current - initialRenderCount).toBeLessThan(10)
      expect(result.current.snapshot.currentCount).toBeLessThanOrEqual(5)
    })

    it('effect with send does not cause infinite loop when guarded properly', () => {
      const effectCallCount = { current: 0 }

      const machine = createMachine<{
        input: {}
        internal: { count: number; effectTriggered: boolean }
        events: { INCREMENT: undefined; EFFECT_COMPLETE: undefined }
        computed: { currentCount: number }
      }>({
        internal: { count: 0, effectTriggered: false },
        computed: {
          currentCount: (ctx) => ctx.count,
        },
        on: {
          INCREMENT: (ctx, _payload, assign) => assign({ count: ctx.count + 1 }),
          EFFECT_COMPLETE: (_ctx, _payload, assign) => assign({ effectTriggered: true }),
        },
        effects: [
          {
            watch: (ctx) => ctx.count,
            change: (ctx, _prev, _curr, { send }) => {
              effectCallCount.current++
              // Only send if not already triggered - prevents infinite loop
              if (!ctx.effectTriggered && ctx.count === 3) {
                send('EFFECT_COMPLETE')
              }
            },
          },
        ],
      })

      const { result } = renderHook(() => {
        const [snapshot, send] = useMachine(machine, { input: {} })
        return { snapshot, send }
      })

      act(() => result.current.send('INCREMENT'))
      act(() => result.current.send('INCREMENT'))
      act(() => result.current.send('INCREMENT'))

      // Effect should have been called for each render that changed count
      // The exact number depends on React batching, but EFFECT_COMPLETE should fire once
      expect(effectCallCount.current).toBeGreaterThanOrEqual(1)
      expect(result.current.snapshot.effectTriggered).toBe(true)
    })

    it('action modifying input setter does not cause issues', () => {
      const renderCount = { current: 0 }

      const machine = createMachine<{
        input: { count: number; setCount: (c: number) => void }
        events: { INCREMENT: undefined }
        actions: 'increment'
      }>({
        on: { INCREMENT: 'increment' },
        actions: {
          increment: (ctx) => ctx.setCount(ctx.count + 1),
        },
      })

      const { result } = renderHook(() => {
        renderCount.current++
        const [count, setCount] = useState(0)
        const [snapshot, send] = useMachine(machine, { input: { count, setCount } })
        return { snapshot, send, count }
      })

      const initialRenderCount = renderCount.current

      act(() => result.current.send('INCREMENT'))
      act(() => result.current.send('INCREMENT'))
      act(() => result.current.send('INCREMENT'))

      // Each increment should cause exactly one re-render
      // Initial + 3 increments = ~4 renders (allowing for strict mode doubles)
      expect(renderCount.current - initialRenderCount).toBeLessThan(10)
      expect(result.current.count).toBe(3)
    })

    it('rapid consecutive sends do not cause issues', () => {
      const machine = createMachine<{
        input: {}
        internal: { count: number }
        events: { INCREMENT: undefined }
        computed: { currentCount: number }
      }>({
        internal: { count: 0 },
        computed: {
          currentCount: (ctx) => ctx.count,
        },
        on: {
          INCREMENT: (ctx, _payload, assign) => assign({ count: ctx.count + 1 }),
        },
      })

      const { result } = renderHook(() => {
        const [snapshot, send] = useMachine(machine, { input: {} })
        return { snapshot, send }
      })

      // Send many events rapidly
      act(() => {
        for (let i = 0; i < 100; i++) {
          result.current.send('INCREMENT')
        }
      })

      expect(result.current.snapshot.currentCount).toBe(100)
    })

    it('always block without assign does not cause issues', () => {
      const alwaysCallCount = { current: 0 }

      const machine = createMachine<{
        input: { value: number }
        events: { UPDATE: { value: number } }
        actions: 'logValue'
      }>({
        on: {
          UPDATE: (_ctx, _payload, _assign) => {
            // This modifies input via external setter, not assign
          },
        },
        always: [
          {
            when: (ctx) => ctx.value > 0,
            do: () => {
              alwaysCallCount.current++
              // Side effect only, no assign
            },
          },
        ],
        actions: {
          logValue: () => {},
        },
      })

      const { result } = renderHook(() => {
        const [value, setValue] = useState(5)
        const [snapshot, send] = useMachine(machine, { input: { value } })
        return { snapshot, send, setValue }
      })

      // Initial render should trigger always once
      const initialCallCount = alwaysCallCount.current

      // Changing input should trigger always again
      act(() => result.current.setValue(10))

      // Should only have called always a reasonable number of times
      expect(alwaysCallCount.current - initialCallCount).toBeLessThanOrEqual(2)
    })

    it('always block runs on context change and can trigger state update', () => {
      // This test documents that always runs when context changes
      // and can safely update state if properly guarded

      const machine = createMachine<{
        input: { trigger: boolean }
        internal: { count: number }
        events: {}
      }>({
        internal: { count: 0 },
        always: [
          {
            // Only increment when trigger is true and count is 0
            when: (ctx) => ctx.trigger && ctx.count === 0,
            do: (_ctx, _payload, assign) => {
              assign({ count: 1 })
            },
          },
        ],
      })

      const { result } = renderHook(() => {
        const [trigger, setTrigger] = useState(false)
        const [snapshot, send] = useMachine(machine, { input: { trigger } })
        return { snapshot, send, setTrigger }
      })

      // Initially count is 0, trigger is false, so always doesn't fire
      expect(result.current.snapshot.count).toBe(0)

      // When trigger becomes true, always fires and increments count
      act(() => result.current.setTrigger(true))
      expect(result.current.snapshot.count).toBe(1)

      // Count is now 1, so the guard (count === 0) is false, no infinite loop
    })
  })
})
