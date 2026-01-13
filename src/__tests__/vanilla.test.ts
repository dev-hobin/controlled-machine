import { describe, it, expect, vi } from 'vitest'
import { createMachine } from '../index'

describe('Vanilla: createMachine', () => {
  // --------------------------------------------
  // on: Event Handlers
  // --------------------------------------------

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

  // --------------------------------------------
  // computed: Derived Values
  // --------------------------------------------

  describe('computed: Derived Values', () => {
    it('computed values available in context', () => {
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

    it('getComputed returns computed values', () => {
      const machine = createMachine<{
        input: { count: number }
        computed: { doubled: number; isPositive: boolean }
      }>({
        computed: {
          doubled: (input) => input.count * 2,
          isPositive: (input) => input.count > 0,
        },
      })

      const computed = machine.getComputed({ count: 5 })
      expect(computed.doubled).toBe(10)
      expect(computed.isPositive).toBe(true)
    })
  })

  // --------------------------------------------
  // states: State-based Handlers
  // --------------------------------------------

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
          idle: {
            on: { FETCH: 'startLoading' },
          },
          loading: {
            on: { RESOLVE: 'setSuccess' },
          },
          success: {},
        },
        actions: {
          startLoading: (ctx) => ctx.log.push('loading'),
          setSuccess: (ctx) => ctx.log.push('success'),
        },
      })

      machine.send('FETCH', { state: 'idle', log })
      expect(log).toEqual(['loading'])

      machine.send('FETCH', { state: 'loading', log })
      expect(log).toEqual(['loading']) // ignored

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
          idle: {
            on: { ACTION: 'stateAction' },
          },
        },
        on: {
          ACTION: 'globalAction',
        },
        actions: {
          stateAction: (ctx) => ctx.log.push('state'),
          globalAction: (ctx) => ctx.log.push('global'),
        },
      })

      machine.send('ACTION', { state: 'idle', log })
      expect(log).toEqual(['state', 'global'])
    })
  })

  // --------------------------------------------
  // effects: Watch-based Side Effects
  // --------------------------------------------

  describe('effects: Watch-based Side Effects', () => {
    it('enter: called when watch becomes truthy', () => {
      const enter = vi.fn()

      const machine = createMachine<{
        input: { isOpen: boolean }
      }>({
        effects: [
          {
            watch: (ctx) => ctx.isOpen,
            enter: () => enter(),
          },
        ],
      })

      machine.evaluate({ isOpen: false })
      expect(enter).not.toHaveBeenCalled()

      machine.evaluate({ isOpen: true })
      expect(enter).toHaveBeenCalledTimes(1)
    })

    it('exit: called when watch becomes falsy', () => {
      const exit = vi.fn()

      const machine = createMachine<{
        input: { isOpen: boolean }
      }>({
        effects: [
          {
            watch: (ctx) => ctx.isOpen,
            exit: () => exit(),
          },
        ],
      })

      machine.evaluate({ isOpen: true })
      expect(exit).not.toHaveBeenCalled()

      machine.evaluate({ isOpen: false })
      expect(exit).toHaveBeenCalledTimes(1)
    })

    it('change: called on any value change', () => {
      const change = vi.fn()

      const machine = createMachine<{
        input: { focusedId: string | null }
      }>({
        effects: [
          {
            watch: (ctx) => ctx.focusedId,
            change: (_ctx, prev, curr) => change(prev, curr),
          },
        ],
      })

      machine.evaluate({ focusedId: 'a' })
      expect(change).toHaveBeenCalledWith(undefined, 'a')

      machine.evaluate({ focusedId: 'b' })
      expect(change).toHaveBeenCalledWith('a', 'b')

      machine.evaluate({ focusedId: null })
      expect(change).toHaveBeenCalledWith('b', null)
    })

    it('cleanup function is called on change', () => {
      const cleanup = vi.fn()

      const machine = createMachine<{
        input: { query: string }
      }>({
        effects: [
          {
            watch: (ctx) => ctx.query,
            change: () => cleanup,
          },
        ],
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
        effects: [
          {
            watch: (ctx) => ctx.isHovered,
            enter: (_ctx, { send }) => {
              send('DELAYED_OPEN')
            },
          },
        ],
        on: { DELAYED_OPEN: 'delayedOpen' },
        actions: {
          delayedOpen: (ctx) => ctx.log.push('opened'),
        },
      })

      machine.evaluate({ isHovered: true, log })
      expect(log).toEqual(['opened'])
    })

    it('cleanup is called on machine.cleanup()', () => {
      const enterCleanup = vi.fn()
      const changeCleanup = vi.fn()

      const machine = createMachine<{
        input: { value: number }
      }>({
        effects: [
          {
            watch: (ctx) => ctx.value,
            enter: () => enterCleanup,
            change: () => changeCleanup,
          },
        ],
      })

      machine.evaluate({ value: 1 })
      machine.evaluate({ value: 2 })

      machine.cleanup()
      expect(enterCleanup).toHaveBeenCalled()
      expect(changeCleanup).toHaveBeenCalled()
    })
  })

  // --------------------------------------------
  // always: Auto-evaluated Rules
  // --------------------------------------------

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

  // --------------------------------------------
  // guards: String-based Guard Names
  // --------------------------------------------

  describe('guards: String-based Guard Names', () => {
    it('string guards are resolved from machine guards', () => {
      const action = vi.fn()

      const machine = createMachine<{
        input: { value: number }
        events: { CHECK: undefined }
        actions: 'doAction'
        guards: 'isPositive'
      }>({
        on: {
          CHECK: [{ when: 'isPositive', do: 'doAction' }],
        },
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

      // value > 0: stringGuard passes
      machine.send('CHECK', { value: 5 })
      expect(action1).toHaveBeenCalledTimes(1)
      expect(action2).not.toHaveBeenCalled()

      vi.clearAllMocks()

      // value < 0: stringGuard fails, function guard passes
      machine.send('CHECK', { value: -5 })
      expect(action1).not.toHaveBeenCalled()
      expect(action2).toHaveBeenCalledTimes(1)
    })
  })

  // --------------------------------------------
  // Inline Functions in do Field
  // --------------------------------------------

  describe('Inline Functions in do Field', () => {
    it('single inline function in do', () => {
      const log: string[] = []

      const machine = createMachine<{
        input: { log: string[] }
        events: { ACTION: undefined }
      }>({
        on: {
          ACTION: [{ do: (ctx) => ctx.log.push('inline') }],
        },
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

      machine.send('ACTION', { log })
      expect(log).toEqual(['action1', 'inline', 'action2'])
    })

    it('payload is passed to inline function in do', () => {
      const select = vi.fn()

      const machine = createMachine<{
        input: { select: (id: string) => void }
        events: { SELECT: { id: string } }
      }>({
        on: {
          SELECT: [{ do: (ctx, payload) => ctx.select(payload.id) }],
        },
      })

      machine.send('SELECT', { select }, { id: 'item-1' })
      expect(select).toHaveBeenCalledWith('item-1')
    })

    it('inline function in always rules', () => {
      const clamp = vi.fn()

      const machine = createMachine<{
        input: { value: number; clamp: (v: number) => void }
      }>({
        always: [
          {
            when: (ctx) => ctx.value > 100,
            do: (ctx) => ctx.clamp(100),
          },
        ],
      })

      machine.evaluate({ value: 150, clamp })
      expect(clamp).toHaveBeenCalledWith(100)
    })

    it('inline function with guard in do', () => {
      const log: string[] = []

      const machine = createMachine<{
        input: { isValid: boolean; log: string[] }
        events: { SUBMIT: undefined }
      }>({
        on: {
          SUBMIT: [
            { when: (ctx) => !ctx.isValid, do: (ctx) => ctx.log.push('invalid') },
            { do: (ctx) => ctx.log.push('valid') },
          ],
        },
      })

      machine.send('SUBMIT', { isValid: false, log })
      expect(log).toEqual(['invalid'])

      log.length = 0
      machine.send('SUBMIT', { isValid: true, log })
      expect(log).toEqual(['valid'])
    })
  })

  // --------------------------------------------
  // Guard Arrays in when Field
  // --------------------------------------------

  describe('Guard Arrays in when Field', () => {
    it('all guards must pass for action to execute', () => {
      const action = vi.fn()

      const machine = createMachine<{
        input: { a: boolean; b: boolean }
        events: { CHECK: undefined }
        actions: 'action'
      }>({
        on: {
          CHECK: [
            { when: [(ctx) => ctx.a, (ctx) => ctx.b], do: 'action' },
          ],
        },
        actions: { action },
      })

      // Both false - action not called
      machine.send('CHECK', { a: false, b: false })
      expect(action).not.toHaveBeenCalled()

      // Only a true - action not called
      machine.send('CHECK', { a: true, b: false })
      expect(action).not.toHaveBeenCalled()

      // Only b true - action not called
      machine.send('CHECK', { a: false, b: true })
      expect(action).not.toHaveBeenCalled()

      // Both true - action called
      machine.send('CHECK', { a: true, b: true })
      expect(action).toHaveBeenCalledTimes(1)
    })

    it('mixed string and inline guards in array', () => {
      const action = vi.fn()

      const machine = createMachine<{
        input: { a: boolean; b: boolean }
        events: { CHECK: undefined }
        actions: 'action'
        guards: 'isA'
      }>({
        on: {
          CHECK: [
            { when: ['isA', (ctx) => ctx.b], do: 'action' },
          ],
        },
        actions: { action },
        guards: { isA: (ctx) => ctx.a },
      })

      machine.send('CHECK', { a: true, b: false })
      expect(action).not.toHaveBeenCalled()

      machine.send('CHECK', { a: true, b: true })
      expect(action).toHaveBeenCalledTimes(1)
    })

    it('guard array in always rules', () => {
      const clamp = vi.fn()

      const machine = createMachine<{
        input: { value: number; enabled: boolean; clamp: (v: number) => void }
      }>({
        always: [
          {
            when: [(ctx) => ctx.enabled, (ctx) => ctx.value > 100],
            do: (ctx) => ctx.clamp(100),
          },
        ],
      })

      // Not enabled - no clamp
      machine.evaluate({ value: 150, enabled: false, clamp })
      expect(clamp).not.toHaveBeenCalled()

      // Enabled and value > 100 - clamp
      machine.evaluate({ value: 150, enabled: true, clamp })
      expect(clamp).toHaveBeenCalledWith(100)
    })
  })
})
