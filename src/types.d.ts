export {};

declare global {
  // Chrome 확장 프로그램 환경에서 제공되는 `chrome` 전역 객체를 단순 any 로 선언해
  // 타입스크립트 컴파일 과정에서 참조 오류가 발생하지 않도록 합니다.
  const chrome: any;
}

