import type { CreditHighlight } from "./formData";

export const SUCCESS_PREPARATION_MESSAGE =
  "첫 번째 프롬프트와 비율을 폼에 입력했습니다.";

export const buildSuccessAnnouncement = (
  highlightInfo: CreditHighlight | null
) => {
  if (highlightInfo) {
    return `${SUCCESS_PREPARATION_MESSAGE} ${highlightInfo.display} - 이미지 생성 버튼을 누르려면 동의가 필요합니다.`;
  }

  return SUCCESS_PREPARATION_MESSAGE;
};
