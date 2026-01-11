/**
 * Controlled Machine - React Integration
 *
 * React hook for using controlled-machine in React components.
 */

import { useCallback, useRef, useEffect, useMemo } from 'react'
import {
  type MachineTypes,
  type Machine,
  type Events,
  type Computed,
  type State,
  type Send,
  type EffectHelpers,
  type EffectStore,
  type Context,
  computeValues,
  executeActions,
  executeHandler,
  processEffects,
  clearEffectStore,
  MachineInstance,
} from './index'

// ============================================
// React Hook
// ============================================

export function useMachine<T extends MachineTypes>(
  machine: MachineInstance<T>,
  input: T['input'],
): { send: Send<Events<T>>; computed: Computed<T>; state: State<T> } {
  // refs for stable callbacks
  const inputRef = useRef(input)
  const machineRef = useRef(machine)
  const isMountedRef = useRef(true)

  inputRef.current = input
  machineRef.current = machine

  // compute values
  const { computed: computedDef } = machine
  const context = useMemo(
    () => computeValues(input, computedDef),
    [input, computedDef],
  )

  // extract computed only
  const computed = useMemo(() => {
    if (!computedDef) return {} as Computed<T>
    const result = {} as Computed<T>
    for (const key in computedDef) {
      result[key] = context[key]
    }
    return result
  }, [context, computedDef])

  const contextRef = useRef(context)
  contextRef.current = context

  const prevContextRef = useRef<Context<T>>(context)
  const effectStoreRef = useRef<EffectStore>({
    watchedValues: new Map(),
    enterCleanups: new Map(),
    changeCleanups: new Map(),
    exitCleanups: new Map(),
  })

  // always: auto-evaluate when context changes (synchronous, during render)
  const { always, actions } = machine
  if (prevContextRef.current !== context && always && actions) {
    const actionsMap = actions as Record<string, (context: Context<T>) => void>
    for (const rule of always) {
      if (!rule.when || rule.when(context, undefined)) {
        executeActions(rule.do, actionsMap, context, undefined)
        break
      }
    }
  }
  prevContextRef.current = context

  // send: stable function (no deps, uses refs)
  const send: Send<Events<T>> = useCallback(
    <K extends keyof Events<T>>(
      event: K,
      ...args: Events<T>[K] extends undefined ? [] : [payload: Events<T>[K]]
    ) => {
      const currentMachine = machineRef.current
      const currentInput = inputRef.current
      const currentContext = computeValues(
        currentInput,
        currentMachine.computed,
      )
      const payload = args[0] as Events<T>[K]

      // 1. State-specific handler first
      const state = (currentContext as { state?: State<T> }).state
      if (state && currentMachine.states?.[state]?.on?.[event]) {
        const stateHandler = currentMachine.states[state].on![event]!
        executeHandler(
          stateHandler,
          currentMachine.actions ?? {},
          currentContext,
          payload,
        )
      }

      // 2. Global handler
      const globalHandler = currentMachine.on?.[event]
      if (globalHandler) {
        executeHandler(
          globalHandler,
          currentMachine.actions ?? {},
          currentContext,
          payload,
        )
      }
    },
    [], // no dependencies - uses refs
  )

  // safeSend: won't be called after unmount
  const safeSend: Send<Events<T>> = useCallback(
    <K extends keyof Events<T>>(
      event: K,
      ...args: Events<T>[K] extends undefined ? [] : [payload: Events<T>[K]]
    ) => {
      if (!isMountedRef.current) return
      send(event, ...args)
    },
    [send],
  )

  // effect helpers
  const effectHelpers: EffectHelpers<Events<T>> = useMemo(
    () => ({ send: safeSend }),
    [safeSend],
  )

  // effects: detect watch value changes
  const { effects } = machine
  useEffect(() => {
    processEffects(effects, context, effectHelpers, effectStoreRef.current)
  }, [context, effects, effectHelpers])

  // mount/unmount management
  useEffect(() => {
    isMountedRef.current = true
    const store = effectStoreRef.current
    return () => {
      isMountedRef.current = false
      clearEffectStore(store)
    }
  }, [])

  // state from context (default to empty string if not provided)
  const state = (context as { state?: State<T> }).state ?? ('' as State<T>)

  return { send, computed, state }
}

// Re-export types for convenience
export type { Send } from './index'
