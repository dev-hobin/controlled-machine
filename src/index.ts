/**
 * Controlled Machine
 *
 * A controlled state machine library where external state (input) is passed in
 * and internal state is managed by the machine itself.
 *
 * Key Concepts:
 * - input: External data passed in from outside (e.g., React state, props)
 * - internal: Machine-managed state that persists across events
 * - computed: Derived values calculated from input + internal
 * - context: Flattened input + internal + computed (available in all handlers)
 * - on: Event handlers with conditional rules and actions
 * - states: FSM-style state-based event handlers
 * - effects: Watch-based side effects with enter/exit/change callbacks
 * - always: Auto-evaluated rules that run on every context change
 * - actions: Named action functions (can be overridden in useMachine)
 * - guards: Named guard functions for conditional logic
 */

// ============================================
// Types - Core Building Blocks
// ============================================

/**
 * Assign function type - updates internal state with partial updates
 * Only allows modifying keys defined in Internal type
 */
export type AssignFn<TInternal> = (updates: Partial<TInternal>) => void

/**
 * ActionItem - can be a named action string or inline function
 * Inline functions receive (context, payload, assign)
 */
export type ActionItem<
  TContext,
  TPayload = undefined,
  TActions extends string = string,
  TInternal = unknown,
> = TActions | ((context: TContext, payload: TPayload, assign: AssignFn<TInternal>) => void)

/**
 * GuardItem - can be a named guard string or inline predicate function
 */
export type GuardItem<
  TContext,
  TPayload = undefined,
  TGuards extends string = string,
> = TGuards | ((context: TContext, payload: TPayload) => boolean)

/**
 * Rule - conditional action with optional guard(s)
 * @property when - Guard(s) that must pass (AND logic for arrays)
 * @property do - Action(s) to execute if guards pass
 */
export type Rule<
  TContext,
  TPayload = undefined,
  TActions extends string = string,
  TGuards extends string = string,
  TInternal = unknown,
> = {
  when?: GuardItem<TContext, TPayload, TGuards> | GuardItem<TContext, TPayload, TGuards>[]
  do: ActionItem<TContext, TPayload, TActions, TInternal> | ActionItem<TContext, TPayload, TActions, TInternal>[]
}

/**
 * Handler - event handler definition
 * Can be: single action, action array, rule array, inline function, or function array
 *
 * @example
 * on: { CLICK: 'handleClick' }                    // single action
 * on: { SUBMIT: ['validate', 'save'] }           // action array
 * on: { TOGGLE: [{ when: ctx => ctx.isOpen, do: 'close' }, { do: 'open' }] }  // rule array
 * on: { INCREMENT: (ctx, _, assign) => assign({ count: ctx.count + 1 }) }     // inline function
 * on: { SELECT: [(ctx, p) => ctx.onSelect(p), (_, __, a) => a({ isOpen: false })] }  // function array
 */
export type Handler<
  TContext,
  TPayload = undefined,
  TActions extends string = string,
  TGuards extends string = string,
  TInternal = unknown,
> =
  | TActions
  | TActions[]
  | Rule<TContext, TPayload, TActions, TGuards, TInternal>[]
  | ((context: TContext, payload: TPayload, assign: AssignFn<TInternal>) => void)
  | ((context: TContext, payload: TPayload, assign: AssignFn<TInternal>) => void)[]

/**
 * EffectHelpers - utilities available in effect callbacks
 */
export type EffectHelpers<TEvents extends EventsConfig> = {
  send: Send<TEvents>
}

/** Cleanup function returned from effect callbacks */
export type Cleanup = () => void

/**
 * Effect - watch-based side effect with lifecycle callbacks
 * @property watch - Function that returns the value to watch (uses shallow comparison)
 * @property enter - Called when watch value becomes truthy (can return cleanup)
 * @property exit - Called when watch value becomes falsy (can return cleanup)
 * @property change - Called on any value change with (prev, curr) (can return cleanup)
 */
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

/**
 * Helper function for creating effects with proper type inference
 * @example
 * effects: [
 *   effect({ watch: ctx => ctx.isOpen, enter: () => console.log('opened') })
 * ]
 */
export function effect<TContext, TEvents extends EventsConfig, TWatched>(
  config: Effect<TContext, TEvents, TWatched>,
): Effect<TContext, TEvents, TWatched> {
  return config
}

/** Event configuration - event name to payload type mapping */
export type EventsConfig = Record<string, unknown>
/** Computed configuration - computed key to value type mapping */
export type ComputedConfig = Record<string, unknown>

// ============================================
// Object-based Generic Types
// ============================================

/**
 * MachineTypes - object-based generic type parameter
 * Specify only the types you need, in any order
 *
 * @example
 * createMachine<{
 *   input: { count: number; setCount: (c: number) => void }
 *   internal: { isOpen: boolean }
 *   events: { INCREMENT: undefined; SET: { value: number } }
 *   computed: { doubled: number }
 *   actions: 'increment' | 'set'
 *   guards: 'isPositive'
 *   state: 'idle' | 'loading'
 * }>({...})
 */
export type MachineTypes = {
  input?: unknown      // External state passed in (React state, props, etc.)
  internal?: unknown   // Machine-managed state
  events?: EventsConfig // Event name → payload type
  computed?: ComputedConfig // Derived values from context
  actions?: string     // Named action strings
  guards?: string      // Named guard strings
  state?: string       // FSM state values
}

// ============================================
// Type Extraction Helpers
// ============================================

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type Input<T extends MachineTypes> = T['input'] extends object ? T['input'] : {}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type Internal<T extends MachineTypes> = T['internal'] extends object ? T['internal'] : {}
export type Events<T extends MachineTypes> = T['events'] extends EventsConfig
  ? T['events']
  : Record<string, undefined>
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type Computed<T extends MachineTypes> = T['computed'] extends ComputedConfig
  ? T['computed']
  : {}
export type Actions<T extends MachineTypes> = T['actions'] extends string
  ? T['actions']
  : string
export type Guards<T extends MachineTypes> = T['guards'] extends string
  ? T['guards']
  : string
export type State<T extends MachineTypes> = T['state'] extends string
  ? T['state']
  : string

// ============================================
// Key Overlap Detection (Compile-time Safety)
// ============================================

/**
 * Detects if two types have overlapping keys
 * Returns true if any key exists in both A and B
 */
type HasOverlappingKeys<A, B> = keyof A & keyof B extends never ? false : true

/**
 * Check all combinations of key overlaps between Input, Internal, Computed
 * Uses conditional chain (not union) to ensure proper boolean result
 */
type HasAnyKeyOverlap<T extends MachineTypes> =
  HasOverlappingKeys<Input<T>, Internal<T>> extends true ? true :
  HasOverlappingKeys<Input<T>, Computed<T>> extends true ? true :
  HasOverlappingKeys<Internal<T>, Computed<T>> extends true ? true :
  false

/**
 * Context = Input + Internal + Computed (flat structure)
 * All properties are accessible at the same level in handlers
 *
 * If any pair has overlapping keys, Context becomes `never` (compile-time error)
 */
export type Context<T extends MachineTypes> =
  HasAnyKeyOverlap<T> extends true
    ? never
    : Input<T> & Internal<T> & Computed<T>

// ============================================
// State-based Handler Configuration (FSM)
// ============================================

/** Configuration for handlers within a specific state */
export type StateConfig<
  TContext,
  TEvents extends EventsConfig,
  TActions extends string = string,
  TGuards extends string = string,
  TInternal = unknown,
> = {
  on?: { [K in keyof TEvents]?: Handler<TContext, TEvents[K], TActions, TGuards, TInternal> }
}

/** Map of state names to their configurations */
export type StatesConfig<
  TState extends string,
  TContext,
  TEvents extends EventsConfig,
  TActions extends string = string,
  TGuards extends string = string,
  TInternal = unknown,
> = {
  [K in TState]?: StateConfig<TContext, TEvents, TActions, TGuards, TInternal>
}

/** Base context (input + internal) before computed values are added */
export type BaseContext<T extends MachineTypes> = Input<T> & Internal<T>

// ============================================
// Machine Configuration Type
// ============================================

/**
 * Machine - the configuration object for createMachine
 */
export type Machine<T extends MachineTypes> = {
  internal?: Internal<T>    // Initial internal state values
  computed?: {              // Computed value definitions
    [K in keyof Computed<T>]: (ctx: BaseContext<T>) => Computed<T>[K]
  }
  on?: {                    // Global event handlers
    [K in keyof Events<T>]?: Handler<Context<T>, Events<T>[K], Actions<T>, Guards<T>, Internal<T>>
  }
  states?: StatesConfig<State<T>, Context<T>, Events<T>, Actions<T>, Guards<T>, Internal<T>>  // FSM state handlers
  always?: Rule<Context<T>, undefined, Actions<T>, Guards<T>, Internal<T>>[]  // Auto-evaluated rules
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  effects?: Effect<Context<T>, Events<T>, any>[]  // Watch-based side effects
  actions?: {               // Named action implementations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [K in Actions<T>]: (ctx: Context<T>, payload: any, assign: AssignFn<Internal<T>>) => void
  }
  guards?: {                // Named guard implementations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [K in Guards<T>]: (ctx: Context<T>, payload?: any) => boolean
  }
}

/**
 * Send - function type for dispatching events
 * Events with undefined payload can be called without arguments
 */
export type Send<TEvents extends EventsConfig> = <K extends keyof TEvents>(
  event: K,
  ...args: TEvents[K] extends undefined ? [] : [payload: TEvents[K]]
) => void

// ============================================
// Snapshot Type (Return value from getSnapshot/useMachine)
// ============================================

/**
 * Snapshot = Internal + Computed + { state } (without Input)
 * This is the value returned from getSnapshot() and useMachine()
 *
 * If Internal/Computed have overlapping keys, Snapshot becomes `never`
 * If 'state' type param is defined and Internal/Computed already has 'state' key,
 * we don't add { state } again (existing state is already included)
 */
export type Snapshot<T extends MachineTypes> =
  HasOverlappingKeys<Internal<T>, Computed<T>> extends true
    ? never
    : Internal<T> & Computed<T> & (
        T['state'] extends string
          ? 'state' extends keyof Internal<T> | keyof Computed<T>
            ? object  // already has 'state', don't add duplicate
            : { state: State<T> }
          : object
      )

// ============================================
// MachineInstance Type (createMachine return value)
// ============================================

/**
 * MachineInstance - the return type of createMachine
 * Includes all configuration plus runtime methods
 */
export type MachineInstance<T extends MachineTypes> = Machine<T> & {
  /** Dispatch an event with input and optional payload */
  send: <K extends keyof Events<T>>(
    event: K,
    input: Input<T>,
    ...args: Events<T>[K] extends undefined ? [] : [payload: Events<T>[K]]
  ) => void
  /** Evaluate always rules and effects (called automatically in React) */
  evaluate: (input: Input<T>) => void
  /** Get current snapshot (internal + computed + state) */
  getSnapshot: (input: Input<T>) => Snapshot<T>
  /** Get current internal state */
  getInternal: () => Internal<T>
  /** Set internal state directly */
  setInternal: (internal: Internal<T>) => void
  /** Get initial internal state (for reset) */
  getInitialInternal: () => Internal<T>
  /** Clean up all effect callbacks */
  cleanup: () => void
}

// ============================================
// Core Logic - Pure Functions
// ============================================

/** Normalize a value to an array (single value becomes [value]) */
function toArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

/**
 * Execute action items (named actions or inline functions)
 * Handles both single actions and arrays of actions
 * Each action receives fresh context (rebuilt after previous assigns)
 */
export function executeRuleActions<TContext, TPayload, TInternal>(
  actionItems: ActionItem<TContext, TPayload, string, TInternal> | ActionItem<TContext, TPayload, string, TInternal>[],
  actions: Record<string, (context: TContext, payload: TPayload, assign: AssignFn<TInternal>) => void>,
  getContext: () => TContext,
  payload: TPayload,
  assign: AssignFn<TInternal>,
): void {
  for (const item of toArray(actionItems)) {
    const context = getContext()  // Fresh context for each action
    if (typeof item === 'function') {
      item(context, payload, assign)
    } else {
      actions[item]?.(context, payload, assign)
    }
  }
}

/**
 * Evaluate guard items (named guards or inline predicates)
 * Uses AND logic - all guards must pass for result to be true
 */
export function evaluateGuards<TContext, TPayload>(
  guardItems: GuardItem<TContext, TPayload> | GuardItem<TContext, TPayload>[] | undefined,
  guards: Record<string, (context: TContext, payload?: TPayload) => boolean>,
  context: TContext,
  payload: TPayload,
): boolean {
  if (!guardItems) return true

  for (const item of toArray(guardItems)) {
    const guardFn = typeof item === 'function' ? item : guards[item]
    if (guardFn && !guardFn(context, payload)) {
      return false
    }
  }

  return true
}

/** Type guard to check if handler is a Rule array (has 'do' property) */
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

/** Check if handler is a function array */
function isFunctionArray<TContext, TPayload, TInternal>(
  handler: Handler<TContext, TPayload, string, string, TInternal>,
): handler is ((context: TContext, payload: TPayload, assign: AssignFn<TInternal>) => void)[] {
  return Array.isArray(handler) && handler.length > 0 && typeof handler[0] === 'function'
}

/**
 * Execute a handler (action string, action array, rule array, inline function, or function array)
 * For rule arrays, only the first matching rule executes (short-circuit)
 * Each action/function receives fresh context (rebuilt after previous assigns)
 */
export function executeHandler<TContext, TPayload, TInternal>(
  handler: Handler<TContext, TPayload, string, string, TInternal>,
  actions: Record<string, (context: TContext, payload: TPayload, assign: AssignFn<TInternal>) => void>,
  guards: Record<string, (context: TContext, payload?: TPayload) => boolean>,
  getContext: () => TContext,
  payload: TPayload,
  assign: AssignFn<TInternal>,
): void {
  // Inline function handler
  if (typeof handler === 'function') {
    handler(getContext(), payload, assign)
    return
  }

  // Function array - execute all functions in order with fresh context
  if (isFunctionArray(handler)) {
    for (const fn of handler) {
      fn(getContext(), payload, assign)
    }
    return
  }

  // Single action or action array (strings)
  if (typeof handler === 'string' || (Array.isArray(handler) && !isRuleArray(handler))) {
    executeRuleActions(handler as string | string[], actions, getContext, payload, assign)
    return
  }

  // Rule array - first matching rule wins (guard uses fresh context)
  for (const rule of handler as Rule<TContext, TPayload, string, string, TInternal>[]) {
    if (evaluateGuards(rule.when, guards, getContext(), payload)) {
      executeRuleActions(rule.do, actions, getContext, payload, assign)
      break
    }
  }
}

/**
 * Compute derived values from base context
 * Each computed function receives the base context (input + internal)
 */
export function computeValues<TBase, TComputed extends ComputedConfig>(
  base: TBase,
  computed?: { [K in keyof TComputed]: (ctx: TBase) => TComputed[K] },
): TBase & TComputed {
  if (!computed) return base as TBase & TComputed

  const values = {} as TComputed
  for (const key in computed) {
    values[key] = computed[key](base)
  }
  return { ...base, ...values }
}

/**
 * Build flat context from input + internal
 * Input takes priority if keys overlap (runtime)
 */
export function buildContext<TInput, TInternal>(
  input: TInput,
  internal: TInternal,
): TInput & TInternal {
  return { ...internal, ...input } as TInput & TInternal
}

/**
 * Create assign function for updating internal state
 */
export function createAssign<TInternal>(
  getInternal: () => TInternal,
  setInternal: (internal: TInternal) => void,
): AssignFn<TInternal> {
  return (updates: Partial<TInternal>) => {
    setInternal({ ...getInternal(), ...updates })
  }
}

/**
 * Build snapshot from internal state, context, and computed definitions
 * Snapshot = Internal + Computed + state (without Input)
 */
export function buildSnapshot<T extends MachineTypes>(
  internal: Internal<T>,
  context: Context<T>,
  computedDef: Machine<T>['computed'],
): Snapshot<T> {
  const snapshot = { ...internal } as Snapshot<T>
  // Add computed values
  if (computedDef) {
    for (const key in computedDef) {
      (snapshot as Record<string, unknown>)[key] = context[key as keyof Context<T>]
    }
  }
  // Add state if exists in context
  const state = (context as { state?: State<T> }).state
  if (state !== undefined) {
    (snapshot as Record<string, unknown>).state = state
  }
  return snapshot
}

// ============================================
// Effects Processing
// ============================================

/**
 * Shallow comparison for effect watch values
 * Arrays: compares length and each element with ===
 * Others: strict equality (===)
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

/**
 * EffectStore - tracks watched values and cleanup functions for effects
 * Used by both vanilla and React implementations
 */
export type EffectStore = {
  watchedValues: Map<number, unknown>   // Previous values by effect index
  enterCleanups: Map<number, () => void>  // Cleanup from enter callbacks
  changeCleanups: Map<number, () => void> // Cleanup from change callbacks
  exitCleanups: Map<number, () => void>   // Cleanup from exit callbacks
}

/** Create a new effect store */
export function createEffectStore(): EffectStore {
  return {
    watchedValues: new Map(),
    enterCleanups: new Map(),
    changeCleanups: new Map(),
    exitCleanups: new Map(),
  }
}

/**
 * Process all effects - detect watch value changes and call appropriate callbacks
 * Called on every context change in both vanilla (evaluate) and React (useEffect)
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

    // Only process if value changed (shallow comparison)
    if (!shallowEqual(prev, curr)) {
      // 1. Cleanup previous enter callback
      const enterCleanup = store.enterCleanups.get(i)
      if (enterCleanup) {
        enterCleanup()
        store.enterCleanups.delete(i)
      }

      // 2. Cleanup previous change callback
      const changeCleanup = store.changeCleanups.get(i)
      if (changeCleanup) {
        changeCleanup()
        store.changeCleanups.delete(i)
      }

      // 3. Call change callback (fires on any value change)
      const changeResult = effect.change?.(context, prev, curr, effectHelpers)
      if (typeof changeResult === 'function') {
        store.changeCleanups.set(i, changeResult)
      }

      // 4. Call enter callback (falsy → truthy transition)
      if (!prev && curr) {
        // Cleanup previous exit first
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

      // 5. Call exit callback (truthy → falsy transition)
      if (prev && !curr) {
        const exitResult = effect.exit?.(context, effectHelpers)
        if (typeof exitResult === 'function') {
          store.exitCleanups.set(i, exitResult)
        }
      }

      // Update stored value for next comparison
      store.watchedValues.set(i, curr)
    }
  })
}

/** Clear all effect cleanups (called on unmount or cleanup) */
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
// createMachine - Vanilla Implementation
// ============================================

/**
 * Create a controlled state machine instance
 *
 * The machine manages internal state and provides methods for:
 * - send: Dispatch events with input and payload
 * - evaluate: Run always rules and effects
 * - getSnapshot: Get current state (internal + computed + state)
 *
 * @example
 * const machine = createMachine<{
 *   input: { count: number }
 *   internal: { isOpen: boolean }
 *   events: { TOGGLE: undefined }
 *   computed: { doubled: number }
 * }>({
 *   internal: { isOpen: false },
 *   computed: { doubled: ctx => ctx.count * 2 },
 *   on: { TOGGLE: (ctx, _, assign) => assign({ isOpen: !ctx.isOpen }) }
 * })
 */
export function createMachine<T extends MachineTypes>(
  config: Machine<T>,
): MachineInstance<T> {
  const effectStore = createEffectStore()
  const initialInternal = (config.internal ?? {}) as Internal<T>

  // Machine-managed internal state
  let currentInternal = { ...initialInternal }

  // Update internal state
  const updateInternal = (newInternal: Internal<T>) => {
    currentInternal = newInternal
  }

  // Build full context: input + internal + computed
  const buildFullContext = (input: Input<T>): Context<T> => {
    const base = buildContext(input, currentInternal)
    return computeValues(base, config.computed) as Context<T>
  }

  /**
   * Send an event to the machine
   * Executes state-specific handlers first, then global handlers
   */
  const send = (<K extends keyof Events<T>>(
    event: K,
    input: Input<T>,
    ...args: Events<T>[K] extends undefined ? [] : [payload: Events<T>[K]]
  ) => {
    const assign = createAssign(() => currentInternal, updateInternal)
    const payload = args[0] as Events<T>[K]

    // getContext rebuilds context with latest internal state
    const getContext = () => buildFullContext(input)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actionsMap = (config.actions ?? {}) as Record<string, (ctx: Context<T>, payload: any, assign: AssignFn<Internal<T>>) => void>
    const guardsMap = (config.guards ?? {}) as Record<string, (ctx: Context<T>, payload?: unknown) => boolean>

    // 1. Execute state-specific handler (if in FSM mode)
    const context = getContext()
    const state = (context as { state?: State<T> }).state
    if (state && config.states?.[state]?.on?.[event]) {
      const stateHandler = config.states[state].on![event]!
      executeHandler(
        stateHandler,
        actionsMap,
        guardsMap,
        getContext,
        payload,
        assign,
      )
    }

    // 2. Execute global handler
    const globalHandler = config.on?.[event]
    if (globalHandler) {
      executeHandler(
        globalHandler,
        actionsMap,
        guardsMap,
        getContext,
        payload,
        assign,
      )
    }
  }) as MachineInstance<T>['send']

  // Create effect helpers with bound send
  const createEffectHelpers = (input: Input<T>): EffectHelpers<Events<T>> => ({
    send: (<K extends keyof Events<T>>(
      event: K,
      ...args: Events<T>[K] extends undefined ? [] : [payload: Events<T>[K]]
    ) => {
      send(event, input, ...args)
    }) as Send<Events<T>>,
  })

  /**
   * Evaluate the machine - runs always rules and processes effects
   * Should be called when input changes (automatic in React via useMachine)
   */
  const evaluate = (input: Input<T>) => {
    const assign = createAssign(() => currentInternal, updateInternal)
    const effectHelpers = createEffectHelpers(input)
    const getContext = () => buildFullContext(input)

    // Process always rules (first matching rule wins)
    if (config.always) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const actionsMap = (config.actions ?? {}) as Record<string, (ctx: Context<T>, payload: any, assign: AssignFn<Internal<T>>) => void>
      const guardsMap = (config.guards ?? {}) as Record<string, (ctx: Context<T>) => boolean>
      for (const rule of config.always) {
        if (evaluateGuards(rule.when, guardsMap, getContext(), undefined)) {
          executeRuleActions(rule.do, actionsMap, getContext, undefined, assign)
          break
        }
      }
    }

    // Process effects (uses current context)
    processEffects(config.effects, getContext(), effectHelpers, effectStore)
  }

  /** Get current snapshot (internal + computed + state) */
  const getSnapshot = (input: Input<T>): Snapshot<T> => {
    const context = buildFullContext(input)
    return buildSnapshot(currentInternal, context, config.computed)
  }

  // Internal state accessors
  const getInternal = (): Internal<T> => currentInternal
  const setInternal = (internal: Internal<T>) => { currentInternal = internal }
  const getInitialInternal = (): Internal<T> => initialInternal

  /** Clean up all effect callbacks */
  const cleanup = () => clearEffectStore(effectStore)

  return Object.assign(config, { send, evaluate, getSnapshot, getInternal, setInternal, getInitialInternal, cleanup })
}
