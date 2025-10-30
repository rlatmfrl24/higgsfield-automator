# 현재 구조 개요

## 엔트리 포인트

- `src/main.tsx`에서 `App` 컴포넌트를 마운트.
- `src/App.tsx`는 활성 탭 상태(`useActiveTargetPage`)와 폼 스냅샷 상태(`useFormSnapshot`)를 기반으로 세 가지 화면(`CheckingScreen`, `OffTargetScreen`, `TargetScreen`)을 전환.

## 프레젠테이션 레이어 (현 구조)

- 컴포넌트는 `src/components` 하위에 위치.
- `TargetScreen`은 다수의 훅과 서비스에 직접 접근하며 비즈니스 로직이 혼재.
- UI 구성 요소는 Tailwind 클래스 기반으로 구성되지만 재사용 가능한 디자인 시스템은 분리되어 있지 않음.

## 훅 (상태 관리)

- `useActiveTargetPage`: Chrome 탭과 내비게이션 서비스 의존.
- `useFormSnapshot`: 탭에서 폼 데이터를 읽기 위한 서비스 호출.
- `useAutomationState`: 백그라운드 스크립트 메시지 핸들링과 상태 동기화.

## 서비스 & 유틸리티

- `src/services`에 Chrome 확장 API 호출, DOM 주입 스크립트, 데이터 파싱 로직이 혼재.
- 서비스들 간 의존 관계가 명확히 구분되지 않고, 프레젠테이션과 직접 결합되어 있음.
- `target` UI 하위 폴더에도 파싱/검증 로직이 존재(`formData.ts`, `validation.ts`).

## 익스텐션 엔트리

- `src/extension/background.ts`: 자동 생성 큐 관리와 Chrome 이벤트 리스너.
- `src/extension/content-feed-monitor.ts`: 피드 상태를 감지해 백그라운드로 메시지 전송.

## 데이터 흐름 요약

1. 프론트엔드(`TargetScreen`) -> 서비스 호출로 폼 스냅샷 캡처 및 자동화 상태 조회.
2. 백그라운드 스크립트는 자동화 상태를 저장(`chrome.storage.local`)하고 메시지 브로드캐스트.
3. 컨텐츠 스크립트는 피드 상태를 분석하여 백그라운드에 알림.

## 문제점

- UI와 비즈니스 로직/Chrome API 호출이 뒤섞여 테스트와 유지보수 어려움.
- 레이어 경계 부재로 인해 의존관계 복잡.
- 서비스 내 중복된 DOM 조작 로직이 다수 존재.

## 개선 방향

- 레이어드 아키텍처 적용: `presentation`, `application`, `domain`, `infrastructure`, `extension`.
- DOM 조작/Chrome API 호출은 `infrastructure`로, 유즈케이스는 `application`, 데이터 변환/검증은 `domain`으로 이동.
- 프레젠테이션 컴포넌트는 어댑터(훅)를 통해 애플리케이션 레이어와 통신하도록 구성.

