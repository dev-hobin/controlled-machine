# Controlled Machine

A controlled state machine with **internal state management**.

Machine owns **its own state**. Your component passes **external data**.

---

A keyboard-navigable combobox — machine manages `isOpen` and `highlightedIndex` internally:

```ts
// combobox-machine.ts — Pure logic, manages UI state internally
const comboboxMachine = createMachine<{
  input: {
    selectedValue: string | null
    onSelect: (v: string) => void
    items: { value: string; label: string }[]
  }
  internal: {
    isOpen: boolean
    highlightedIndex: number
  }
  events: {
    TOGGLE: undefined
    CLOSE: undefined
    HIGHLIGHT_NEXT: undefined
    HIGHLIGHT_PREV: undefined
    SELECT_HIGHLIGHTED: undefined
    SELECT: { value: string }
  }
  computed: {
    highlightedItem: { value: string; label: string } | null
    selectedLabel: string
  }
  guards: 'isOpen' | 'canGoNext' | 'canGoPrev' | 'hasHighlighted'
}>({
  internal: {
    isOpen: false,
    highlightedIndex: -1,
  },
  computed: {
    highlightedItem: (ctx) => ctx.items[ctx.highlightedIndex] ?? null,
    selectedLabel: (ctx) =>
      ctx.items.find((i) => i.value === ctx.selectedValue)?.label ?? 'Select...',
  },
  guards: {
    isOpen: (ctx) => ctx.isOpen,
    canGoNext: (ctx) => ctx.highlightedIndex < ctx.items.length - 1,
    canGoPrev: (ctx) => ctx.highlightedIndex > 0,
    hasHighlighted: (ctx) => ctx.highlightedItem !== null,
  },
  on: {
    TOGGLE: [
      { when: 'isOpen', do: (_, __, assign) => assign({ isOpen: false }) },
      { do: (_, __, assign) => assign({ isOpen: true }) },
    ],
    CLOSE: (_, __, assign) => assign({ isOpen: false, highlightedIndex: -1 }),
    HIGHLIGHT_NEXT: [
      { when: (ctx) => !ctx.isOpen, do: (_, __, assign) => assign({ isOpen: true }) },
      { when: 'canGoNext', do: (ctx, _, assign) => assign({ highlightedIndex: ctx.highlightedIndex + 1 }) },
    ],
    HIGHLIGHT_PREV: [
      { when: 'canGoPrev', do: (ctx, _, assign) => assign({ highlightedIndex: ctx.highlightedIndex - 1 }) },
    ],
    SELECT_HIGHLIGHTED: [
      {
        when: 'hasHighlighted',
        do: [
          (ctx) => ctx.onSelect(ctx.highlightedItem!.value),
          (_, __, assign) => assign({ isOpen: false }),
        ],
      },
    ],
    SELECT: [
      (ctx, { value }) => ctx.onSelect(value),
      (_, __, assign) => assign({ isOpen: false }),
    ],
  },
})
```

```tsx
// Combobox.tsx — No useState needed for isOpen/highlightedIndex!
function Combobox({ items, value, onChange }) {
  const [snapshot, send] = useMachine(comboboxMachine, {
    input: {
      selectedValue: value,
      onSelect: onChange,
      items,
    },
  })

  return (
    <div>
      <button
        onClick={() => send('TOGGLE')}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') send('HIGHLIGHT_NEXT')
          if (e.key === 'ArrowUp') send('HIGHLIGHT_PREV')
          if (e.key === 'Enter') send('SELECT_HIGHLIGHTED')
          if (e.key === 'Escape') send('CLOSE')
        }}
      >
        {snapshot.selectedLabel}
      </button>
      {snapshot.isOpen && (
        <ul>
          {items.map((item, i) => (
            <li
              key={item.value}
              data-highlighted={i === snapshot.highlightedIndex}
              onClick={() => send('SELECT', { value: item.value })}
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

**Why this matters:**
- Machine manages **its own state** (`isOpen`, `highlightedIndex`) — no `useState` clutter
- **External data** (`value`, `onChange`, `items`) passed via `input`
- **Snapshot** gives you everything — `internal + computed` in one object
- Same machine works with **any UI** — swap the component, keep the logic

---

## Installation

```bash
npm install controlled-machine
```

---

## Core Concepts

### 1. Internal vs Input

**Internal**: Machine-managed state. Lives inside the machine, updated via `assign()`.

```ts
internal: {
  isOpen: false,
  count: 0,
}
```

**Input**: External data passed from your component. Props, parent state, etc.

```ts
// Component passes external data
const [snapshot, send] = useMachine(machine, {
  input: { value, onChange, items },  // From props or parent
})
```

### 2. Flat Context

Inside handlers, `input + internal + computed` merge into one flat `context`:

```ts
on: {
  INCREMENT: (ctx, _, assign) => {
    // ctx.count (internal), ctx.multiplier (input), ctx.doubled (computed)
    // All at the same level!
    assign({ count: ctx.count + ctx.multiplier })
  },
}
```

### 3. Snapshot

`useMachine` returns `[snapshot, send]`. Snapshot contains `internal + computed + state`:

```ts
const [snapshot, send] = useMachine(machine, { input })

snapshot.isOpen          // from internal
snapshot.highlightedItem // from computed
snapshot.state           // FSM state (if defined)
// Note: input values are NOT in snapshot
```

### 4. Assign

Update internal state with `assign()` — the third argument in handlers:

```ts
on: {
  INCREMENT: (ctx, payload, assign) => {
    assign({ count: ctx.count + 1 })  // Partial update, other keys preserved
  },
  RESET: (ctx, _, assign) => {
    assign({ count: 0, isOpen: false })  // Update multiple keys
  },
}
```

---

## API Reference

### `createMachine<T>(config)`

```ts
const machine = createMachine<{
  input: { multiplier: number }           // External data
  internal: { count: number }             // Machine-managed state
  events: { INCREMENT: undefined; SET: { value: number } }
  computed: { doubled: number }
  actions: 'log'
  guards: 'canIncrement'
  state: 'idle' | 'active'                // Optional: for FSM
}>({
  internal: { count: 0 },
  computed: {
    doubled: (ctx) => ctx.count * ctx.multiplier,
  },
  on: {
    INCREMENT: [
      { when: 'canIncrement', do: (ctx, _, assign) => assign({ count: ctx.count + 1 }) },
    ],
    SET: (ctx, payload, assign) => assign({ count: payload.value }),
  },
  actions: {
    log: (ctx) => console.log(ctx.count),
  },
  guards: {
    canIncrement: (ctx) => ctx.count < 10,
  },
})
```

### `useMachine(machine, options)`

```ts
const [snapshot, send] = useMachine(machine, {
  input: { multiplier: 2 },
  actions: { /* optional overrides */ },
  guards: { /* optional overrides */ },
})

// snapshot: internal + computed + state
snapshot.count    // 0 (internal)
snapshot.doubled  // 0 (computed)

send('INCREMENT')
// snapshot.count = 1, snapshot.doubled = 2

send('SET', { value: 5 })
// snapshot.count = 5, snapshot.doubled = 10
```

### Factory Pattern

Use a factory function for isolated instances:

```ts
const createCounterMachine = (initialCount: number) =>
  createMachine<{
    internal: { count: number }
    events: { INCREMENT: undefined }
    computed: { currentCount: number }
  }>({
    internal: { count: initialCount },
    computed: { currentCount: (ctx) => ctx.count },
    on: {
      INCREMENT: (ctx, _, assign) => assign({ count: ctx.count + 1 }),
    },
  })

// Each component gets its own instance
const [snapshot, send] = useMachine(() => createCounterMachine(100))
```

---

## Features

### Conditional Handlers

Branch logic with `when`/`do` rules. First match wins:

```ts
on: {
  TOGGLE: [
    { when: 'isDisabled', do: [] },                      // Skip if disabled
    { when: 'isOpen', do: (_, __, assign) => assign({ isOpen: false }) },
    { do: (_, __, assign) => assign({ isOpen: true }) }, // Default
  ],
}
```

### Guards

Named guards, inline functions, or arrays (AND logic):

```ts
guards: {
  isOpen: (ctx) => ctx.isOpen,
  canDelete: (ctx) => ctx.isAdmin && !ctx.isLocked,
},

on: {
  CLOSE: [{ when: 'isOpen', do: 'close' }],  // Named guard

  DELETE: [
    {
      when: ['isAdmin', 'canDelete', (ctx) => ctx.items.length > 0],  // All must pass
      do: 'deleteItem',
    },
  ],
}
```

### Inline Actions

Use inline functions directly in `do`:

```ts
on: {
  INCREMENT: (ctx, _, assign) => assign({ count: ctx.count + 1 }),  // Direct function

  SELECT: [
    {
      when: 'isEnabled',
      do: [
        'logSelection',                          // Named action
        (ctx, payload) => ctx.onSelect(payload), // Inline function
        (_, __, assign) => assign({ isOpen: false }),
      ],
    },
  ],
}
```

### Action Arrays

Use function arrays directly as handlers (without `when`/`do` rules):

```ts
on: {
  // Function array — runs all actions in sequence
  SELECT: [
    (ctx, { value }) => ctx.onSelect(value),
    (_, __, assign) => assign({ isOpen: false }),
  ],

  // Equivalent to:
  // SELECT: { do: [(ctx, { value }) => ..., (_, __, assign) => ...] }
}
```

**Fresh context**: Each action sees updated context after previous `assign()` calls:

```ts
on: {
  INCREMENT_TWICE: [
    (ctx, _, assign) => {
      console.log(ctx.count)  // 0
      assign({ count: ctx.count + 1 })
    },
    (ctx, _, assign) => {
      console.log(ctx.count)  // 1 (fresh context!)
      assign({ count: ctx.count + 1 })
    },
  ],
}
// Final count: 2
```

### Computed Values

Derive values from context (input + internal):

```ts
computed: {
  isEmpty: (ctx) => ctx.items.length === 0,
  canSubmit: (ctx) => ctx.value.length > 0 && !ctx.isLoading,
  total: (ctx) => ctx.count * ctx.multiplier,
},

// Access from snapshot
const [snapshot, send] = useMachine(machine, { input })
if (snapshot.isEmpty) { /* ... */ }
```

### Effects

Watch value changes and react:

```ts
effects: [
  {
    watch: (ctx) => ctx.highlightedId,
    enter: (ctx, { send }) => {
      // When watch becomes truthy
      const timer = setTimeout(() => send('AUTO_SELECT'), 1000)
      return () => clearTimeout(timer)  // Cleanup
    },
    exit: () => {
      // When watch becomes falsy
    },
    change: (ctx, prev, curr, { send }) => {
      // On any value change
      console.log(`${prev} → ${curr}`)
    },
  },
]
```

### State-based Handlers (FSM)

Different handlers per state:

```ts
const machine = createMachine<{
  internal: { state: 'idle' | 'loading' | 'error' }
  events: { FETCH: undefined; RETRY: undefined; SUCCESS: undefined }
  state: 'idle' | 'loading' | 'error'
}>({
  internal: { state: 'idle' },
  states: {
    idle: {
      on: { FETCH: (_, __, assign) => assign({ state: 'loading' }) },
    },
    loading: {
      on: { SUCCESS: (_, __, assign) => assign({ state: 'idle' }) },
      // FETCH ignored while loading
    },
    error: {
      on: { RETRY: (_, __, assign) => assign({ state: 'loading' }) },
    },
  },
})
```

### Always Rules

Auto-evaluated on every context change:

```ts
always: [
  {
    when: (ctx) => ctx.count < 0,
    do: (ctx, _, assign) => assign({ count: 0 }),  // Clamp to min
  },
  {
    when: (ctx) => ctx.count > 100,
    do: (ctx, _, assign) => assign({ count: 100 }),  // Clamp to max
  },
]
```

---

## Vanilla Usage

Use without React:

```ts
const machine = createMachine<{
  input: { multiplier: number }
  internal: { count: number }
  computed: { doubled: number }
  events: { INCREMENT: undefined }
}>({
  internal: { count: 0 },
  computed: { doubled: (ctx) => ctx.count * ctx.multiplier },
  on: {
    INCREMENT: (ctx, _, assign) => assign({ count: ctx.count + 1 }),
  },
})

// Send events
machine.send('INCREMENT', { multiplier: 2 })

// Get snapshot
const snapshot = machine.getSnapshot({ multiplier: 2 })
console.log(snapshot.count)   // 1
console.log(snapshot.doubled) // 2

// Evaluate effects
machine.evaluate({ multiplier: 2 })

// Internal state management
machine.getInternal()         // { count: 1 }
machine.setInternal({ count: 0 })  // Reset
machine.getInitialInternal()  // { count: 0 }

// Cleanup effects
machine.cleanup()
```

---

## TypeScript

### Type Parameters

Specify only what you need:

```ts
// Minimal — just input and events
createMachine<{
  input: { value: string }
  events: { CHANGE: { value: string } }
}>({ ... })

// With internal state
createMachine<{
  input: { items: Item[] }
  internal: { isOpen: boolean; selectedIndex: number }
  events: { TOGGLE: undefined; SELECT: { index: number } }
  computed: { selectedItem: Item | null }
}>({ ... })

// Full configuration
createMachine<{
  input: MyInput
  internal: MyInternal
  events: MyEvents
  computed: MyComputed
  actions: 'action1' | 'action2'
  guards: 'guard1' | 'guard2'
  state: 'idle' | 'active'
}>({ ... })
```

### Key Safety

Overlapping keys between `input`, `internal`, and `computed` cause compile-time errors:

```ts
// Error: Context becomes 'never' type
createMachine<{
  input: { count: number }
  internal: { count: string }  // Same key 'count'!
}>({ ... })
```

### Exports

```ts
import { createMachine, effect } from 'controlled-machine'
import { useMachine } from 'controlled-machine/react'
import type {
  MachineTypes,
  Machine,
  MachineInstance,
  Context,
  Snapshot,
  Send,
  Input,
  Internal,
  Computed,
  AssignFn,
} from 'controlled-machine'
```

---

## License

MIT
