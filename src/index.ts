/**
 * Controlled Machine
 *
 * A controlled state machine where state lives outside the machine.
 *
 * - input: External data passed in
 * - computed: Derived values from input
 * - context: input + computed (full context available in handlers)
 * - on: Event → conditional actions
 * - effects: Watch-based side effects
 * - always: Auto-evaluated rules on context change
 */

// ============================================
// Types
// ============================================

export type Rule<
  TContext,
  TPayload = undefined,
  TActions extends string = string,
> = {
  when?: (context: TContext, payload: TPayload) => boolean
  do: TActions | TActions[]
}

export type Handler<
  TContext,
  TPayload = undefined,
  TActions extends string = string,
> = TActions | TActions[] | Rule<TContext, TPayload, TActions>[]

// Effect helpers - utilities available in effect callbacks
export type EffectHelpers<TEvents extends EventsConfig> = {
  send: Send<TEvents>
}

export type Cleanup = () => void

export type Effect<
  TContext,
  TEvents extends EventsConfig,
  TWatched = unknown,
> = {
  watch: (context: TContext) => TWatched
  enter?: (
    context: TContext,
    helpers: EffectHelpers<TEvents>,
  ) => void | Cleanup | Promise<void>
  exit?: (context: TContext, helpers: EffectHelpers<TEvents>) => void | Cleanup
  change?: (
    context: TContext,
    prev: TWatched | undefined,
    curr: TWatched,
    helpers: EffectHelpers<TEvents>,
  ) => void | Cleanup
}

/** Helper for inferring prev/curr types from watch return type */
export function effect<TContext, TEvents extends EventsConfig, TWatched>(
  config: Effect<TContext, TEvents, TWatched>,
): Effect<TContext, TEvents, TWatched> {
  return config
}

export type EventsConfig = Record<string, unknown>
export type ComputedConfig = Record<string, unknown>

// ============================================
// Object-based Generic Types
// ============================================

/**
 * Object-based generic types - specify only needed types in any order
 *
 * @example
 * createMachine<{
 *   input: MyInput
 *   events: MyEvents
 *   actions: 'foo' | 'bar'
 * }>({...})
 */
export type MachineTypes = {
  input?: unknown
  events?: EventsConfig
  computed?: ComputedConfig
  actions?: string
  state?: string
}

export type Input<T extends MachineTypes> = T['input']
export type Events<T extends MachineTypes> = T['events'] extends EventsConfig
  ? T['events']
  : Record<string, undefined>
export type Computed<T extends MachineTypes> = T['computed'] extends ComputedConfig
  ? T['computed']
  : Record<string, never>
export type Actions<T extends MachineTypes> = T['actions'] extends string
  ? T['actions']
  : string
export type State<T extends MachineTypes> = T['state'] extends string
  ? T['state']
  : string

// Context = Input + Computed (full context available in handlers)
export type Context<T extends MachineTypes> = Input<T> & Computed<T>

// State-based handler configuration
export type StateConfig<
  TContext,
  TEvents extends EventsConfig,
  TActions extends string = string,
> = {
  on?: { [K in keyof TEvents]?: Handler<TContext, TEvents[K], TActions> }
}

export type StatesConfig<
  TState extends string,
  TContext,
  TEvents extends EventsConfig,
  TActions extends string = string,
> = {
  [K in TState]?: StateConfig<TContext, TEvents, TActions>
}

export type Machine<T extends MachineTypes> = {
  computed?: {
    [K in keyof Computed<T>]: (input: Input<T>) => Computed<T>[K]
  }
  on?: {
    [K in keyof Events<T>]?: Handler<Context<T>, Events<T>[K], Actions<T>>
  }
  states?: StatesConfig<State<T>, Context<T>, Events<T>, Actions<T>>
  always?: Rule<Context<T>, undefined, Actions<T>>[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  effects?: Effect<Context<T>, Events<T>, any>[]
  actions?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [K in Actions<T>]: (context: Context<T>, payload?: any) => void
  }
}

export type Send<TEvents extends EventsConfig> = <K extends keyof TEvents>(
  event: K,
  ...args: TEvents[K] extends undefined ? [] : [payload: TEvents[K]]
) => void

// createMachine return type
export type MachineInstance<T extends MachineTypes> = Machine<T> & {
  send: <K extends keyof Events<T>>(
    event: K,
    input: Input<T>,
    ...args: Events<T>[K] extends undefined ? [] : [payload: Events<T>[K]]
  ) => void
  evaluate: (input: Input<T>) => void
  getComputed: (input: Input<T>) => Computed<T>
  cleanup: () => void
}

// ============================================
// Core Logic (Pure)
// ============================================

export function executeActions<TContext, TPayload>(
  actionNames: string | string[],
  actions: Record<string, (context: TContext, payload?: TPayload) => void>,
  context: TContext,
  payload: TPayload,
): void {
  if (typeof actionNames === 'string') {
    actions[actionNames]?.(context, payload)
  } else {
    for (const name of actionNames) {
      actions[name]?.(context, payload)
    }
  }
}

export function isRuleArray<TContext, TPayload, TActions extends string>(
  handler: Handler<TContext, TPayload, TActions>,
): handler is Rule<TContext, TPayload, TActions>[] {
  return (
    Array.isArray(handler) &&
    handler.length > 0 &&
    typeof handler[0] === 'object' &&
    'do' in handler[0]
  )
}

export function executeHandler<TContext, TPayload>(
  handler: Handler<TContext, TPayload>,
  actions: Record<string, (context: TContext, payload?: TPayload) => void>,
  context: TContext,
  payload: TPayload,
): void {
  // Single action or action array
  if (typeof handler === 'string' || (Array.isArray(handler) && !isRuleArray(handler))) {
    executeActions(handler as string | string[], actions, context, payload)
    return
  }

  // Rule array
  for (const rule of handler as Rule<TContext, TPayload>[]) {
    if (!rule.when || rule.when(context, payload)) {
      executeActions(rule.do, actions, context, payload)
      break
    }
  }
}

export function computeValues<TContext, TComputed extends ComputedConfig>(
  context: TContext,
  computed?: { [K in keyof TComputed]: (context: TContext) => TComputed[K] },
): TContext & TComputed {
  if (!computed) return context as TContext & TComputed

  const values = {} as TComputed
  for (const key in computed) {
    values[key] = computed[key](context)
  }
  return { ...context, ...values }
}

/**
 * Shallow comparison function - for composite watch support
 *
 * Arrays: length + === comparison for each element
 * Others: === comparison
 */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true

  // Array comparison
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((v, i) => v === b[i])
  }

  return false
}

// Effect store for tracking state
export type EffectStore = {
  watchedValues: Map<number, unknown>
  enterCleanups: Map<number, () => void>
  changeCleanups: Map<number, () => void>
  exitCleanups: Map<number, () => void>
}

export function createEffectStore(): EffectStore {
  return {
    watchedValues: new Map(),
    enterCleanups: new Map(),
    changeCleanups: new Map(),
    exitCleanups: new Map(),
  }
}

/**
 * Common effects processing logic
 */
export function processEffects<TContext, TEvents extends EventsConfig>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  effects: Effect<TContext, TEvents, any>[] | undefined,
  context: TContext,
  effectHelpers: EffectHelpers<TEvents>,
  store: EffectStore,
): void {
  if (!effects) return

  effects.forEach((effect, i) => {
    const prev = store.watchedValues.get(i)
    const curr = effect.watch(context)

    if (!shallowEqual(prev, curr)) {
      // cleanup previous enter
      const enterCleanup = store.enterCleanups.get(i)
      if (enterCleanup) {
        enterCleanup()
        store.enterCleanups.delete(i)
      }

      // cleanup previous change
      const changeCleanup = store.changeCleanups.get(i)
      if (changeCleanup) {
        changeCleanup()
        store.changeCleanups.delete(i)
      }

      // change callback (can return cleanup)
      const changeResult = effect.change?.(context, prev, curr, effectHelpers)
      if (typeof changeResult === 'function') {
        store.changeCleanups.set(i, changeResult)
      }

      // enter (falsy → truthy)
      if (!prev && curr) {
        // cleanup previous exit
        const exitCleanup = store.exitCleanups.get(i)
        if (exitCleanup) {
          exitCleanup()
          store.exitCleanups.delete(i)
        }

        const enterResult = effect.enter?.(context, effectHelpers)
        if (typeof enterResult === 'function') {
          store.enterCleanups.set(i, enterResult)
        }
      }

      // exit (truthy → falsy)
      if (prev && !curr) {
        const exitResult = effect.exit?.(context, effectHelpers)
        if (typeof exitResult === 'function') {
          store.exitCleanups.set(i, exitResult)
        }
      }

      store.watchedValues.set(i, curr)
    }
  })
}

/**
 * Clear effect store
 */
export function clearEffectStore(store: EffectStore): void {
  store.enterCleanups.forEach((fn) => fn())
  store.enterCleanups.clear()
  store.changeCleanups.forEach((fn) => fn())
  store.changeCleanups.clear()
  store.exitCleanups.forEach((fn) => fn())
  store.exitCleanups.clear()
  store.watchedValues.clear()
}

// ============================================
// Vanilla (non-React) + Type inference helper
// ============================================

export function createMachine<T extends MachineTypes>(
  config: Machine<T>,
): MachineInstance<T> {
  const effectStore = createEffectStore()

  const send = (<K extends keyof Events<T>>(
    event: K,
    input: Input<T>,
    ...args: Events<T>[K] extends undefined ? [] : [payload: Events<T>[K]]
  ) => {
    const context = computeValues(input, config.computed)
    const payload = args[0] as Events<T>[K]

    // 1. State-specific handler first
    const state = (context as { state?: State<T> }).state
    if (state && config.states?.[state]?.on?.[event]) {
      const stateHandler = config.states[state].on[event]
      executeHandler(stateHandler, config.actions ?? {}, context, payload)
    }

    // 2. Global handler
    const globalHandler = config.on?.[event]
    if (globalHandler) {
      executeHandler(globalHandler, config.actions ?? {}, context, payload)
    }
  }) as <K extends keyof Events<T>>(
    event: K,
    input: Input<T>,
    ...args: Events<T>[K] extends undefined ? [] : [payload: Events<T>[K]]
  ) => void

  // vanilla send wrapper (with input binding)
  const createEffectHelpersWithInput = (input: Input<T>): EffectHelpers<Events<T>> => ({
    send: (<K extends keyof Events<T>>(
      event: K,
      ...args: Events<T>[K] extends undefined ? [] : [payload: Events<T>[K]]
    ) => {
      send(event, input, ...args)
    }) as Send<Events<T>>,
  })

  const evaluate = (input: Input<T>) => {
    const context = computeValues(input, config.computed)
    const effectHelpers = createEffectHelpersWithInput(input)

    // always
    if (config.always && config.actions) {
      const actionsMap = config.actions as Record<
        string,
        (context: Context<T>) => void
      >
      for (const rule of config.always) {
        if (!rule.when || rule.when(context, undefined)) {
          executeActions(rule.do, actionsMap, context, undefined)
          break
        }
      }
    }

    // effects
    processEffects(config.effects, context, effectHelpers, effectStore)
  }

  const getComputed = (input: Input<T>): Computed<T> => {
    const context = computeValues(input, config.computed)
    if (!config.computed) return {} as Computed<T>
    const result = {} as Computed<T>
    for (const key in config.computed) {
      result[key] = context[key]
    }
    return result
  }

  const cleanup = () => clearEffectStore(effectStore)

  return Object.assign(config, { send, evaluate, getComputed, cleanup })
}
