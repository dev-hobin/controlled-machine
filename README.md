# Controlled Machine

A controlled state machine where **state lives outside the machine**.

Machine defines **what** happens. Your component owns **the state**.

## The Killer Example

A reusable dropdown machine — logic lives in the machine, DOM handling in your component:

```ts
// dropdown-machine.ts — Pure logic, no DOM dependencies
const dropdownMachine = createMachine<{
  input: { isOpen: boolean; onOpenChange: (v: boolean) => void }
  events: { OPEN: undefined; CLOSE: undefined; TOGGLE: undefined }
  actions: 'open' | 'close' | 'focusTrigger'
  guards: 'isOpen'
}>({
  on: {
    OPEN: [{ when: 'isOpen', do: [] }, { do: 'open' }],
    CLOSE: [{ when: 'isOpen', do: ['close', 'focusTrigger'] }],
    TOGGLE: [{ when: 'isOpen', do: 'close' }, { do: 'open' }],
  },
  actions: {
    open: (ctx) => ctx.onOpenChange(true),
    close: (ctx) => ctx.onOpenChange(false),
    focusTrigger: () => {},  // Default: noop
  },
  guards: {
    isOpen: (ctx) => ctx.isOpen,
  },
})
```

```tsx
// Dropdown.tsx — Component provides DOM implementation
function Dropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const { send } = useMachine(dropdownMachine, {
    input: { isOpen, onOpenChange: setIsOpen },
    actions: {
      // Override: provide actual DOM implementation
      focusTrigger: () => triggerRef.current?.focus(),
    },
  })

  return (
    <>
      <button ref={triggerRef} onClick={() => send('TOGGLE')}>
        Menu
      </button>
      {isOpen && (
        <ul>
          <li onClick={() => send('CLOSE')}>Item 1</li>
        </ul>
      )}
    </>
  )
}
```

**Why this matters:**
- Machine is **pure and testable** — no refs, no DOM
- Component **owns its state** — React's controlled pattern
- Override **only what you need** — `focusTrigger` gets real implementation
- Same machine, **different UIs** — reuse logic across components

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

Branch logic with `when`. Stops at first match:

```ts
on: {
  TOGGLE: [
    { when: (ctx) => ctx.disabled, do: [] },     // Function guard
    { when: 'isOpen', do: 'close' },             // String guard (from guards config)
    { do: 'open' },                               // Default case
  ],
}
```

### Multiple Actions

Execute multiple actions per event:

```ts
on: {
  SELECT: ['highlight', 'select', 'close'],  // Array of actions

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
import type { Machine, Send, Rule, Handler, UseMachineOptions } from 'controlled-machine'
```

---

## License

MIT
