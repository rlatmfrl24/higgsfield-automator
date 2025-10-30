import { requireActiveTabId } from "./tabs";

type InjectionResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
    };

export const GENERATION_BUTTON_KEY_PHRASE = "Daily free credits left";

const clickGenerationButton = (keyPhrase: string): InjectionResult => {
  const normalise = (value: string | null | undefined) =>
    value?.replace(/\s+/g, " ").trim().toLowerCase();

  const equalsTarget = (value: string | null | undefined) => {
    if (!value) {
      return false;
    }

    return normalise(value)?.includes(keyPhrase.toLowerCase()) ?? false;
  };

  const candidates = Array.from(
    document.querySelectorAll("button, [role='button']")
  ).filter((element): element is HTMLElement => element instanceof HTMLElement);

  const targetButton = candidates.find((element) => {
    if (equalsTarget(element.textContent)) {
      return true;
    }

    if (element.ariaLabel && equalsTarget(element.ariaLabel)) {
      return true;
    }

    const labelledBy = element.getAttribute("aria-labelledby");

    if (labelledBy) {
      const labels = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id))
        .filter((label): label is HTMLElement => label instanceof HTMLElement);

      if (labels.some((label) => equalsTarget(label.textContent))) {
        return true;
      }
    }

    return false;
  });

  if (!targetButton) {
    return {
      success: false,
      error: "이미지 생성 버튼을 찾지 못했습니다.",
    };
  }

  targetButton.click();

  return { success: true };
};

export const triggerImageGeneration = async (
  keyPhrase = GENERATION_BUTTON_KEY_PHRASE
): Promise<void> => {
  const tabId = await requireActiveTabId();

  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: clickGenerationButton,
    args: [keyPhrase],
  });

  const response = result?.result as InjectionResult | undefined;

  if (!response?.success) {
    throw new Error(
      response?.error ?? "이미지 생성 요청을 실행하지 못했습니다."
    );
  }
};
