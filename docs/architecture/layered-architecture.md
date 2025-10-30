# 레이어드 아키텍처 설계

## 목표

- UI와 Chrome API/DOM 조작을 분리하고, 애플리케이션 로직을 명확한 책임 단위로 구성.
- 테스트 가능성을 높이고, 기능 확장을 위한 유연한 경계를 설정.

## 제안 디렉터리 구조

```
src/
  presentation/
    app/              # React 컴포넌트, 페이지, UI 상태
    hooks/            # presentation 전용 훅
    providers/        # 컨텍스트/DI
  application/
    useCases/         # 유즈케이스 (시나리오 중심)
    services/         # 애플리케이션 서비스 (큐 제어, 폼 준비 등)
    ports/            # 도메인/인프라 간 인터페이스 정의
  domain/
    models/           # 순수 도메인 모델, 값 객체
    validators/       # 검증 로직
    valueObjects/
  infrastructure/
    chrome/           # Chrome API 어댑터 (tabs, runtime 등)
    dom/              # DOM 조작 스크립트, 주입 함수
    repositories/     # storage 접근, persistence
  extension/
    background/
    content/
    manifest/
```

## 책임 매핑

- `presentation`: 기존 `src/components`, `src/App.tsx`, `src/hooks` 중 UI 관련 훅.
- `application`: `useActiveTargetPage`, `useFormSnapshot`, `useAutomationState`의 핵심 로직을 유즈케이스로 이전.
- `domain`: `formData.ts`, `validation.ts`, `messages.ts` 등 데이터 변환/검증.
- `infrastructure`: `services` 폴더, Chrome API 호출, DOM 스크립트 분리.
- `extension`: 기존 `src/extension` 유지하되, application/infrastructure 서비스 의존하도록 변경.

## 레이어 간 의존 규칙

1. `presentation` → `application` (의존 허용)
2. `application` ↔ `domain` (상호 의존 가능, 단 방향 제어)
3. `application` → `infrastructure`는 ports/adapter 패턴(인터페이스 통해 주입)
4. `extension` → `application`, `infrastructure` (필요 시)
5. 상위 레이어가 하위 레이어의 구현 세부사항을 직접 참조하지 않도록 TS path alias 도입 고려

## 마이그레이션 전략

1. 새 디렉터리 생성 및 경로 별칭 설정(`tsconfig`, `vite.config`).
2. 도메인/애플리케이션 로직 추출: 폼 데이터 파싱, 검증, 자동화 큐 생성.
3. 인프라 어댑터 작성: Chrome API 호출, DOM 스크립트, storage 접근.
4. 프레젠테이션 컴포넌트는 애플리케이션 서비스/유즈케이스를 훅으로 감싸서 사용.
5. extension background/content도 동일한 유즈케이스를 사용하도록 의존성 주입.

## 기대 효과

- 관심사 분리로 테스트 범위 확장.
- 확장 API 변경 시 `infrastructure`만 수정하면 됨.
- UI 변경이 비즈니스 로직에 영향 주지 않음.

