# Controlled Machine

A controlled state machine where state lives outside the machine.

```ts
import { createMachine } from 'controlled-machine'
import { useMachine } from 'controlled-machine/react'

const machine = createMachine<{
  input: { isOpen: boolean; setIsOpen: (v: boolean) => void }
  events: { OPEN: undefined; CLOSE: undefined }
  actions: 'open' | 'close'
}>({
  on: {
    OPEN: 'open',
    CLOSE: 'close',
  },
  actions: {
    open: (ctx) => ctx.setIsOpen(true),
    close: (ctx) => ctx.setIsOpen(false),
  },
})

function Dropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const { send } = useMachine(machine, { isOpen, setIsOpen })

  return <button onClick={() => send('OPEN')}>Open</button>
}
```

---

## Introduction

Controlled Machine maintains the core concepts of state machines (conditional transitions, side effects) while **keeping state external**.

```ts
// XState: state lives inside the machine
const machine = createMachine({
  initial: 'closed',
  states: {
    closed: { on: { OPEN: 'open' } },
    open: { on: { CLOSE: 'closed' } },
  },
})

// Controlled Machine: state is external, machine only defines handlers
const [isOpen, setIsOpen] = useState(false)
const { send } = useMachine(machine, { isOpen, setIsOpen })
```

In React, the most powerful pattern is **external state passed via props**. Controlled Machine naturally integrates with this approach.

---

## Features

- **Controlled** — State is managed in React state or props
- **Conditional handlers** — Branch logic with `when` conditions
- **State-based structure** — Define different handlers per state
- **Effects** — Watch value changes, cleanup support, `send` access
- **Computed** — Derive values from context
- **Multiple actions** — Execute multiple actions per event

---

## Installation

```bash
npm install controlled-machine
# or
pnpm add controlled-machine
# or
yarn add controlled-machine
```

---

## Basic Usage

### Define a Machine

Use `createMachine` to define event handlers.

```ts
import { createMachine } from 'controlled-machine'

type Input = {
  isOpen: boolean
  setIsOpen: (v: boolean) => void
  selectedId: string | null
  setSelectedId: (v: string | null) => void
}

type Events = {
  OPEN: undefined
  CLOSE: undefined
  SELECT: { itemId: string }
}

const machine = createMachine<{
  input: Input
  events: Events
  actions: 'open' | 'close' | 'select'
}>({
  on: {
    OPEN: 'open',
    CLOSE: 'close',
    SELECT: 'select',
  },
  actions: {
    open: (ctx) => ctx.setIsOpen(true),
    close: (ctx) => ctx.setIsOpen(false),
    select: (ctx, payload) => {
      ctx.setSelectedId(payload.itemId)
      ctx.setIsOpen(false)
    },
  },
})
```

### Send Events

Use `useMachine` in React components.

```tsx
import { useMachine } from 'controlled-machine/react'

function Dropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { send } = useMachine(machine, {
    isOpen,
    setIsOpen,
    selectedId,
    setSelectedId,
  })

  return (
    <div>
      <button onClick={() => send('OPEN')}>Open</button>
      {isOpen && (
        <ul>
          <li onClick={() => send('SELECT', { itemId: '1' })}>Item 1</li>
        </ul>
      )}
    </div>
  )
}
```

---

## API Reference

### `createMachine<T>(config)`

Creates a machine definition with the given configuration.

**Type Parameters:**

```ts
type MachineTypes = {
  input?: unknown    // External data passed to the machine
  events?: Record<string, unknown>  // Event name → payload type
  computed?: Record<string, unknown>  // Derived values
  actions?: string   // Union of action names
  state?: string     // Union of state names (for state-based structure)
}
```

**Config:**

| Property | Description |
|----------|-------------|
| `computed` | Functions that derive values from input |
| `on` | Event → action mappings (global handlers) |
| `states` | State-specific event handlers |
| `always` | Rules evaluated on every context change |
| `effects` | Watch-based side effects |
| `actions` | Named action implementations |

### `useMachine(machine, input)`

React hook that connects a machine to component state.

**Returns:**

| Property | Description |
|----------|-------------|
| `send` | Function to dispatch events |
| `computed` | Computed values derived from input |
| `state` | Current state (if using state-based structure) |

---

## Conditional Handlers

Use `when` conditions to branch logic. Stops at the first match.

```ts
on: {
  TOGGLE: [
    { when: (ctx) => ctx.disabled, do: 'noop' },
    { when: (ctx) => ctx.isOpen, do: 'close' },
    { do: 'open' },  // default case
  ],
}
```

---

## Multiple Actions

Execute multiple actions per event.

```ts
on: {
  // Single action
  OPEN: 'open',

  // Multiple actions (array)
  CLOSE: ['clearHighlight', 'close'],

  // Conditional with multiple actions
  SELECT: [
    { when: (ctx) => ctx.disabled, do: 'noop' },
    { do: ['highlight', 'select', 'close'] },
  ],
}
```

---

## State-based Structure

Define different handlers per state. Undefined events are ignored.

The `state` value can come from either `computed` (recommended) or `input` directly.

### Approach 1: Computed State (Recommended)

Derive state from existing values. This aligns with the "controlled" philosophy—state is computed from the source of truth.

```ts
// Async data fetching example
const machine = createMachine<{
  input: {
    data: Item[] | null
    isLoading: boolean
    error: Error | null
    setData: (data: Item[] | null) => void
    setIsLoading: (v: boolean) => void
    setError: (e: Error | null) => void
  }
  events: { FETCH: undefined; RETRY: undefined }
  computed: { state: 'idle' | 'loading' | 'error' | 'success' }
  actions: 'fetch' | 'retry'
  state: 'idle' | 'loading' | 'error' | 'success'
}>({
  computed: {
    state: (input) => {
      if (input.isLoading) return 'loading'
      if (input.error) return 'error'
      if (input.data) return 'success'
      return 'idle'
    },
  },
  states: {
    idle: {
      on: { FETCH: 'fetch' },
    },
    loading: {
      // FETCH ignored while loading
    },
    error: {
      on: { RETRY: 'retry' },
    },
    success: {
      on: { FETCH: 'fetch' },  // Allow refetch
    },
  },
  actions: {
    fetch: async (ctx) => {
      ctx.setIsLoading(true)
      ctx.setError(null)
      // fetch logic...
    },
    retry: (ctx) => {
      ctx.setError(null)
      ctx.setIsLoading(true)
      // retry logic...
    },
  },
})

// React: manage individual values, state is derived
function DataList() {
  const [data, setData] = useState<Item[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const { send, state } = useMachine(machine, {
    data, setData, isLoading, setIsLoading, error, setError,
  })

  return (
    <div>
      {state === 'idle' && <button onClick={() => send('FETCH')}>Load</button>}
      {state === 'loading' && <Spinner />}
      {state === 'error' && <button onClick={() => send('RETRY')}>Retry</button>}
      {state === 'success' && <List items={data!} />}
    </div>
  )
}
```

### Approach 2: Direct State in Input

Use when state is explicitly managed as a single value.

```ts
// Modal with explicit state management
const machine = createMachine<{
  input: {
    state: 'closed' | 'opening' | 'open' | 'closing'
    setState: (s: 'closed' | 'opening' | 'open' | 'closing') => void
  }
  events: { OPEN: undefined; CLOSE: undefined; ANIMATION_END: undefined }
  actions: 'startOpen' | 'completeOpen' | 'startClose' | 'completeClose'
  state: 'closed' | 'opening' | 'open' | 'closing'
}>({
  states: {
    closed: {
      on: { OPEN: 'startOpen' },
    },
    opening: {
      on: { ANIMATION_END: 'completeOpen' },
    },
    open: {
      on: { CLOSE: 'startClose' },
    },
    closing: {
      on: { ANIMATION_END: 'completeClose' },
    },
  },
  actions: {
    startOpen: (ctx) => ctx.setState('opening'),
    completeOpen: (ctx) => ctx.setState('open'),
    startClose: (ctx) => ctx.setState('closing'),
    completeClose: (ctx) => ctx.setState('closed'),
  },
})

// React: manage state directly
function Modal() {
  const [state, setState] = useState<'closed' | 'opening' | 'open' | 'closing'>('closed')
  const { send } = useMachine(machine, { state, setState })

  return (
    <div
      className={`modal modal--${state}`}
      onAnimationEnd={() => send('ANIMATION_END')}
    >
      <button onClick={() => send('CLOSE')}>Close</button>
    </div>
  )
}
```

### Combining with Global Handlers

State handlers run first, then global handlers:

```ts
{
  states: {
    idle: { on: { LOG: 'logIdle' } },
    active: { on: { LOG: 'logActive' } },
  },
  on: {
    LOG: 'logGlobal',  // Always runs after state handler
  },
}
// idle + LOG → logIdle, then logGlobal
```

---

## Effects

Watch value changes and react to them. Access `send` in callbacks.

```ts
effects: [
  {
    watch: (ctx) => ctx.hoveredId,
    enter: (ctx, { send }) => {
      // Called when watch value becomes truthy
      const timer = setTimeout(() => send('OPEN'), 300)
      return () => clearTimeout(timer)  // cleanup
    },
    exit: (ctx, { send }) => {
      // Called when watch value becomes falsy
      send('CLOSE')
    },
    change: (ctx, prev, curr, { send }) => {
      // Called on any change
      console.log(`Changed from ${prev} to ${curr}`)
    },
  }
]
```

### Async Operations with Cleanup

Handle async requests and race conditions:

```ts
effects: [
  {
    watch: (ctx) => ctx.searchQuery,
    change: (ctx, prev, curr, { send }) => {
      const controller = new AbortController()

      fetch(`/api/search?q=${curr}`, { signal: controller.signal })
        .then(res => res.json())
        .then(data => send('FETCH_SUCCESS', { data }))
        .catch(() => {})

      return () => controller.abort()  // Cancel previous request
    },
  },
]
```

### Effect Helper Function

Use the `effect` helper for better type inference:

```ts
import { effect } from 'controlled-machine'

effects: [
  effect<Context, Events, string | null>({
    watch: (ctx) => ctx.focusedId,
    enter: (ctx, { send }) => { /* ... */ },
  }),
]
```

---

## Computed Values

Derive values from input. Available in handlers and returned from the hook.

```ts
const machine = createMachine<{
  input: Input
  events: Events
  computed: { isEmpty: boolean; displayValue: string }
}>({
  computed: {
    isEmpty: (ctx) => ctx.items.length === 0,
    displayValue: (ctx) => ctx.selectedItem?.label ?? ctx.inputValue,
  },
  on: {
    CLEAR: [
      { when: (ctx) => ctx.isEmpty, do: 'noop' },  // Use computed in handlers
      { do: 'clear' },
    ],
  },
})

// Access computed values
const { computed } = useMachine(machine, input)
if (computed.isEmpty) { /* ... */ }
```

---

## Always Rules

Rules evaluated automatically on every context change.

```ts
always: [
  { when: (ctx) => ctx.value < 0, do: 'resetToZero' },
  { when: (ctx) => ctx.value > 100, do: 'capToMax' },
]
```

---

## Vanilla JavaScript Usage

Use without React:

```ts
import { createMachine } from 'controlled-machine'

const machine = createMachine<{ /* types */ }>({
  on: { /* handlers */ },
  actions: { /* actions */ },
})

// Send events with input
machine.send('OPEN', { isOpen: false, setIsOpen: (v) => { /* ... */ } })

// Evaluate effects
machine.evaluate(input)

// Get computed values
const computed = machine.getComputed(input)

// Cleanup effects on unmount
machine.cleanup()
```

---

## TypeScript

### Object-based Generic Types

Specify only the types you need in any order:

```ts
// Minimal
createMachine<{
  input: MyInput
  events: MyEvents
}>({ /* ... */ })

// Full
createMachine<{
  input: MyInput
  events: MyEvents
  computed: MyComputed
  actions: 'action1' | 'action2'
  state: 'idle' | 'loading' | 'open'
}>({ /* ... */ })
```

### Type Exports

```ts
import type {
  MachineTypes,
  Machine,
  Send,
  Effect,
  Rule,
  Handler,
} from 'controlled-machine'
```

---

## Limitations

- **No machine-to-machine communication** — Coordinate in parent components
- **No parallel states** — Use separate state variables

---

## License

MIT
