/**
 * Controlled Machine - React Integration
 *
 * React hook for using controlled-machine in React components.
 *
 * Features:
 * - Internal state management via React state
 * - Automatic effect processing on context changes
 * - Stable send function reference (uses refs internally)
 * - Unmount-safe callbacks
 * - Action/guard overrides via options
 *
 * @example
 * const [snapshot, send] = useMachine(counterMachine, {
 *   input: { multiplier },
 *   actions: { logValue: (ctx) => console.log(ctx.count) },
 *   guards: { isPositive: (ctx) => ctx.count > 0 }
 * })
 */

import { useCallback, useRef, useEffect, useMemo, useState } from 'react'
import {
  type MachineTypes,
  type Events,
  type State,
  type Send,
  type Snapshot,
  type EffectHelpers,
  type EffectStore,
  type Context,
  type Internal,
  type Input,
  type Actions,
  type Guards,
  type AssignFn,
  buildContext,
  computeValues,
  createAssign,
  executeRuleActions,
  evaluateGuards,
  executeHandler,
  processEffects,
  clearEffectStore,
  buildSnapshot,
  MachineInstance,
} from './index'

// ============================================
// useMachine Options Type
// ============================================

/**
 * Options for useMachine hook
 * @property input - External state to pass to the machine (React state, props, etc.)
 * @property actions - Override or add action implementations
 * @property guards - Override or add guard implementations
 */
export type UseMachineOptions<T extends MachineTypes> = {
  input?: Input<T>
  actions?: Partial<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [K in Actions<T>]: (context: Context<T>, payload: any, assign: AssignFn<Internal<T>>) => void
  }>
  guards?: Partial<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [K in Guards<T>]: (context: Context<T>, payload?: any) => boolean
  }>
}

// ============================================
// React Hook - useMachine
// ============================================

/**
 * React hook for using controlled-machine
 *
 * @param machineOrFactory - Machine instance or factory function (factory ensures fresh instance per component)
 * @param options - Hook options (input, actions override, guards override)
 * @returns [snapshot, send] tuple - snapshot contains internal + computed + state, send dispatches events
 *
 * @example
 * // Basic usage
 * const [snapshot, send] = useMachine(machine, { input: { count, setCount } })
 *
 * // With factory (recommended for isolation)
 * const [snapshot, send] = useMachine(() => createCounterMachine(100), { input: {} })
 *
 * // With action/guard overrides
 * const [snapshot, send] = useMachine(machine, {
 *   input: { count },
 *   actions: { log: (ctx) => console.log(ctx.count) },
 *   guards: { canIncrement: (ctx) => ctx.count < 10 }
 * })
 */
export function useMachine<T extends MachineTypes>(
  machineOrFactory: MachineInstance<T> | (() => MachineInstance<T>),
  options: UseMachineOptions<T> = {},
): [Snapshot<T>, Send<Events<T>>] {
  const { input = {} as Input<T>, actions: optionsActions, guards: optionsGuards } = options

  // ---- Machine initialization ----
  // Factory pattern ensures each component gets its own machine instance
  const machine = useMemo(
    () => (typeof machineOrFactory === 'function' ? machineOrFactory() : machineOrFactory),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // Only run once on mount
  )

  // ---- Internal state (React-managed) ----
  const [internal, setInternal] = useState<Internal<T>>(() => machine.getInitialInternal())

  // ---- Merge machine actions/guards with options overrides ----
  const mergedActions = useMemo(
    () => ({ ...machine.actions, ...optionsActions }),
    [machine.actions, optionsActions],
  )
  const mergedGuards = useMemo(
    () => ({ ...machine.guards, ...optionsGuards }) as Record<string, (context: Context<T>, payload?: unknown) => boolean>,
    [machine.guards, optionsGuards],
  )

  // ---- Refs for stable callbacks (avoid stale closures) ----
  const inputRef = useRef(input)
  const internalRef = useRef(internal)
  const machineRef = useRef(machine)
  const mergedActionsRef = useRef(mergedActions)
  const mergedGuardsRef = useRef(mergedGuards)
  const isMountedRef = useRef(true)

  // Keep refs updated with latest values
  inputRef.current = input
  internalRef.current = internal
  machineRef.current = machine
  mergedActionsRef.current = mergedActions
  mergedGuardsRef.current = mergedGuards

  // ---- Build full context (input + internal + computed) ----
  const { computed: computedDef } = machine
  const context = useMemo(() => {
    const base = buildContext(input, internal)
    return computeValues(base, computedDef) as Context<T>
  }, [input, internal, computedDef])

  const contextRef = useRef(context)
  contextRef.current = context

  // Track previous context for always rules
  const prevContextRef = useRef<Context<T>>(context)
  // Effect store for tracking watched values and cleanups
  const effectStoreRef = useRef<EffectStore>({
    watchedValues: new Map(),
    enterCleanups: new Map(),
    changeCleanups: new Map(),
    exitCleanups: new Map(),
  })

  // ---- Internal state updater ----
  // Updates ref immediately (for subsequent assigns in same handler) + triggers re-render
  const updateInternal = useCallback((newInternal: Internal<T>) => {
    internalRef.current = newInternal  // Immediate update for subsequent assigns
    setInternal(newInternal)           // Trigger re-render
  }, [])

  // ---- Assign function (for updating internal state) ----
  const assign = useMemo(() => createAssign(() => internalRef.current, updateInternal), [updateInternal])
  const assignRef = useRef(assign)
  assignRef.current = assign

  // ---- Always rules (evaluated during render on context change) ----
  // getContext rebuilds context with latest internal state for fresh values after assigns
  const getContext = useCallback(() => {
    const base = buildContext(inputRef.current, internalRef.current)
    return computeValues(base, machineRef.current.computed) as Context<T>
  }, [])

  const { always } = machine
  if (prevContextRef.current !== context && always) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actionsMap = mergedActions as Record<string, (context: Context<T>, payload: any, assign: AssignFn<Internal<T>>) => void>
    const guardsMap = mergedGuards as Record<string, (context: Context<T>) => boolean>
    for (const rule of always) {
      if (evaluateGuards(rule.when, guardsMap, getContext(), undefined)) {
        executeRuleActions(rule.do, actionsMap, getContext, undefined, assign)
        break  // First matching rule wins
      }
    }
  }
  prevContextRef.current = context

  // ---- Send function (stable reference, uses refs internally) ----
  const send: Send<Events<T>> = useCallback(
    <K extends keyof Events<T>>(
      event: K,
      ...args: Events<T>[K] extends undefined ? [] : [payload: Events<T>[K]]
    ) => {
      const currentMachine = machineRef.current
      const currentActions = mergedActionsRef.current
      const currentGuards = mergedGuardsRef.current

      // Create fresh assign - updates ref immediately + triggers re-render
      const currentAssign = createAssign(
        () => internalRef.current,
        (newInternal) => {
          internalRef.current = newInternal
          setInternal(newInternal)
        }
      )

      // getContext rebuilds context with latest internal state
      const getCurrentContext = () => {
        const base = buildContext(inputRef.current, internalRef.current)
        return computeValues(base, currentMachine.computed) as Context<T>
      }

      const payload = args[0] as Events<T>[K]

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const actionsMap = (currentActions ?? {}) as Record<string, (ctx: Context<T>, payload: any, assign: AssignFn<Internal<T>>) => void>
      const guardsMap = currentGuards as Record<string, (ctx: Context<T>, payload?: unknown) => boolean>

      // 1. Execute state-specific handler (if in FSM mode)
      const currentContext = getCurrentContext()
      const state = (currentContext as { state?: State<T> }).state
      if (state && currentMachine.states?.[state]?.on?.[event]) {
        const stateHandler = currentMachine.states[state].on![event]!
        executeHandler(
          stateHandler,
          actionsMap,
          guardsMap,
          getCurrentContext,
          payload,
          currentAssign,
        )
      }

      // 2. Execute global handler
      const globalHandler = currentMachine.on?.[event]
      if (globalHandler) {
        executeHandler(
          globalHandler,
          actionsMap,
          guardsMap,
          getCurrentContext,
          payload,
          currentAssign,
        )
      }
    },
    [], // No dependencies - uses refs for latest values
  )

  // ---- Safe send (no-op after unmount) ----
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

  // ---- Effect helpers (passed to effect callbacks) ----
  const effectHelpers: EffectHelpers<Events<T>> = useMemo(
    () => ({ send: safeSend }),
    [safeSend],
  )

  // ---- Process effects on context change ----
  const { effects } = machine
  useEffect(() => {
    processEffects(effects, context, effectHelpers, effectStoreRef.current)
  }, [context, effects, effectHelpers])

  // ---- Mount/unmount lifecycle ----
  useEffect(() => {
    isMountedRef.current = true
    const store = effectStoreRef.current
    return () => {
      isMountedRef.current = false
      clearEffectStore(store)  // Clean up all effect callbacks on unmount
    }
  }, [])

  // ---- Build snapshot (internal + computed + state) ----
  const snapshot = useMemo(
    () => buildSnapshot(internal, context, computedDef),
    [internal, context, computedDef],
  )

  return [snapshot, send]
}

// Re-export types for convenience
export type { Send } from './index'
