# 여정: controlled-machine에서 controlled-wrapper로

## 여정 다이어그램

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

## 핵심 문제 다이어그램

```
┌─────────────────┐         ┌─────────────────┐
│  외부 상태       │ ──?──▶ │  내부 머신       │
│  (props)        │         │  (uncontrolled) │
│                 │ ◀──?─── │                 │
└─────────────────┘         └─────────────────┘

1. 외부 → 내부: 어떤 이벤트를 보낼지?
2. 내부 → 외부: 어떻게 동기화할지?
3. 충돌 시: 누가 이길지?
```

---

## 최종 아키텍처 다이어그램

```
┌──────────────────────────────────────────────────┐
│  기존 상태 관리 도구 (XState, useReducer)          │
│  - 검증된 상태 머신/리듀서                         │
│  - 변경 없이 그대로 사용                           │
└──────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────┐
│  controlled() wrapper                            │
│  - sync: 외부 → 내부 (이벤트 변환)                 │
│  - notify: 내부 → 외부 (콜백 호출)                 │
│  - conflict: 충돌 해결                            │
└──────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────┐
│  React Integration                               │
│  - useControlled() hook                          │
│  - 외부 상태(props)와 자동 동기화                   │
└──────────────────────────────────────────────────┘
```

---

## 출발점

### 목표

XState와 useReducer를 React의 "controlled component" 패턴처럼 사용하고 싶었다.

```typescript
// 이상적인 모습
<Modal isOpen={isOpen} onOpenChange={setIsOpen}>
  {/* XState의 강력한 상태 관리 + props로 제어 가능 */}
</Modal>
```

### 시도한 것

`controlled-machine`이라는 새로운 상태 머신 라이브러리를 만들었다.

핵심 아이디어:
- `input`: 외부에서 주입되는 상태 (props)
- `internal`: 머신이 관리하는 내부 상태
- `computed`: input + internal에서 파생되는 값
- `context`: 모든 것의 병합

---

## 발전 과정

### Phase 1: 기본 구조

```typescript
createMachine<{
  input: { isOpen: boolean; onOpenChange: (v: boolean) => void }
  internal: { isAnimating: boolean }
  computed: { canClose: boolean }
  events: { CLOSE: undefined }
}>({
  internal: { isAnimating: false },
  computed: {
    canClose: (ctx) => ctx.isOpen && !ctx.isAnimating
  },
  on: {
    CLOSE: (ctx, _, assign) => {
      if (ctx.canClose) {
        ctx.onOpenChange(false)
        assign({ isAnimating: true })
      }
    }
  }
})
```

### Phase 2: FSM 상태 추가

상태 차트 개념 도입:

```typescript
createMachine<{
  // ...
  state: 'idle' | 'loading' | 'success' | 'error'
}>({
  state: 'idle',
  states: {
    idle: { on: { FETCH: ... } },
    loading: { on: { SUCCESS: ..., ERROR: ... } },
  }
})
```

### Phase 3: Discriminated Union 지원

타입 안전한 상태 narrowing:

```typescript
type FetchState =
  | { state: 'idle' }
  | { state: 'success'; data: User }
  | { state: 'error'; error: Error }

// snapshot.state === 'success' 일 때
// snapshot.data가 User로 추론됨
```

### Phase 4: 복잡성 증가

기능이 늘어나면서 복잡해짐:
- `input` vs `internal` vs `computed` 구분
- `state` vs `discriminatedState` 구분
- Managed mode vs Computed mode
- 각 영역 간 키 충돌 체크
- Snapshot 타입 조합 로직

---

## 전환점

### 깨달음 1: XState와 점점 비슷해지고 있다

Core를 발전시키다 보니 XState 인터페이스와 거의 같아짐.

```typescript
// XState
createMachine({ initial: 'idle', context: {}, states: {} })

// controlled-machine
createMachine({ initial: {}, state: 'idle', states: {} })
```

차별점이 뭐지?

### 깨달음 2: 합성 가능한 구조로 분리해야 한다

복잡한 문제를 한 번에 풀려고 하지 말고, 분리하자.

```
Core (단순) + 확장 모듈들 (합성)
```

### 깨달음 3: 기존 도구를 활용하자

XState와 useReducer는 이미 검증된 도구다.
새로 만들 필요 없이, **wrapper만 만들면 된다**.

```typescript
// 새로 만드는 게 아니라
const machine = createMachine({ ... }) // 우리가 만든 것

// 기존 것을 감싸는 것
const machine = xstate.createMachine({ ... })
const controlled = wrap(machine, { sync: ... })
```

---

## 최종 방향

### 새로운 목표

기존의 상태 관리 도구(XState, useReducer)를 그대로 활용하면서,
"controlled" 패턴으로 사용할 수 있게 해주는 **wrapper**를 만든다.

```typescript
// XState를 controlled로
import { createMachine } from 'xstate'
import { controlled } from 'controlled-wrapper'

const xstateMachine = createMachine({ ... })
const controlledMachine = controlled(xstateMachine, {
  sync: { ... },   // 외부 → 내부 동기화 규칙
  notify: { ... }, // 내부 → 외부 알림 규칙
})

// useReducer를 controlled로
const reducer = (state, action) => { ... }
const controlledReducer = controlled(reducer, {
  sync: { ... },
  notify: { ... },
})
```

### 핵심 가치

1. **기존 도구 활용**: XState, useReducer의 검증된 기능 그대로 사용
2. **단일 책임**: wrapper는 동기화 문제만 해결
3. **선언적 인터페이스**: sync, notify 규칙을 명시적으로 정의
4. **범용성**: 어떤 상태 관리 도구든 감쌀 수 있음

### 해결해야 할 핵심 문제

> 외부 상태(props)와 내부 상태(machine/reducer)를
> 어떻게 안전하게 동기화할 것인가?

이 하나의 문제만 잘 풀면 된다.

---

## 다음 단계

1. **핵심 인터페이스 설계**: sync, notify, conflict 규칙 정의
2. **어댑터 구현**: XState, useReducer에 맞는 어댑터
3. **React 통합**: useSyncedMachine hook

인터페이스가 먼저 정의되면, 구현은 그 인터페이스에 맞추는 것일 뿐이다.
