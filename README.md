# Controlled Machine

A controlled state machine where **state lives outside the machine**.

Machine defines **what** happens. Your component owns **the state**.

---

A keyboard-navigable combobox — complex interaction logic in the machine, rendering in your component:

```ts
// combobox-machine.ts — Pure logic, no DOM dependencies
const comboboxMachine = createMachine<{
  input: {
    isOpen: boolean
    setIsOpen: (v: boolean) => void
    highlightedIndex: number
    setHighlightedIndex: (i: number) => void
    selectedValue: string | null
    onSelect: (v: string) => void
    items: { value: string; label: string }[]
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
  computed: {
    highlightedItem: (input) => input.items[input.highlightedIndex] ?? null,
    selectedLabel: (input) =>
      input.items.find((i) => i.value === input.selectedValue)?.label ?? 'Select...',
  },
  guards: {
    isOpen: (ctx) => ctx.isOpen,
    canGoNext: (ctx) => ctx.highlightedIndex < ctx.items.length - 1,
    canGoPrev: (ctx) => ctx.highlightedIndex > 0,
    hasHighlighted: (ctx) => ctx.highlightedItem !== null,
  },
  on: {
    TOGGLE: [
      { when: 'isOpen', do: (ctx) => ctx.setIsOpen(false) },
      { do: (ctx) => ctx.setIsOpen(true) },
    ],
    CLOSE: [
      (ctx) => ctx.setIsOpen(false),
      (ctx) => ctx.setHighlightedIndex(-1),
    ],
    HIGHLIGHT_NEXT: [
      { when: (ctx) => !ctx.isOpen, do: (ctx) => ctx.setIsOpen(true) },
      { when: 'canGoNext', do: (ctx) => ctx.setHighlightedIndex(ctx.highlightedIndex + 1) },
    ],
    HIGHLIGHT_PREV: [
      { when: 'canGoPrev', do: (ctx) => ctx.setHighlightedIndex(ctx.highlightedIndex - 1) },
    ],
    SELECT_HIGHLIGHTED: [
      {
        when: 'hasHighlighted',
        do: [
          (ctx) => ctx.onSelect(ctx.highlightedItem!.value),
          (ctx) => ctx.setIsOpen(false),
        ],
      },
    ],
    SELECT: [
      (ctx, { value }) => ctx.onSelect(value),
      (ctx) => ctx.setIsOpen(false),
    ],
  },
})
```

```tsx
// Combobox.tsx — Component owns state and renders UI
function Combobox({ items, value, onChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const { send, computed } = useMachine(comboboxMachine, {
    input: {
      isOpen,
      setIsOpen,
      highlightedIndex,
      setHighlightedIndex,
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
        {computed.selectedLabel}
      </button>
      {isOpen && (
        <ul>
          {items.map((item, i) => (
            <li
              key={item.value}
              data-highlighted={i === highlightedIndex}
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
- Machine handles **keyboard navigation, conditional transitions** — component just renders
- **Computed values** derive data, **guards** control flow — clear separation
- **Conditional rules** (`when`/`do`) express complex logic declaratively
- Same machine works with **any UI** — swap the component, keep the logic

---

## Installation

```bash
npm install controlled-machine
```

---

## Core Concepts

### 1. External State

Unlike XState where state lives inside the machine, here **you own the state**:

```tsx
// Your state, your control
const [isOpen, setIsOpen] = useState(false)
const [selectedId, setSelectedId] = useState<string | null>(null)

// Machine just defines handlers
const { send } = useMachine(machine, {
  input: { isOpen, onOpenChange: setIsOpen, selectedId, onSelect: setSelectedId },
})
```

### 2. Declarative Handlers

Define **what** happens on each event with conditional logic:

```ts
on: {
  SELECT: [
    { when: 'isDisabled', do: [] },           // Guard: skip if disabled
    { when: 'hasSelection', do: 'deselect' }, // Conditional action
    { do: ['select', 'close'] },              // Default: multiple actions
  ],
}
```

### 3. Actions & Guards Override

Machine provides defaults. Component can override:

```ts
// Machine: default implementations
const machine = createMachine({
  actions: {
    scrollToItem: () => {},  // noop default
    focusInput: () => {},
  },
  guards: {
    canSelect: (ctx) => !ctx.disabled,
  },
})

// Component: real implementations
useMachine(machine, {
  input: { ... },
  actions: {
    scrollToItem: (ctx) => itemRefs.get(ctx.highlightedId)?.scrollIntoView(),
    focusInput: () => inputRef.current?.focus(),
  },
  guards: {
    canSelect: (ctx) => !ctx.disabled && ctx.items.length > 0,
  },
})
```

---

## API Reference

### `createMachine<T>(config)`

```ts
const machine = createMachine<{
  input: { count: number; setCount: (n: number) => void }
  events: { INCREMENT: undefined; SET: { value: number } }
  computed: { isPositive: boolean }
  actions: 'increment' | 'set'
  guards: 'canIncrement'
  state: 'idle' | 'active'  // Optional: for state-based handlers
}>({
  computed: {
    isPositive: (input) => input.count > 0,
  },
  on: {
    INCREMENT: [{ when: 'canIncrement', do: 'increment' }],
    SET: 'set',
  },
  actions: {
    increment: (ctx) => ctx.setCount(ctx.count + 1),
    set: (ctx, payload) => ctx.setCount(payload.value),
  },
  guards: {
    canIncrement: (ctx) => ctx.count < 10,
  },
})
```

### `useMachine(machine, options)`

```ts
const { send, computed, state } = useMachine(machine, {
  input: { count, setCount },
  actions: { /* optional overrides */ },
  guards: { /* optional overrides */ },
})

send('INCREMENT')
send('SET', { value: 5 })
```

---

## Features

### Conditional Handlers

Branch logic with `when`/`do` rules. Stops at first match:

```ts
on: {
  TOGGLE: [
    { when: 'isDisabled', do: [] },   // Skip if disabled
    { when: 'isOpen', do: 'close' },  // Close if open
    { do: 'open' },                    // Default: open
  ],
}
```

### Guards

Use named guards, inline functions, or arrays in `when`:

```ts
on: {
  TOGGLE: [
    { when: 'isOpen', do: 'close' },             // Named guard
    { when: (ctx) => ctx.disabled, do: [] },     // Inline guard function
  ],

  // Multiple guards - ALL must pass (AND logic)
  DELETE: [
    {
      when: ['isAdmin', 'hasPermission', (ctx) => !ctx.isLocked],
      do: 'deleteItem',
    },
    { do: 'showError' },
  ],
}
```

### Inline Actions

Use inline functions directly in `do`:

```ts
on: {
  SELECT: [
    {
      when: 'isEnabled',
      do: (ctx, payload) => ctx.selectItem(payload.id),  // Single inline action
    },
  ],

  SUBMIT: [
    {
      when: 'isValid',
      do: [
        'logSubmit',                              // Named action
        (ctx, payload) => ctx.submit(payload),    // Inline function
        'showSuccess',                            // Named action
      ],
    },
  ],
}
```

### Multiple Actions

Execute multiple actions per event:

```ts
on: {
  SELECT: ['highlight', 'select', 'close'],  // Array of named actions

  CONFIRM: [
    { when: 'isValid', do: ['save', 'close', 'notify'] },
    { do: 'showError' },
  ],
}
```

### Computed Values

Derive values from input:

```ts
computed: {
  isEmpty: (input) => input.items.length === 0,
  canSubmit: (input) => input.value.length > 0 && !input.isLoading,
},

// Use in handlers
on: {
  SUBMIT: [
    { when: (ctx) => !ctx.canSubmit, do: [] },
    { do: 'submit' },
  ],
}

// Access from hook
const { computed } = useMachine(machine, { input })
if (computed.isEmpty) { /* ... */ }
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
      // On any change
      console.log(`${prev} → ${curr}`)
    },
  },
]
```

### State-based Handlers

Different handlers per state:

```ts
const machine = createMachine<{
  input: { state: 'idle' | 'loading' | 'error'; setState: (s) => void }
  events: { FETCH: undefined; RETRY: undefined }
  state: 'idle' | 'loading' | 'error'
}>({
  states: {
    idle: {
      on: { FETCH: 'startFetch' },
    },
    loading: {
      // FETCH ignored while loading
    },
    error: {
      on: { RETRY: 'startFetch' },
    },
  },
  actions: { startFetch: (ctx) => ctx.setState('loading') },
})
```

### Always Rules

Auto-evaluated on every context change:

```ts
always: [
  { when: (ctx) => ctx.value < 0, do: 'clampToMin' },
  { when: (ctx) => ctx.value > 100, do: 'clampToMax' },
]
```

---

## Vanilla Usage

Use without React:

```ts
const machine = createMachine({ /* config */ })

// Send events
machine.send('OPEN', { isOpen: false, onOpenChange: (v) => { /* ... */ } })

// Evaluate effects
machine.evaluate(input)

// Get computed values
const computed = machine.getComputed(input)

// Cleanup
machine.cleanup()
```

---

## TypeScript

### Type Parameters

Specify only what you need:

```ts
// Minimal
createMachine<{
  input: MyInput
  events: MyEvents
}>({ ... })

// Full
createMachine<{
  input: MyInput
  events: MyEvents
  computed: MyComputed
  actions: 'action1' | 'action2'
  guards: 'guard1' | 'guard2'
  state: 'idle' | 'active'
}>({ ... })
```

### Exports

```ts
import { createMachine, effect } from 'controlled-machine'
import { useMachine } from 'controlled-machine/react'
import type {
  Machine,
  Send,
  Rule,
  Handler,
  ActionItem,   // Named action or inline function
  GuardItem,    // Named guard or inline function
  UseMachineOptions,
} from 'controlled-machine'
```

---

## License

MIT
