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
        return { ...useMachine(machine, { count, setCount }), count }
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
        return { ...useMachine(machine, { value, setValue }), value }
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
          ...useMachine(machine, { value, isOpen, setValue, setIsOpen }),
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
        return { ...useMachine(machine, { items }), setItems }
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
        return { ...useMachine(machine, { count, setCount }), count }
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
        return { ...useMachine(machine, { isOpen, setIsOpen }), isOpen }
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
        return { ...useMachine(machine, { id, setId }), id }
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
        return useMachine(machine, { active: true })
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
        return useMachine(machine, { state: 'loading' })
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
        return { ...useMachine(machine, { state, setState }), state }
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
})
