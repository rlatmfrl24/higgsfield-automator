# 성능 진단 메모

## 주요 관찰 대상

- `TargetScreen`: 렌더링 시 다수의 `useMemo`, `useCallback`, `useEffect`가 얽혀 있으며, 엔트리 리스트 변경 시 전체 컴포넌트가 리렌더.
- `useAutomationState`: 메시지 리스너 등록으로 인해 상태 업데이트가 잦으며, 오류 상태가 UI와 동일한 훅에서 처리됨.
- `background.ts`: 큐 진행과 Chrome API 호출이 단일 모듈에 집중되어 비동기 흐름이 복잡.

## 잠재적 병목

1. **멀티 프롬프트 초기화**: `TargetScreen`에서 `entries.length === 0` 조건으로 초기 엔트리를 생성하지만, `useMultiPromptState`에서 이미 기본 엔트리를 생성함. 중복 로직이 렌더 시 매번 실행될 여지.
2. **효과 중복**: `TargetScreen`의 `useEffect`가 `derived`와 `entries.length`에 의존하여 자주 실행. 이를 애플리케이션 서비스 레이어에서 초기화하도록 이전 필요.
3. **상태 동기화**: `useAutomationState`는 `chrome.runtime.sendMessage` 호출 후 항상 `setIsLoading(true)` -> 결과 수신 시 `setIsLoading(false)` 패턴을 반복. UI 응답성을 높이려면 optimistic 업데이트나 필요할 때만 호출하도록 조정.
4. **백그라운드 재시도**: `background.ts` 내 `scheduleRetry`에서 `chrome.alarms.create`와 상태 업데이트가 잦음. 큐 길이가 긴 경우 잦은 storage write 발생.

## 개선 아이디어

- 멀티 프롬프트 초기화 로직을 애플리케이션 서비스로 분리하여 단일 책임 확보.
- `useAutomationState`를 adapter로 축소하고, 메시지 브로드캐스트를 event-driven store로 연결.
- 백그라운드 스크립트는 큐 관리, 필드 적용, 트리거 실행을 각각 유즈케이스로 분리해 테스트 가능성 확보.
- UI 컴포넌트는 최소한의 상태만 유지하고, 나머지는 애플리케이션 레이어에서 주입.

