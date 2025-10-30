# 코드 스캔 및 미사용 자산 정리 계획

## 정적 검사 결과

- `pnpm lint`: 오류 없음, 하지만 Tailwind 클래스와 DOM 조작 로직이 여러 파일에 중복 존재.
- `pnpm exec tsc --noEmit`: 타입 오류 없음.

## 미사용/과도한 코드 후보

- `target/multiPrompt.ts`와 `useMultiPromptState.ts`가 모두 기본 엔트리 생성 로직을 보유 → 중복 함수(`createMultiPromptEntry`) 존재.
- `HighlightBadges`에서 `datasetValues`는 대부분 빈 객체로 전달됨; 조건부 렌더링 방식을 단순화 가능.
- `services` 폴더 내 함수가 컴포넌트와 직접 연결되어 레이어 경계가 불명확.

## 스캔 전략

1. `pnpm lint --max-warnings=0` 유지로 린트 기반 검출.
2. 폴더별 정리:
   - `src/components/screens/target`: UI와 도메인 로직 분리, 미사용 util 제거.
   - `src/services`: 인프라 레이어로 이동하며, 사용되지 않는 export 확인.
   - `src/hooks`: 애플리케이션 서비스 전용 훅으로 단독 재사용 여부 검증.
3. 빌드 결과물(`dist`)과 `public`의 샘플 HTML은 문서/테스트 용도로 분리 또는 제거 검토.

## 후속 조치

- 레이어드 아키텍처 설계 시 미사용 코드 제거와 함께 책임을 명확히 재배치.
- 위 후보들에 대해 실제 사용처 확인 후 삭제/리팩터링 진행.

