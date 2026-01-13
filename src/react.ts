/**
 * Controlled Machine - React Integration
 *
 * React hook for using controlled-machine in React components.
 */

import { useCallback, useRef, useEffect, useMemo } from 'react'
import {
  type MachineTypes,
  type Events,
  type Computed,
  type State,
  type Send,
  type EffectHelpers,
  type EffectStore,
  type Context,
  type Actions,
  type Guards,
  computeValues,
  executeRuleActions,
  executeHandler,
  processEffects,
  clearEffectStore,
  MachineInstance,
} from './index'

// ============================================
// useMachine Options Type
// ============================================

export type UseMachineOptions<T extends MachineTypes> = {
  input: T['input']
  actions?: Partial<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [K in Actions<T>]: (context: Context<T>, payload?: any) => void
  }>
  guards?: Partial<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [K in Guards<T>]: (context: Context<T>, payload?: any) => boolean
  }>
}

// ============================================
// React Hook
// ============================================

export function useMachine<T extends MachineTypes>(
  machine: MachineInstance<T>,
  options: UseMachineOptions<T>,
): { send: Send<Events<T>>; computed: Computed<T>; state: State<T> } {
  const { input, actions: optionsActions, guards: optionsGuards } = options

  // Merge actions and guards
  const mergedActions = useMemo(
    () => ({ ...machine.actions, ...optionsActions }),
    [machine.actions, optionsActions],
  )
  const mergedGuards = useMemo(
    () => ({ ...machine.guards, ...optionsGuards }) as Record<string, (context: Context<T>, payload?: unknown) => boolean>,
    [machine.guards, optionsGuards],
  )

  // refs for stable callbacks
  const inputRef = useRef(input)
  const machineRef = useRef(machine)
  const mergedActionsRef = useRef(mergedActions)
  const mergedGuardsRef = useRef(mergedGuards)
  const isMountedRef = useRef(true)

  inputRef.current = input
  machineRef.current = machine
  mergedActionsRef.current = mergedActions
  mergedGuardsRef.current = mergedGuards

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
  const { always } = machine
  if (prevContextRef.current !== context && always) {
    const actionsMap = mergedActions as Record<string, (context: Context<T>) => void>
    const guardsMap = mergedGuards as Record<string, (context: Context<T>) => boolean>
    for (const rule of always) {
      const guardFn =
        typeof rule.when === 'string' ? guardsMap[rule.when] : rule.when

      if (!guardFn || guardFn(context, undefined)) {
        executeRuleActions(rule.do, actionsMap, context, undefined)
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
      const currentActions = mergedActionsRef.current
      const currentGuards = mergedGuardsRef.current
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
          currentActions ?? {},
          currentGuards,
          currentContext,
          payload,
        )
      }

      // 2. Global handler
      const globalHandler = currentMachine.on?.[event]
      if (globalHandler) {
        executeHandler(
          globalHandler,
          currentActions ?? {},
          currentGuards,
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
