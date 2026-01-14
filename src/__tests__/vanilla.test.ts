/**
 * Vanilla Tests - createMachine
 *
 * Tests for the core createMachine function without React.
 * Tests event handlers, computed values, states, effects, guards, and internal state.
 */

import { describe, it, expect, vi } from 'vitest'
import { createMachine, not, and, or } from '../index'

describe('Vanilla: createMachine', () => {
  // ============================================
  // on: Event Handlers
  // Tests for global event handler configurations
  // Formats: string, array, rule array, inline function
  // ============================================

  describe('on: Event Handlers', () => {
    it('single action (string)', () => {
      const open = vi.fn()

      const machine = createMachine<{
        input: { open: () => void }
        events: { OPEN: undefined }
        actions: 'open'
      }>({
        on: { OPEN: 'open' },
        actions: { open: (ctx) => ctx.open() },
      })

      machine.send('OPEN', { open })
      expect(open).toHaveBeenCalledTimes(1)
    })

    it('multiple actions (array)', () => {
      const log: string[] = []

      const machine = createMachine<{
        input: { log: string[] }
        events: { SUBMIT: undefined }
        actions: 'validate' | 'save' | 'notify'
      }>({
        on: { SUBMIT: ['validate', 'save', 'notify'] },
        actions: {
          validate: (ctx) => ctx.log.push('validate'),
          save: (ctx) => ctx.log.push('save'),
          notify: (ctx) => ctx.log.push('notify'),
        },
      })

      machine.send('SUBMIT', { log })
      expect(log).toEqual(['validate', 'save', 'notify'])
    })

    it('conditional handlers (Rule[])', () => {
      const open = vi.fn()
      const close = vi.fn()

      const machine = createMachine<{
        input: { isOpen: boolean; open: () => void; close: () => void }
        events: { TOGGLE: undefined }
        actions: 'open' | 'close'
      }>({
        on: {
          TOGGLE: [
            { when: (ctx) => ctx.isOpen, do: 'close' },
            { do: 'open' },
          ],
        },
        actions: {
          open: (ctx) => ctx.open(),
          close: (ctx) => ctx.close(),
        },
      })

      machine.send('TOGGLE', { isOpen: true, open, close })
      expect(close).toHaveBeenCalled()
      expect(open).not.toHaveBeenCalled()

      vi.clearAllMocks()

      machine.send('TOGGLE', { isOpen: false, open, close })
      expect(open).toHaveBeenCalled()
      expect(close).not.toHaveBeenCalled()
    })

    it('conditional with multiple actions', () => {
      const log: string[] = []

      const machine = createMachine<{
        input: { isValid: boolean; log: string[] }
        events: { CONFIRM: undefined }
        actions: 'save' | 'close' | 'notify' | 'showError'
      }>({
        on: {
          CONFIRM: [
            { when: (ctx) => !ctx.isValid, do: 'showError' },
            { do: ['save', 'close', 'notify'] },
          ],
        },
        actions: {
          save: (ctx) => ctx.log.push('save'),
          close: (ctx) => ctx.log.push('close'),
          notify: (ctx) => ctx.log.push('notify'),
          showError: (ctx) => ctx.log.push('error'),
        },
      })

      machine.send('CONFIRM', { isValid: true, log })
      expect(log).toEqual(['save', 'close', 'notify'])
    })

    it('payload is passed to actions', () => {
      const select = vi.fn()

      const machine = createMachine<{
        input: { select: (id: string) => void }
        events: { SELECT: { id: string } }
        actions: 'select'
      }>({
        on: { SELECT: 'select' },
        actions: {
          select: (ctx, payload) => ctx.select(payload!.id),
        },
      })

      machine.send('SELECT', { select }, { id: 'item-1' })
      expect(select).toHaveBeenCalledWith('item-1')
    })
  })

  // ============================================
  // computed: Derived Values
  // Tests for computed values derived from input/internal
  // Available in context for guards and actions
  // ============================================

  describe('computed: Derived Values', () => {
    it('computed values available in context and guards', () => {
      const prev = vi.fn()
      const next = vi.fn()

      const machine = createMachine<{
        input: { page: number; total: number; prev: () => void; next: () => void }
        events: { PREV: undefined; NEXT: undefined }
        computed: { hasPrev: boolean; hasNext: boolean }
        actions: 'prev' | 'next'
      }>({
        computed: {
          hasPrev: (input) => input.page > 1,
          hasNext: (input) => input.page < input.total,
        },
        on: {
          PREV: [{ when: (ctx) => ctx.hasPrev, do: 'prev' }],
          NEXT: [{ when: (ctx) => ctx.hasNext, do: 'next' }],
        },
        actions: {
          prev: (ctx) => ctx.prev(),
          next: (ctx) => ctx.next(),
        },
      })

      // page 1 of 3: hasPrev=false, hasNext=true
      machine.send('PREV', { page: 1, total: 3, prev, next })
      expect(prev).not.toHaveBeenCalled()

      machine.send('NEXT', { page: 1, total: 3, prev, next })
      expect(next).toHaveBeenCalled()
    })

    it('getSnapshot returns computed values', () => {
      const machine = createMachine<{
        input: { count: number }
        computed: { doubled: number; isPositive: boolean }
      }>({
        computed: {
          doubled: (input) => input.count * 2,
          isPositive: (input) => input.count > 0,
        },
      })

      const snapshot = machine.getSnapshot({ count: 5 })
      expect(snapshot.doubled).toBe(10)
      expect(snapshot.isPositive).toBe(true)
    })
  })

  // ============================================
  // states: State-based Handlers (FSM)
  // Tests for state-specific event handlers
  // Handlers only run when machine is in matching state
  // ============================================

  describe('states: State-based Handlers', () => {
    it('executes handlers based on current state', () => {
      const log: string[] = []

      const machine = createMachine<{
        input: { state: 'idle' | 'loading' | 'success'; log: string[] }
        events: { FETCH: undefined; RESOLVE: undefined }
        actions: 'startLoading' | 'setSuccess'
        state: 'idle' | 'loading' | 'success'
      }>({
        states: {
          idle: { on: { FETCH: 'startLoading' } },
          loading: { on: { RESOLVE: 'setSuccess' } },
          success: {},
        },
        actions: {
          startLoading: (ctx) => ctx.log.push('loading'),
          setSuccess: (ctx) => ctx.log.push('success'),
        },
      })

      machine.send('FETCH', { state: 'idle', log })
      expect(log).toEqual(['loading'])

      machine.send('FETCH', { state: 'loading', log }) // ignored
      expect(log).toEqual(['loading'])

      machine.send('RESOLVE', { state: 'loading', log })
      expect(log).toEqual(['loading', 'success'])
    })

    it('global handlers run after state handlers', () => {
      const log: string[] = []

      const machine = createMachine<{
        input: { state: 'idle'; log: string[] }
        events: { ACTION: undefined }
        actions: 'stateAction' | 'globalAction'
        state: 'idle'
      }>({
        states: {
          idle: { on: { ACTION: 'stateAction' } },
        },
        on: { ACTION: 'globalAction' },
        actions: {
          stateAction: (ctx) => ctx.log.push('state'),
          globalAction: (ctx) => ctx.log.push('global'),
        },
      })

      machine.send('ACTION', { state: 'idle', log })
      expect(log).toEqual(['state', 'global'])
    })

    it('FSM with internal.state (state managed by machine)', () => {
      // This tests the pattern where state lives in internal (managed by machine)
      // rather than in input (managed by component)
      const machine = createMachine<{
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

      // Initial state
      expect(machine.getSnapshot({}).state).toBe('idle')

      // idle -> loading
      machine.send('FETCH', {})
      expect(machine.getSnapshot({}).state).toBe('loading')

      // FETCH ignored while loading
      machine.send('FETCH', {})
      expect(machine.getSnapshot({}).state).toBe('loading')

      // loading -> error
      machine.send('FAIL', {})
      expect(machine.getSnapshot({}).state).toBe('error')

      // error -> loading (retry)
      machine.send('RETRY', {})
      expect(machine.getSnapshot({}).state).toBe('loading')

      // loading -> idle (success)
      machine.send('SUCCESS', {})
      expect(machine.getSnapshot({}).state).toBe('idle')
    })
  })

  // ============================================
  // effects: Watch-based Side Effects
  // Tests for effect lifecycle callbacks
  // enter: falsy→truthy, exit: truthy→falsy, change: any change
  // ============================================

  describe('effects: Watch-based Side Effects', () => {
    it('enter: called when watch becomes truthy', () => {
      const enter = vi.fn()

      const machine = createMachine<{ input: { isOpen: boolean } }>({
        effects: [{ watch: (ctx) => ctx.isOpen, enter: () => enter() }],
      })

      machine.evaluate({ isOpen: false })
      expect(enter).not.toHaveBeenCalled()

      machine.evaluate({ isOpen: true })
      expect(enter).toHaveBeenCalledTimes(1)
    })

    it('exit: called when watch becomes falsy', () => {
      const exit = vi.fn()

      const machine = createMachine<{ input: { isOpen: boolean } }>({
        effects: [{ watch: (ctx) => ctx.isOpen, exit: () => exit() }],
      })

      machine.evaluate({ isOpen: true })
      machine.evaluate({ isOpen: false })
      expect(exit).toHaveBeenCalledTimes(1)
    })

    it('change: called on any value change with prev/curr', () => {
      const change = vi.fn()

      const machine = createMachine<{ input: { focusedId: string | null } }>({
        effects: [{ watch: (ctx) => ctx.focusedId, change: (_, prev, curr) => change(prev, curr) }],
      })

      machine.evaluate({ focusedId: 'a' })
      expect(change).toHaveBeenCalledWith(undefined, 'a')

      machine.evaluate({ focusedId: 'b' })
      expect(change).toHaveBeenCalledWith('a', 'b')
    })

    it('cleanup function is called on next change', () => {
      const cleanup = vi.fn()

      const machine = createMachine<{ input: { query: string } }>({
        effects: [{ watch: (ctx) => ctx.query, change: () => cleanup }],
      })

      machine.evaluate({ query: 'a' })
      expect(cleanup).not.toHaveBeenCalled()

      machine.evaluate({ query: 'b' })
      expect(cleanup).toHaveBeenCalledTimes(1)

      machine.evaluate({ query: 'c' })
      expect(cleanup).toHaveBeenCalledTimes(2)
    })

    it('send is available in effect callbacks', () => {
      const log: string[] = []

      const machine = createMachine<{
        input: { isHovered: boolean; log: string[] }
        events: { DELAYED_OPEN: undefined }
        actions: 'delayedOpen'
      }>({
        effects: [{ watch: (ctx) => ctx.isHovered, enter: (_, { send }) => { send('DELAYED_OPEN') } }],
        on: { DELAYED_OPEN: 'delayedOpen' },
        actions: { delayedOpen: (ctx) => ctx.log.push('opened') },
      })

      machine.evaluate({ isHovered: true, log })
      expect(log).toEqual(['opened'])
    })

    it('cleanup is called on machine.cleanup()', () => {
      const enterCleanup = vi.fn()
      const changeCleanup = vi.fn()

      const machine = createMachine<{ input: { value: number } }>({
        effects: [{ watch: (ctx) => ctx.value, enter: () => enterCleanup, change: () => changeCleanup }],
      })

      machine.evaluate({ value: 1 })
      machine.evaluate({ value: 2 })

      machine.cleanup()
      expect(enterCleanup).toHaveBeenCalled()
      expect(changeCleanup).toHaveBeenCalled()
    })
  })

  // ============================================
  // always: Auto-evaluated Rules
  // Tests for rules that run on every context change
  // First matching rule wins (short-circuit)
  // ============================================

  describe('always: Auto-evaluated Rules', () => {
    it('always rules are evaluated on evaluate()', () => {
      const clamp = vi.fn()

      const machine = createMachine<{
        input: { value: number; clamp: (v: number) => void }
        actions: 'clampToMax' | 'clampToMin'
      }>({
        always: [
          { when: (ctx) => ctx.value > 100, do: 'clampToMax' },
          { when: (ctx) => ctx.value < 0, do: 'clampToMin' },
        ],
        actions: {
          clampToMax: (ctx) => ctx.clamp(100),
          clampToMin: (ctx) => ctx.clamp(0),
        },
      })

      machine.evaluate({ value: 150, clamp })
      expect(clamp).toHaveBeenCalledWith(100)

      vi.clearAllMocks()

      machine.evaluate({ value: -10, clamp })
      expect(clamp).toHaveBeenCalledWith(0)

      vi.clearAllMocks()

      machine.evaluate({ value: 50, clamp })
      expect(clamp).not.toHaveBeenCalled()
    })
  })

  // ============================================
  // guards: String and Function Guards
  // Tests for conditional execution via guards
  // Supports named strings, inline functions, and arrays (AND logic)
  // ============================================

  describe('guards: String and Function Guards', () => {
    it('string guards are resolved from machine guards', () => {
      const action = vi.fn()

      const machine = createMachine<{
        input: { value: number }
        events: { CHECK: undefined }
        actions: 'doAction'
        guards: 'isPositive'
      }>({
        on: { CHECK: [{ when: 'isPositive', do: 'doAction' }] },
        actions: { doAction: action },
        guards: { isPositive: (ctx) => ctx.value > 0 },
      })

      machine.send('CHECK', { value: 5 })
      expect(action).toHaveBeenCalledTimes(1)

      vi.clearAllMocks()

      machine.send('CHECK', { value: -5 })
      expect(action).not.toHaveBeenCalled()
    })

    it('string guards work in always rules', () => {
      const action = vi.fn()

      const machine = createMachine<{
        input: { value: number }
        actions: 'normalize'
        guards: 'needsNormalization'
      }>({
        always: [{ when: 'needsNormalization', do: 'normalize' }],
        actions: { normalize: action },
        guards: { needsNormalization: (ctx) => ctx.value > 100 },
      })

      machine.evaluate({ value: 50 })
      expect(action).not.toHaveBeenCalled()

      machine.evaluate({ value: 150 })
      expect(action).toHaveBeenCalledTimes(1)
    })

    it('function and string guards can be mixed', () => {
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
        guards: { stringGuard: (ctx) => ctx.value > 0 },
      })

      machine.send('CHECK', { value: 5 })
      expect(action1).toHaveBeenCalledTimes(1)
      expect(action2).not.toHaveBeenCalled()

      vi.clearAllMocks()

      machine.send('CHECK', { value: -5 })
      expect(action1).not.toHaveBeenCalled()
      expect(action2).toHaveBeenCalledTimes(1)
    })

    it('guard arrays use AND logic', () => {
      const action = vi.fn()

      const machine = createMachine<{
        input: { a: boolean; b: boolean }
        events: { CHECK: undefined }
        actions: 'action'
      }>({
        on: { CHECK: [{ when: [(ctx) => ctx.a, (ctx) => ctx.b], do: 'action' }] },
        actions: { action },
      })

      machine.send('CHECK', { a: false, b: false })
      machine.send('CHECK', { a: true, b: false })
      machine.send('CHECK', { a: false, b: true })
      expect(action).not.toHaveBeenCalled()

      machine.send('CHECK', { a: true, b: true })
      expect(action).toHaveBeenCalledTimes(1)
    })

    it('not() negates a named guard', () => {
      const action = vi.fn()

      const machine = createMachine<{
        input: { disabled: boolean }
        events: { CLICK: undefined }
        actions: 'handleClick'
        guards: 'isDisabled'
      }>({
        on: { CLICK: [{ when: not('isDisabled'), do: 'handleClick' }] },
        actions: { handleClick: action },
        guards: { isDisabled: (ctx) => ctx.disabled },
      })

      machine.send('CLICK', { disabled: true })
      expect(action).not.toHaveBeenCalled()

      machine.send('CLICK', { disabled: false })
      expect(action).toHaveBeenCalledTimes(1)
    })

    it('not() negates an inline guard', () => {
      const action = vi.fn()

      const machine = createMachine<{
        input: { loading: boolean }
        events: { SUBMIT: undefined }
        actions: 'submit'
      }>({
        on: { SUBMIT: [{ when: not((ctx) => ctx.loading), do: 'submit' }] },
        actions: { submit: action },
      })

      machine.send('SUBMIT', { loading: true })
      expect(action).not.toHaveBeenCalled()

      machine.send('SUBMIT', { loading: false })
      expect(action).toHaveBeenCalledTimes(1)
    })

    it('and() combines guards with AND logic', () => {
      const action = vi.fn()

      const machine = createMachine<{
        input: { hasValue: boolean; isValid: boolean }
        events: { SUBMIT: undefined }
        actions: 'submit'
        guards: 'hasValue' | 'isValid'
      }>({
        on: { SUBMIT: [{ when: and(['hasValue', 'isValid']), do: 'submit' }] },
        actions: { submit: action },
        guards: {
          hasValue: (ctx) => ctx.hasValue,
          isValid: (ctx) => ctx.isValid,
        },
      })

      machine.send('SUBMIT', { hasValue: false, isValid: false })
      machine.send('SUBMIT', { hasValue: true, isValid: false })
      machine.send('SUBMIT', { hasValue: false, isValid: true })
      expect(action).not.toHaveBeenCalled()

      machine.send('SUBMIT', { hasValue: true, isValid: true })
      expect(action).toHaveBeenCalledTimes(1)
    })

    it('or() combines guards with OR logic', () => {
      const action = vi.fn()

      const machine = createMachine<{
        input: { isAdmin: boolean; hasPermission: boolean }
        events: { DELETE: undefined }
        actions: 'delete'
        guards: 'isAdmin' | 'hasPermission'
      }>({
        on: { DELETE: [{ when: or(['isAdmin', 'hasPermission']), do: 'delete' }] },
        actions: { delete: action },
        guards: {
          isAdmin: (ctx) => ctx.isAdmin,
          hasPermission: (ctx) => ctx.hasPermission,
        },
      })

      machine.send('DELETE', { isAdmin: false, hasPermission: false })
      expect(action).not.toHaveBeenCalled()

      machine.send('DELETE', { isAdmin: true, hasPermission: false })
      expect(action).toHaveBeenCalledTimes(1)

      vi.clearAllMocks()

      machine.send('DELETE', { isAdmin: false, hasPermission: true })
      expect(action).toHaveBeenCalledTimes(1)

      vi.clearAllMocks()

      machine.send('DELETE', { isAdmin: true, hasPermission: true })
      expect(action).toHaveBeenCalledTimes(1)
    })

    it('guard utilities can be nested', () => {
      const action = vi.fn()

      // not(or([a, b])) = neither a nor b
      const machine = createMachine<{
        input: { isLoading: boolean; isDisabled: boolean }
        events: { CLICK: undefined }
        actions: 'handleClick'
        guards: 'isLoading' | 'isDisabled'
      }>({
        on: {
          CLICK: [{ when: not(or(['isLoading', 'isDisabled'])), do: 'handleClick' }],
        },
        actions: { handleClick: action },
        guards: {
          isLoading: (ctx) => ctx.isLoading,
          isDisabled: (ctx) => ctx.isDisabled,
        },
      })

      machine.send('CLICK', { isLoading: true, isDisabled: false })
      machine.send('CLICK', { isLoading: false, isDisabled: true })
      machine.send('CLICK', { isLoading: true, isDisabled: true })
      expect(action).not.toHaveBeenCalled()

      machine.send('CLICK', { isLoading: false, isDisabled: false })
      expect(action).toHaveBeenCalledTimes(1)
    })

    it('guard utilities work with mixed named and inline guards', () => {
      const action = vi.fn()

      const machine = createMachine<{
        input: { hasValue: boolean; count: number }
        events: { CHECK: undefined }
        actions: 'action'
        guards: 'hasValue'
      }>({
        on: {
          CHECK: [
            { when: and(['hasValue', (ctx) => ctx.count > 0]), do: 'action' },
          ],
        },
        actions: { action },
        guards: { hasValue: (ctx) => ctx.hasValue },
      })

      machine.send('CHECK', { hasValue: true, count: 0 })
      machine.send('CHECK', { hasValue: false, count: 5 })
      expect(action).not.toHaveBeenCalled()

      machine.send('CHECK', { hasValue: true, count: 5 })
      expect(action).toHaveBeenCalledTimes(1)
    })
  })

  // ============================================
  // Inline Functions in do Field
  // Tests for inline function actions in rule 'do' field
  // Can be mixed with named action strings
  // ============================================

  describe('Inline Functions in do Field', () => {
    it('inline function in do', () => {
      const log: string[] = []

      const machine = createMachine<{
        input: { log: string[] }
        events: { ACTION: undefined }
      }>({
        on: { ACTION: [{ do: (ctx) => ctx.log.push('inline') }] },
      })

      machine.send('ACTION', { log })
      expect(log).toEqual(['inline'])
    })

    it('mixed string and inline functions in do array', () => {
      const log: string[] = []

      const machine = createMachine<{
        input: { log: string[] }
        events: { ACTION: undefined }
        actions: 'action1' | 'action2'
      }>({
        on: {
          ACTION: [{ do: ['action1', (ctx) => ctx.log.push('inline'), 'action2'] }],
        },
        actions: {
          action1: (ctx) => ctx.log.push('action1'),
          action2: (ctx) => ctx.log.push('action2'),
        },
      })

      machine.send('ACTION', { log })
      expect(log).toEqual(['action1', 'inline', 'action2'])
    })

    it('payload passed to inline function', () => {
      const select = vi.fn()

      const machine = createMachine<{
        input: { select: (id: string) => void }
        events: { SELECT: { id: string } }
      }>({
        on: { SELECT: [{ do: (ctx, payload) => ctx.select(payload.id) }] },
      })

      machine.send('SELECT', { select }, { id: 'item-1' })
      expect(select).toHaveBeenCalledWith('item-1')
    })
  })

  // ============================================
  // internal: Internal State
  // Tests for machine-managed internal state
  // Updated via assign(), persists across events
  // ============================================

  describe('internal: Internal State', () => {
    it('internal state in snapshot with computed', () => {
      const machine = createMachine<{
        input: { multiplier: number }
        internal: { count: number }
        computed: { total: number }
      }>({
        internal: { count: 5 },
        computed: { total: (ctx) => ctx.count * ctx.multiplier },
      })

      const snapshot = machine.getSnapshot({ multiplier: 2 })
      expect(snapshot.count).toBe(5)
      expect(snapshot.total).toBe(10)
    })

    it('assign updates internal state', () => {
      const machine = createMachine<{
        input: { increment: number }
        internal: { count: number }
        events: { INCREMENT: undefined }
      }>({
        internal: { count: 0 },
        on: { INCREMENT: (ctx, _, assign) => assign({ count: ctx.count + ctx.increment }) },
      })

      machine.send('INCREMENT', { increment: 5 })
      expect(machine.getInternal().count).toBe(5)

      machine.send('INCREMENT', { increment: 3 })
      expect(machine.getInternal().count).toBe(8)
    })

    it('getInitialInternal and setInternal', () => {
      const machine = createMachine<{
        internal: { isOpen: boolean; count: number }
      }>({
        internal: { isOpen: false, count: 0 },
      })

      expect(machine.getInitialInternal()).toEqual({ isOpen: false, count: 0 })

      machine.setInternal({ isOpen: true, count: 100 })
      expect(machine.getInternal()).toEqual({ isOpen: true, count: 100 })
    })

    it('internal state persists across multiple send calls', () => {
      const machine = createMachine<{
        input: { delta: number }
        internal: { value: number }
        events: { ADD: undefined; SUBTRACT: undefined }
      }>({
        internal: { value: 10 },
        on: {
          ADD: (ctx, _, assign) => assign({ value: ctx.value + ctx.delta }),
          SUBTRACT: (ctx, _, assign) => assign({ value: ctx.value - ctx.delta }),
        },
      })

      machine.send('ADD', { delta: 5 })
      expect(machine.getInternal().value).toBe(15)

      machine.send('SUBTRACT', { delta: 3 })
      expect(machine.getInternal().value).toBe(12)

      machine.send('ADD', { delta: 8 })
      expect(machine.getInternal().value).toBe(20)
    })

    it('sequential actions see fresh context after each assign', () => {
      const log: number[] = []

      const machine = createMachine<{
        internal: { count: number }
        events: { INCREMENT_TWICE: undefined }
      }>({
        internal: { count: 0 },
        on: {
          // Each action should see updated count from previous assign
          INCREMENT_TWICE: [
            (ctx, _, assign) => {
              log.push(ctx.count) // Should be 0
              assign({ count: ctx.count + 1 })
            },
            (ctx, _, assign) => {
              log.push(ctx.count) // Should be 1 (fresh context)
              assign({ count: ctx.count + 1 })
            },
          ],
        },
      })

      machine.send('INCREMENT_TWICE', {})
      expect(log).toEqual([0, 1]) // Each action saw fresh context
      expect(machine.getInternal().count).toBe(2)
    })

    it('sequential named actions see fresh context', () => {
      const log: number[] = []

      const machine = createMachine<{
        internal: { value: number }
        events: { TRIPLE: undefined }
        actions: 'addOne' | 'logValue'
      }>({
        internal: { value: 10 },
        on: {
          TRIPLE: ['logValue', 'addOne', 'logValue', 'addOne', 'logValue'],
        },
        actions: {
          addOne: (ctx, _, assign) => assign({ value: ctx.value + 1 }),
          logValue: (ctx) => log.push(ctx.value),
        },
      })

      machine.send('TRIPLE', {})
      expect(log).toEqual([10, 11, 12]) // Fresh context after each assign
      expect(machine.getInternal().value).toBe(12)
    })
  })
})
