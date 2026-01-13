import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useState } from 'react'
import { createMachine } from '../index'
import { useMachine } from '../react'

describe('React: useMachine', () => {
  // --------------------------------------------
  // send: Dispatching Events
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
        return { ...useMachine(machine, { input: { count, setCount } }), count }
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
        return { ...useMachine(machine, { input: { value, setValue } }), value }
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
        return {
          ...useMachine(machine, { input: { value, isOpen, setValue, setIsOpen } }),
          value,
          isOpen,
        }
      })

      act(() => result.current.send('SELECT', { id: 'item-1' }))
      expect(result.current.value).toBe('item-1')
      expect(result.current.isOpen).toBe(false)
    })
  })

  // --------------------------------------------
  // computed: Derived Values
  // --------------------------------------------

  describe('computed: Derived Values', () => {
    it('computed values are returned from hook', () => {
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
        return { ...useMachine(machine, { input: { items } }), setItems }
      })

      expect(result.current.computed.count).toBe(2)
      expect(result.current.computed.isEmpty).toBe(false)

      act(() => result.current.setItems([]))
      expect(result.current.computed.count).toBe(0)
      expect(result.current.computed.isEmpty).toBe(true)
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
        return { ...useMachine(machine, { input: { count, setCount } }), count }
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
        return { ...useMachine(machine, { input: { isOpen, setIsOpen } }), isOpen }
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
        return { ...useMachine(machine, { input: { id, setId } }), id }
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
  // state: State-based Handlers
  // --------------------------------------------

  describe('state: State-based Handlers', () => {
    it('state is returned from hook', () => {
      const machine = createMachine<{
        input: { state: 'idle' | 'loading' }
        state: 'idle' | 'loading'
      }>({})

      const { result } = renderHook(() => {
        return useMachine(machine, { input: { state: 'loading' } })
      })

      expect(result.current.state).toBe('loading')
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
        return { ...useMachine(machine, { input: { state, setState } }), state }
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
  })

  // --------------------------------------------
  // actions: Override Actions
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
        return useMachine(machine, {
          input: { value: 1 },
          actions: { doSomething: overrideAction },
        })
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
        return useMachine(machine, {
          input: { value: 1 },
          actions: { action2: overrideAction2 },  // override action2
        })
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
        return {
          ...useMachine(machine, {
            input: { value },
            guards: { isPositive: (ctx) => ctx.value > 0 },
          }),
          setValue,
        }
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
        return useMachine(machine, {
          input: { value: -5 },
          guards: { isPositive: (ctx) => ctx.value > 0 },
        })
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
        return useMachine(machine, {
          input: { value: -5 },
          guards: { stringGuard: (ctx) => ctx.value > 0 },
        })
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
        return useMachine(machine, {
          input: { value: 50 },
          guards: {
            guard1: (ctx) => ctx.value > 10,  // override: value > 10
            // guard2 not overridden - uses machine's guard
          },
        })
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
        return { ...useMachine(machine, { input: { count, setCount } }), count }
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

      const { result } = renderHook(() =>
        useMachine(machine, { input: { log } })
      )

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
        return { ...useMachine(machine, { input: { value, setValue } }), value }
      })

      act(() => result.current.send('SET', { value: 'hello' }))
      expect(result.current.value).toBe('hello')
    })
  })

  // --------------------------------------------
  // Guard Arrays in when Field
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
        return {
          ...useMachine(machine, { input: { a, b, count, setCount } }),
          count,
          setA,
          setB,
        }
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
})
