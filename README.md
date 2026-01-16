# Controlled Machine

> **⚠️ ARCHIVED**: 이 프로젝트는 아카이브되었습니다. 아래의 여정과 통찰을 바탕으로 새로운 접근 방식의 프로젝트가 진행될 예정입니다.

---

## 문제 정의

### XState와 useReducer가 잘 안 쓰이는 이유

XState와 useReducer는 상태 모델링에 강력한 도구다. 선언적으로 상태를 표현하고, 구현과 인터페이스를 분리할 수 있다. **그런데도 실제로는 잘 안 쓰인다.**

이유는 **외부 상태에 닫혀 있기 때문**이다.

- 외부 상황을 무시하고 자신의 내부 상태만 철저히 관리한다
- 오직 이벤트를 통해서만 소통하려 한다

React 컴포넌트 생태계에서 가장 강력한 힘을 가진 것은 **props로 전달되는 외부 상태**다. 하지만 reducer나 XState는 이 외부 상태를 다루기 까다롭다.

```
┌─────────────────┐         ┌─────────────────┐
│  외부 상태        │  ──?──▶ │      내부 머신     │
│  (props)        │         │  (uncontrolled) │
│                 │ ◀──?─── │                 │
└─────────────────┘         └─────────────────┘

1. 외부 → 내부: 어떤 이벤트를 보낼지?
2. 내부 → 외부: 어떻게 동기화할지?
3. 충돌 시: 누가 이길지?
```

**도구의 한계가 개념의 가치까지 묻어버리는 셈이다.**

---

## 여정

```
목표: XState/useReducer를 "controlled"처럼 쓰고 싶다
         │
         ▼
시도 1: 새로운 상태 머신 라이브러리 만들기 (controlled-machine)
         │
         ├─ input/internal/computed 분리
         ├─ FSM 상태 추가
         ├─ Discriminated Union 지원
         │
         ▼
문제: 결국 XState와 비슷해지면서 복잡해짐
         │
         ▼
시도 2: 합성 가능한 구조로 분리
         │
         ├─ Core는 단순하게
         ├─ 확장은 Wrapper로
         │
         ▼
깨달음: 기존 도구(XState, useReducer)를 그대로 쓰고
        "controlled wrapper"만 만들면 되잖아?
         │
         ▼
최종 목표: controlled(xstate), controlled(useReducer)
```

---

## 통찰

### 1. 문제를 복잡하게 풀지 마라

- input/internal/computed 분리 → 복잡한 조합 로직
- Managed mode/Computed mode → 두 가지 경로 관리
- state/discriminatedState → 타입 시스템 복잡화

**해결책**: 문제 자체를 없애거나, 단일 책임으로 분리

### 2. 기존 도구를 활용하라

XState와 useReducer는 이미 검증됨. 새로 만들 필요 없이 **동기화 문제만 해결**하면 됨.

### 3. 진짜 해결해야 할 문제

> 외부 상태(props)와 내부 상태(machine/reducer)를 어떻게 안전하게 동기화할 것인가?

이 하나의 문제만 잘 풀면 된다.

---

## 새로운 방향

기존 상태 관리 도구를 그대로 사용하고, **동기화만 해결하는 wrapper**를 만든다:

```typescript
import { createMachine } from 'xstate'
import { controlled } from 'controlled-wrapper'  // 새 프로젝트

const xstateMachine = createMachine({ ... })
const controlledMachine = controlled(xstateMachine, {
  sync: { ... },    // 외부 → 내부 (이벤트 변환)
  notify: { ... },  // 내부 → 외부 (콜백 호출)
  conflict: { ... } // 충돌 해결
})
```

자세한 내용은 [`docs/`](./docs/) 폴더 참조:
- [PROBLEM.md](./docs/PROBLEM.md) - 문제 정의
- [JOURNEY.md](./docs/JOURNEY.md) - 여정
- [INTERFACE.md](./docs/INTERFACE.md) - 새 인터페이스 설계
- [REJECTED.md](./docs/REJECTED.md) - 거부된 접근 방식들

---

---

# 아래는 기존 문서 (참고용)

---

## Original: Controlled Machine (v0.4.x)

A controlled state machine with **internal state management**.
Machine owns **its own state**. Your component passes **external data**.

```bash
npm install controlled-machine
# or
yarn add controlled-machine
# or
pnpm add controlled-machine
```

---

## Why?

**Before (useState spaghetti):**

```tsx
function Select() {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      if (!isOpen) setIsOpen(true)
      else setHighlightedIndex(i => Math.min(i + 1, items.length - 1))
    }
    if (e.key === 'Escape') {
      setIsOpen(false)
      setHighlightedIndex(-1)
    }
    // State dependencies get messy...
  }
}
```

**After (controlled-machine):**

```tsx
function Select() {
  const [snapshot, send] = useMachine(selectMachine, { input: { items } })

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') send('HIGHLIGHT_NEXT')
    if (e.key === 'Escape') send('CLOSE')
  }
  // State logic is encapsulated in the machine
}
```

---

## Quick Start

```tsx
import { createMachine } from 'controlled-machine'
import { useMachine } from 'controlled-machine/react'

const toggleMachine = createMachine<{
  internal: { isOpen: boolean }
  events: { TOGGLE: undefined }
}>({
  internal: { isOpen: false },
  on: {
    TOGGLE: (ctx, _, assign) => assign({ isOpen: !ctx.isOpen }),
  },
})

function Dropdown() {
  const [snapshot, send] = useMachine(toggleMachine)
  return (
    <button onClick={() => send('TOGGLE')}>
      {snapshot.isOpen ? 'Close' : 'Open'}
    </button>
  )
}
```

---

## Full Example

A counter demonstrating most features. Copy and paste to try it out.

```tsx
import { useState } from 'react'
import { createMachine } from 'controlled-machine'
import { useMachine } from 'controlled-machine/react'

const counterMachine = createMachine<{
  input: {
    max: number
    onChange?: (count: number) => void
  }
  internal: {
    count: number
    mode: 'normal' | 'turbo'
  }
  events: {
    INCREMENT: undefined
    DECREMENT: undefined
    RESET: undefined
    SET: { value: number }
    TOGGLE_MODE: undefined
  }
  computed: {
    doubled: number
    isAtMax: boolean
    step: number
  }
  guards: 'canIncrement' | 'canDecrement'
  actions: 'notifyChange'
}>({
  internal: {
    count: 0,
    mode: 'normal',
  },
  computed: {
    doubled: (ctx) => ctx.count * 2,
    isAtMax: (ctx) => ctx.count >= ctx.max,
    step: (ctx) => (ctx.mode === 'turbo' ? 10 : 1),
  },
  guards: {
    canIncrement: (ctx) => ctx.count < ctx.max,
    canDecrement: (ctx) => ctx.count > 0,
  },
  actions: {
    notifyChange: (ctx) => ctx.onChange?.(ctx.count),
  },
  on: {
    INCREMENT: [
      { when: 'canIncrement', do: (ctx, _, assign) => assign({ count: ctx.count + ctx.step }) },
    ],
    DECREMENT: [
      { when: 'canDecrement', do: (ctx, _, assign) => assign({ count: ctx.count - ctx.step }) },
    ],
    RESET: [{ do: [(_, __, assign) => assign({ count: 0 }), 'notifyChange'] }],
    SET: (_, { value }, assign) => assign({ count: value }),
    TOGGLE_MODE: (ctx, _, assign) =>
      assign({ mode: ctx.mode === 'normal' ? 'turbo' : 'normal' }),
  },
  always: [
    { when: (ctx) => ctx.count > ctx.max, do: (ctx, __, assign) => assign({ count: ctx.max }) },
    { when: (ctx) => ctx.count < 0, do: (_, __, assign) => assign({ count: 0 }) },
  ],
  effects: [
    {
      watch: (ctx) => ctx.count,
      change: (ctx, _prev, _curr) => ctx.onChange?.(ctx.count),
    },
    {
      watch: (ctx) => ctx.isAtMax,
      enter: () => console.log('Max reached!'),
      exit: () => console.log('Left max'),
    },
  ],
})

function Counter({ max, onChange }: { max: number; onChange?: (n: number) => void }) {
  const [snapshot, send] = useMachine(counterMachine, {
    input: { max, onChange },
  })

  return (
    <div style={{ fontFamily: 'system-ui', padding: 20 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>
        {snapshot.count}
        <span style={{ fontSize: 16, color: '#888' }}> (x2 = {snapshot.doubled})</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => send('DECREMENT')} disabled={snapshot.count <= 0}>
          -{snapshot.step}
        </button>
        <button onClick={() => send('INCREMENT')} disabled={snapshot.isAtMax}>
          +{snapshot.step}
        </button>
        <button onClick={() => send('RESET')}>Reset</button>
      </div>

      <button onClick={() => send('TOGGLE_MODE')} style={{ marginBottom: 16 }}>
        Mode: {snapshot.mode}
      </button>

      <input
        type="range"
        min={0}
        max={max}
        value={snapshot.count}
        onChange={(e) => send('SET', { value: Number(e.target.value) })}
        style={{ width: '100%' }}
      />

      {snapshot.isAtMax && <div style={{ color: 'green', marginTop: 8 }}>Maximum!</div>}
    </div>
  )
}

export default function App() {
  const [lastChange, setLastChange] = useState<number | null>(null)

  return (
    <div style={{ padding: 40 }}>
      <h1>Counter Machine</h1>
      <Counter max={100} onChange={setLastChange} />
      {lastChange !== null && <p>Last change: {lastChange}</p>}
    </div>
  )
}
```

**Features demonstrated:**

| Feature | Description |
|---------|-------------|
| `input` | External values (`max`, `onChange`) |
| `internal` | Machine-managed state (`count`, `mode`) |
| `computed` | Derived values (`doubled`, `isAtMax`, `step`) |
| `guards` | Condition checks (`canIncrement`, `canDecrement`) |
| `actions` | Named actions (`notifyChange`) |
| `always` | Auto state correction (0~max clamping) |
| `effects` | Side effects (onChange callback, logging) |

---

## Core Concepts

### Internal vs Input

```
┌─────────────────────────────────────────┐
│  Component (React)                      │
│  ┌───────────────┐   ┌───────────────┐  │
│  │    Input      │   │   Snapshot    │  │
│  │  (pass in)    │   │  (read from)  │  │
│  └───────┬───────┘   └───────▲───────┘  │
│          │                   │          │
│          ▼                   │          │
│  ┌───────────────────────────┴───────┐  │
│  │           Machine                 │  │
│  │  ┌─────────┐  ┌─────────────────┐ │  │
│  │  │ Internal│  │    Computed     │ │  │
│  │  │ (state) │  │ (derived values)│ │  │
│  │  └─────────┘  └─────────────────┘ │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**Input** - Values passed from outside:
- Values controlled by parent component (props)
- Callback functions (`onChange`, `onSelect`)
- External data (`items`, `options`)

**Internal** - State managed by the machine:
- UI-only state (`isOpen`, `highlightedIndex`)
- Values initialized on component mount
- State that doesn't need external control

```tsx
// Input: controlled by parent
const [value, setValue] = useState('')
<Combobox value={value} onChange={setValue} items={items} />

// Internal: controlled by machine (isOpen, highlightedIndex, etc.)
const comboboxMachine = createMachine<{
  input: { value: string; onChange: (v: string) => void; items: Item[] }
  internal: { isOpen: boolean; highlightedIndex: number }
  // ...
}>({ ... })
```

### Context

Inside handlers, `input + internal + computed` are merged into one flat object:

```ts
on: {
  SELECT: (ctx, payload, assign) => {
    // ctx.value        ← input
    // ctx.isOpen       ← internal
    // ctx.selectedItem ← computed
    // All accessible at the same level
  }
}
```

### Snapshot

The value returned by `useMachine`. Contains **Internal + Computed** (excludes Input):

```tsx
const [snapshot, send] = useMachine(machine, { input: { value, items } })

snapshot.isOpen       // ← internal
snapshot.selectedItem // ← computed
// snapshot.value     // ❌ input is not in snapshot
```

### Assign

Function to update internal state. The third argument in handlers:

```ts
on: {
  OPEN: (ctx, payload, assign) => {
    assign({ isOpen: true })  // Partial update
  },
  RESET: (_, __, assign) => {
    assign({ isOpen: false, highlightedIndex: -1 })  // Multiple keys
  },
}
```

---

## Event Handlers

### Handler Patterns

| Pattern | Form | When to use |
|---------|------|-------------|
| Inline function | `(ctx, payload, assign) => ...` | Simple state changes |
| Function array | `[fn1, fn2, fn3]` | Sequential operations |
| String | `'actionName'` | Named action call |
| String array | `['action1', 'action2']` | Sequential named actions |
| Rule array | `[{ when, do }, { do }]` | Conditional branching |

### Inline Function

```ts
on: {
  TOGGLE: (ctx, _, assign) => assign({ isOpen: !ctx.isOpen }),
  SET_VALUE: (ctx, { value }, assign) => assign({ value }),
}
```

**Handler parameters:**
- `ctx` - Context (input + internal + computed)
- `payload` - Value passed via `send('EVENT', payload)`
- `assign` - Internal state update function

### Function Array

Execute multiple operations sequentially. Each function receives fresh context after previous `assign`:

```ts
on: {
  SELECT: [
    (ctx, { value }) => ctx.onChange(value),  // 1. Call callback
    (_, __, assign) => assign({ isOpen: false }),  // 2. Close
  ],
}
```

### Rule Array (Conditional Branching)

Only the first rule with matching `when` condition executes (first match wins):

```ts
on: {
  TOGGLE: [
    { when: 'isOpen', do: (_, __, assign) => assign({ isOpen: false }) },
    { do: (_, __, assign) => assign({ isOpen: true }) },  // default
  ],
}
```

### Named Actions

Define reusable actions:

```ts
createMachine<{
  // ...
  actions: 'logValue' | 'notifyChange'
}>({
  actions: {
    logValue: (ctx) => console.log(ctx.value),
    notifyChange: (ctx) => ctx.onChange?.(ctx.value),
  },
  on: {
    CHANGE: ['logValue', 'notifyChange'],  // Call by string
  },
})
```

### Mixing Functions and Strings

**Only possible inside Rule's `do`:**

```ts
on: {
  // ❌ Doesn't work - mixing at handler level
  EVENT: [(ctx) => console.log(ctx), 'actionName'],

  // ✅ Works - mixing inside Rule's do
  EVENT: [{ do: [(ctx) => console.log(ctx), 'actionName'] }],
}
```

---

## Guards

Guard functions for conditional execution:

```ts
createMachine<{
  // ...
  guards: 'canIncrement' | 'canDecrement'
}>({
  guards: {
    canIncrement: (ctx) => ctx.count < ctx.max,
    canDecrement: (ctx) => ctx.count > 0,
  },
  on: {
    INCREMENT: [
      { when: 'canIncrement', do: (ctx, _, assign) => assign({ count: ctx.count + 1 }) },
    ],
  },
})
```

**Guard usage:**

```ts
// 1. Named guard (string)
{ when: 'canIncrement', do: ... }

// 2. Inline guard (function)
{ when: (ctx) => ctx.count < 10, do: ... }

// 3. Multiple guards (AND condition)
{ when: ['isEnabled', 'canIncrement', (ctx) => !ctx.isLoading], do: ... }
```

### Guard Utilities

Compose guards with `not`, `and`, `or`:

```ts
import { createMachine, not, and, or } from 'controlled-machine'

// not() - negate a guard
{ when: not('isDisabled'), do: 'handleClick' }
{ when: not((ctx) => ctx.loading), do: 'submit' }

// and() - all guards must pass
{ when: and(['hasValue', 'isValid']), do: 'submit' }

// or() - at least one guard must pass
{ when: or(['isAdmin', 'hasPermission']), do: 'delete' }

// Nested composition
{ when: not(or(['isLoading', 'isDisabled'])), do: 'handleClick' }

// Mixed named and inline guards
{ when: and(['hasValue', (ctx) => ctx.count > 0]), do: 'action' }
```

---

## Computed Values

Values derived from Input and Internal:

```ts
createMachine<{
  input: { items: Item[] }
  internal: { selectedIndex: number }
  computed: { selectedItem: Item | null }
}>({
  computed: {
    selectedItem: (ctx) => ctx.items[ctx.selectedIndex] ?? null,
  },
})

// Usage
const [snapshot] = useMachine(machine, { input: { items } })
console.log(snapshot.selectedItem)  // Access computed value
```

---

## Effects

Detect value changes and execute side effects:

```ts
effects: [
  {
    watch: (ctx) => ctx.searchQuery,  // Value to watch (shallow compare)

    enter: (ctx, { send }) => {
      // When watch value becomes falsy → truthy
      const timer = setTimeout(() => send('SEARCH'), 300)
      return () => clearTimeout(timer)  // Can return cleanup function
    },

    exit: (ctx, { send }) => {
      // When watch value becomes truthy → falsy
      send('CLEAR_RESULTS')
    },

    change: (ctx, prev, curr, { send }) => {
      // When watch value changes
      console.log(`${prev} → ${curr}`)
    },
  },
]
```

**Trigger conditions:**
| Callback | When it runs |
|----------|--------------|
| `enter` | `watch` returns falsy → truthy |
| `exit` | `watch` returns truthy → falsy |
| `change` | `watch` return value changes |

---

## Always Rules

Rules automatically evaluated whenever context changes:

```ts
always: [
  {
    when: (ctx) => ctx.count < 0,
    do: (_, __, assign) => assign({ count: 0 }),
  },
  {
    when: (ctx) => ctx.count > ctx.max,
    do: (ctx, __, assign) => assign({ count: ctx.max }),
  },
]
```

### Always vs Effects

| | Always | Effects |
|---|--------|---------|
| **Purpose** | State correction/constraints | Side effects |
| **When** | Synchronous during render | Inside useEffect |
| **Use for** | Value clamping, validation | API calls, timers, logging |
| **Cleanup** | None | Can return cleanup |

---

## State-based Handlers (FSM)

Execute different handlers based on state:

```ts
const fetchMachine = createMachine<{
  internal: { state: 'idle' | 'loading' | 'success' | 'error'; data: any }
  events: { FETCH: undefined; SUCCESS: { data: any }; ERROR: undefined; RETRY: undefined }
  state: 'idle' | 'loading' | 'success' | 'error'
}>({
  internal: { state: 'idle', data: null },

  states: {
    idle: {
      on: {
        FETCH: (_, __, assign) => assign({ state: 'loading' }),
      },
    },
    loading: {
      on: {
        SUCCESS: (_, { data }, assign) => assign({ state: 'success', data }),
        ERROR: (_, __, assign) => assign({ state: 'error' }),
        // FETCH is ignored (no handler)
      },
    },
    success: {
      on: {
        FETCH: (_, __, assign) => assign({ state: 'loading', data: null }),
      },
    },
    error: {
      on: {
        RETRY: (_, __, assign) => assign({ state: 'loading' }),
      },
    },
  },
})
```

**Where `state` can live:**
- `internal` - Transition directly with `assign()`
- `computed` - Derived from other values
- `input` - Controlled by parent

---

## Action & Guard Overrides

Override actions/guards per component:

```ts
const [snapshot, send] = useMachine(machine, {
  input: { value },
  actions: {
    logValue: (ctx) => {
      // Different implementation for this component
      analytics.track('value', ctx.value)
    },
  },
  guards: {
    canSubmit: (ctx) => ctx.value.length > 5,  // Stricter condition
  },
})
```

---

## Factory Pattern

Isolated machine instances per component:

```ts
const createCounterMachine = (initialCount: number) =>
  createMachine<{
    internal: { count: number }
    events: { INCREMENT: undefined }
  }>({
    internal: { count: initialCount },
    on: {
      INCREMENT: (ctx, _, assign) => assign({ count: ctx.count + 1 }),
    },
  })

// Each component gets its own instance
function Counter() {
  const [snapshot, send] = useMachine(() => createCounterMachine(100))
  // ...
}
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

// Send events (input required)
machine.send('INCREMENT', { multiplier: 2 })

// Get snapshot
const snapshot = machine.getSnapshot({ multiplier: 2 })
console.log(snapshot.count)   // 1
console.log(snapshot.doubled) // 2

// Evaluate effects
machine.evaluate({ multiplier: 2 })

// Internal state management
machine.getInternal()              // { count: 1 }
machine.setInternal({ count: 0 })  // Reset
machine.getInitialInternal()       // { count: 0 }

// Cleanup effects
machine.cleanup()
```

---

## TypeScript

### Type Parameters

```ts
createMachine<{
  input: { ... }      // External data
  internal: { ... }   // Machine state
  events: { ... }     // Event → payload
  computed: { ... }   // Derived values
  actions: string     // Named action union
  guards: string      // Named guard union
  state: string       // FSM state union
}>({ ... })
```

**Events type:**
```ts
events: {
  TOGGLE: undefined           // No payload: send('TOGGLE')
  SET: { value: string }      // With payload: send('SET', { value: 'hello' })
}
```

### Key Safety

Duplicate keys across `input`, `internal`, `computed` cause compile error:

```ts
createMachine<{
  input: { count: number }
  internal: { count: string }  // ❌ 'count' key duplicated
}>({ ... })
// → Context type becomes 'never', causing error
```

### Exports

```ts
import { createMachine, effect, not, and, or } from 'controlled-machine'
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
