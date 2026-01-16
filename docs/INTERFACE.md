# 핵심 인터페이스 설계

## 목표

외부 상태(controlled)와 내부 상태(uncontrolled)를 동기화하는 선언적 인터페이스.

---

## 기본 구조

```typescript
type ControlledConfig<TExternal, TInternal, TEvent> = {
  // 외부 → 내부: 외부 상태 변화를 이벤트로 변환
  sync: SyncConfig<TExternal, TInternal, TEvent>

  // 내부 → 외부: 내부 상태 변화를 외부에 알림
  notify: NotifyConfig<TExternal, TInternal>

  // 충돌 해결: 외부와 내부가 다를 때
  conflict?: ConflictConfig<TExternal, TInternal>
}
```

---

## 1. Sync: 외부 → 내부

외부 상태 변화를 감지하여 적절한 이벤트를 내부 머신에 전달.

### 인터페이스

```typescript
type SyncConfig<TExternal, TInternal, TEvent> = {
  [K in keyof TExternal]?: SyncRule<TExternal, TInternal, TEvent, TExternal[K]>
}

type SyncRule<TExternal, TInternal, TEvent, TValue> = {
  // 값 변화를 이벤트로 변환
  toEvent: (
    value: TValue,
    prev: TValue | undefined,
    context: { external: TExternal; internal: TInternal }
  ) => TEvent | null  // null이면 이벤트 안 보냄

  // 이벤트를 보낼 수 있는 조건 (선택)
  guard?: (
    value: TValue,
    context: { external: TExternal; internal: TInternal }
  ) => boolean

  // 비교 함수 (선택, 기본값: Object.is)
  equals?: (a: TValue, b: TValue) => boolean
}
```

### 사용 예시

```typescript
sync: {
  isOpen: {
    toEvent: (value, prev) => {
      if (value && !prev) return { type: 'OPEN' }
      if (!value && prev) return { type: 'CLOSE' }
      return null
    },
    guard: (value, { internal }) => {
      // 'loading' 상태에서는 동기화 막기
      return internal.state !== 'loading'
    }
  },

  selectedId: {
    toEvent: (value) => ({ type: 'SELECT', payload: { id: value } }),
    equals: (a, b) => a === b
  }
}
```

### 단축 문법

```typescript
// 전체 문법
isOpen: {
  toEvent: (value) => value ? { type: 'OPEN' } : { type: 'CLOSE' }
}

// 단축 문법 1: 값 → 이벤트 매핑
isOpen: {
  true: { type: 'OPEN' },
  false: { type: 'CLOSE' }
}

// 단축 문법 2: 함수만
isOpen: (value) => value ? { type: 'OPEN' } : { type: 'CLOSE' }
```

---

## 2. Notify: 내부 → 외부

내부 상태 변화를 외부에 알림 (콜백 호출).

### 인터페이스

```typescript
type NotifyConfig<TExternal, TInternal> = {
  // 특정 내부 상태 변화 감지
  on?: {
    [K in keyof TInternal]?: NotifyRule<TExternal, TInternal, TInternal[K]>
  }

  // 상태 전이 감지 (FSM)
  onTransition?: (
    from: string,
    to: string,
    context: { external: TExternal; internal: TInternal }
  ) => void

  // 모든 변화 감지
  onChange?: (
    internal: TInternal,
    prev: TInternal,
    context: { external: TExternal }
  ) => void
}

type NotifyRule<TExternal, TInternal, TValue> = {
  // 변화 시 실행할 콜백
  call: (
    value: TValue,
    prev: TValue | undefined,
    context: { external: TExternal; internal: TInternal }
  ) => void

  // 알림 조건 (선택)
  when?: (
    value: TValue,
    prev: TValue | undefined,
    context: { external: TExternal; internal: TInternal }
  ) => boolean

  // 비교 함수 (선택)
  equals?: (a: TValue, b: TValue) => boolean
}
```

### 사용 예시

```typescript
notify: {
  on: {
    isOpen: {
      call: (value, prev, { external }) => {
        // 외부 콜백 호출
        external.onOpenChange?.(value)
      },
      // 외부에서 트리거한 변화는 알리지 않음 (무한 루프 방지)
      when: (value, prev, { external }) => external.isOpen !== value
    }
  },

  onTransition: (from, to, { external }) => {
    if (to === 'error') {
      external.onError?.()
    }
  }
}
```

### 단축 문법

```typescript
// 전체 문법
on: {
  isOpen: {
    call: (value, _, { external }) => external.onOpenChange?.(value)
  }
}

// 단축 문법: 외부 콜백 이름만 지정
on: {
  isOpen: 'onOpenChange'  // external.onOpenChange(value) 자동 호출
}
```

---

## 3. Conflict: 충돌 해결

외부와 내부 상태가 불일치할 때 어떻게 처리할지.

### 인터페이스

```typescript
type ConflictConfig<TExternal, TInternal> = {
  // 특정 키의 충돌 해결
  resolve?: {
    [K in keyof TExternal & keyof TInternal]?: (
      external: TExternal[K],
      internal: TInternal[K],
      context: { external: TExternal; internal: TInternal }
    ) => 'external' | 'internal' | 'ignore'
  }

  // 기본 전략
  default?: 'external' | 'internal' | 'ignore'

  // 충돌 감지 시 콜백
  onConflict?: (
    key: string,
    external: unknown,
    internal: unknown
  ) => void
}
```

### 사용 예시

```typescript
conflict: {
  resolve: {
    isOpen: (external, internal, { internal: state }) => {
      // 애니메이션 중이면 내부 우선
      if (state.isAnimating) return 'internal'
      // 그 외에는 외부 우선
      return 'external'
    }
  },
  default: 'external',
  onConflict: (key, external, internal) => {
    console.warn(`Conflict on ${key}:`, { external, internal })
  }
}
```

---

## 4. 전체 사용 예시

### Modal 컴포넌트

```typescript
import { createMachine } from 'xstate'
import { controlled } from 'controlled-wrapper'

// 1. 기존 XState 머신
const modalMachine = createMachine({
  initial: 'closed',
  states: {
    closed: { on: { OPEN: 'opening' } },
    opening: { on: { OPENED: 'open' } },
    open: { on: { CLOSE: 'closing' } },
    closing: { on: { CLOSED: 'closed' } }
  }
})

// 2. Controlled wrapper 적용
const controlledModal = controlled(modalMachine, {
  sync: {
    isOpen: {
      toEvent: (value, prev, { internal }) => {
        if (value && internal.state === 'closed') return { type: 'OPEN' }
        if (!value && internal.state === 'open') return { type: 'CLOSE' }
        return null
      }
    }
  },

  notify: {
    onTransition: (from, to, { external }) => {
      if (to === 'open') external.onOpenChange?.(true)
      if (to === 'closed') external.onOpenChange?.(false)
    }
  },

  conflict: {
    resolve: {
      isOpen: (external, internal, { internal: state }) => {
        // 전이 중이면 내부 우선
        if (state.state === 'opening' || state.state === 'closing') {
          return 'internal'
        }
        return 'external'
      }
    }
  }
})

// 3. React에서 사용
function Modal({ isOpen, onOpenChange, children }) {
  const [state, send] = useControlled(controlledModal, {
    external: { isOpen, onOpenChange }
  })

  return state.state !== 'closed' ? (
    <div className={`modal ${state.state}`}>
      {children}
    </div>
  ) : null
}
```

### Fetch 컴포넌트

```typescript
const fetchReducer = (state, action) => {
  switch (action.type) {
    case 'FETCH': return { ...state, status: 'loading' }
    case 'SUCCESS': return { status: 'success', data: action.data }
    case 'ERROR': return { status: 'error', error: action.error }
    default: return state
  }
}

const controlledFetch = controlled(fetchReducer, {
  sync: {
    // 외부에서 data가 주입되면 SUCCESS 이벤트
    data: {
      toEvent: (value) => value ? { type: 'SUCCESS', data: value } : null,
      guard: (_, { internal }) => internal.status !== 'success'
    },
    // 외부에서 refetch 트리거
    fetchTrigger: {
      toEvent: (value, prev) => value !== prev ? { type: 'FETCH' } : null
    }
  },

  notify: {
    on: {
      data: 'onDataChange',
      error: 'onError'
    }
  }
})
```

---

## 5. 타입 정의 (전체)

```typescript
// 메인 함수
function controlled<TExternal, TInternal, TEvent>(
  machine: Machine<TInternal, TEvent>,
  config: ControlledConfig<TExternal, TInternal, TEvent>
): ControlledMachine<TExternal, TInternal, TEvent>

// 반환 타입
type ControlledMachine<TExternal, TInternal, TEvent> = {
  // 외부 상태 설정
  setExternal: (external: TExternal) => void

  // 내부 상태 가져오기
  getInternal: () => TInternal

  // 동기화된 전체 상태
  getSnapshot: () => TExternal & TInternal

  // 이벤트 전송 (수동)
  send: (event: TEvent) => void

  // 구독
  subscribe: (listener: (snapshot: TExternal & TInternal) => void) => () => void
}

// React Hook
function useControlled<TExternal, TInternal, TEvent>(
  machine: ControlledMachine<TExternal, TInternal, TEvent>,
  options: { external: TExternal }
): [TExternal & TInternal, (event: TEvent) => void]
```

---

## 열린 질문들

1. **초기 동기화**: 컴포넌트 마운트 시 외부와 내부 상태가 다르면?
2. **배치 업데이트**: 여러 외부 상태가 동시에 바뀌면 이벤트를 여러 번?
3. **비동기 전이**: 애니메이션 같은 비동기 전이 중 외부 변화가 오면?
4. **TypeScript**: 외부/내부 타입에서 sync/notify 키를 자동 추론?
