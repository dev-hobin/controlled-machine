# 거부된 접근 방식들

> 왜 이 방식들이 거부되었는지 기록.
> 같은 실수를 반복하지 않기 위함.

---

## 1. input/internal/computed 분리

### 시도

```typescript
createMachine<{
  input: { multiplier: number; onChange: (v: number) => void }
  internal: { count: number }
  computed: { doubled: number }
}>
```

### 거부 이유

- **키 충돌 문제**: 세 영역 간 같은 키가 있으면 안 됨 → 복잡한 검증 로직
- **Context 조합**: `input + internal + computed`를 합치는 타입이 복잡
- **Snapshot 조합**: `internal + computed`만 반환 → 또 다른 타입 필요
- **개념 과부하**: 사용자가 세 가지를 다 이해해야 함

### 교훈

> 분리가 항상 좋은 건 아니다. 단순함이 더 중요할 수 있다.

---

## 2. state를 internal/computed/input에 저장

### 시도

```typescript
// 방법 1: internal에 state 저장
internal: { count: number; state: 'idle' | 'active' }

// 방법 2: computed로 state 계산
computed: { state: (ctx) => ctx.count > 0 ? 'active' : 'idle' }

// 방법 3: input에서 state 받기 (controlled)
input: { state: 'idle' | 'active' }
```

### 거부 이유

- **중복 선언**: `internal.state`와 `MachineTypes.state` 둘 다 필요
- **혼란**: state가 어디에 있는지 헷갈림
- **추론 복잡성**: 어디서 state를 가져올지 타입 레벨에서 판단해야 함

### 교훈

> state는 별도 개념으로 다뤄야 한다. 하지만 그것도 복잡해진다.

---

## 3. Managed mode + Computed mode 공존

### 시도

```typescript
// Managed mode: 초기값 제공
state: 'idle'

// Computed mode: 함수로 계산
state: (ctx) => ctx.data ? { state: 'success', data: ctx.data } : { state: 'idle' }
```

### 거부 이유

- **두 가지 경로**: 내부 구현이 분기됨
- **DU 처리 복잡**: Managed mode에서 Discriminated Union 데이터 조합이 어려움
- **동기화 문제**: Managed mode에서 transition 후 상태 저장 위치 혼란

### 교훈

> 하나의 기능에 두 가지 모드가 있으면 복잡성이 곱해진다.

---

## 4. 내부 구현만 Computed로 통일

### 시도

```typescript
// 사용자에게는 Managed처럼 보이지만
state: 'idle'

// 내부적으로는 Computed로 변환
// state: () => this.__internalState
```

### 거부 이유

- **숨겨진 상태**: `__internalState` 같은 숨겨진 필드 필요
- **DU 데이터 저장**: Discriminated Union의 추가 데이터를 어디에 저장?
- **여전히 복잡**: 문제를 숨겼을 뿐 해결하지 않음

### 교훈

> 구현을 숨기는 건 해결책이 아니다.

---

## 5. 합성 가능한 Wrapper 체인

### 시도

```typescript
withEffects(
  withComputed(
    withGuards(machine, guards),
    computed
  ),
  effects
)
```

### 거부 이유

- **중첩 구조**: 읽기 어려움
- **타입 전파**: 각 wrapper가 다른 타입 반환하면 합성 안 됨
- **설정 분산**: 관련 설정이 여러 곳에 흩어짐

### 대안

```typescript
// createMachine에서 모든 설정
createMachine({
  initial: { ... },
  computed: { ... },
  effects: { ... },
})
```

### 교훈

> 합성이 좋다고 무조건 분리하면 안 된다. 응집도도 중요하다.

---

## 6. 새로운 상태 머신 라이브러리 만들기

### 시도

XState를 대체하는 새로운 상태 머신 라이브러리 구축.

### 거부 이유

- **바퀴 재발명**: XState는 이미 검증됨
- **인터페이스 수렴**: 결국 XState와 비슷해짐
- **핵심 가치 상실**: 진짜 해결해야 할 건 "동기화" 문제

### 교훈

> 문제를 정확히 정의하라. 상태 머신이 문제가 아니라 "외부 상태와의 동기화"가 문제다.

---

## 최종 결론

### 진짜 문제

> XState/useReducer가 "외부에 닫혀 있다"

### 진짜 해결책

> 기존 도구는 그대로 두고, 동기화 문제만 해결하는 Wrapper를 만든다

```typescript
// 기존 도구 활용
const machine = xstate.createMachine({ ... })

// 동기화 Wrapper
const controlledMachine = controlled(machine, {
  sync: { ... },
  notify: { ... },
})
```

### 지켜야 할 원칙

1. **문제를 정확히 정의하라**
2. **기존 도구를 존중하라**
3. **단일 책임을 지켜라**
4. **복잡하면 방향이 틀린 것이다**
