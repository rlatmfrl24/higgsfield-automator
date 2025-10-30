import { requireActiveTabId } from "./tabs";

type PrivacyInjectionResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
    };

type PrivacyStateResult =
  | {
      success: true;
      enabled: boolean;
    }
  | {
      success: false;
      error: string;
    };

const PRIVACY_CLASS = "higgsfield-automator-privacy-blur";
const PRIVACY_STYLE_ID = "higgsfield-automator-privacy-style";

const applyPrivacyModeInPage = (
  className: string,
  styleId: string,
  enabled: boolean
): PrivacyInjectionResult => {
  try {
    const root = document.documentElement;
    const body = document.body;

    if (!root) {
      return { success: false, error: "문서 루트를 찾지 못했습니다." };
    }

    const ensureStyleElement = () => {
      let styleElement = document.getElementById(styleId);

      if (!(styleElement instanceof HTMLStyleElement)) {
        styleElement = document.createElement("style");
        styleElement.id = styleId;
        styleElement.textContent = `
          .${className} {
            filter: blur(16px) !important;
            transition: filter 0.2s ease-in-out !important;
          }
        `;

        (document.head ?? document.documentElement).appendChild(styleElement);
      }

      return styleElement;
    };

    if (enabled) {
      ensureStyleElement();
      root.classList.add(className);
      body?.classList.add(className);
    } else {
      root.classList.remove(className);
      body?.classList.remove(className);

      const styleElement = document.getElementById(styleId);

      if (styleElement?.parentNode) {
        styleElement.parentNode.removeChild(styleElement);
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to apply privacy mode", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : String(error ?? "사생활 보호 효과 적용 중 오류가 발생했습니다."),
    };
  }
};

export const setTargetPagePrivacyMode = async (enabled: boolean): Promise<void> => {
  const tabId = await requireActiveTabId();

  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: applyPrivacyModeInPage,
    args: [PRIVACY_CLASS, PRIVACY_STYLE_ID, enabled],
  });

  const response = result?.result as PrivacyInjectionResult | undefined;

  if (!response?.success) {
    throw new Error(
      response?.error ?? "타겟 페이지에 사생활 보호 효과를 적용하지 못했습니다."
    );
  }
};

export const clearTargetPagePrivacyMode = async (): Promise<void> => {
  await setTargetPagePrivacyMode(false);
};

const checkPrivacyModeInPage = (className: string): PrivacyStateResult => {
  try {
    const root = document.documentElement;
    const body = document.body;

    if (!root) {
      return { success: false, error: "문서 루트를 찾지 못했습니다." };
    }

    const enabled =
      root.classList.contains(className) || body?.classList.contains(className) || false;

    return { success: true, enabled };
  } catch (error) {
    console.error("Failed to check privacy mode", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : String(error ?? "사생활 보호 상태를 확인하는 중 오류가 발생했습니다."),
    };
  }
};

export const getTargetPagePrivacyMode = async (): Promise<boolean> => {
  const tabId = await requireActiveTabId();

  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: checkPrivacyModeInPage,
    args: [PRIVACY_CLASS],
  });

  const response = result?.result as PrivacyStateResult | undefined;

  if (!response?.success) {
    throw new Error(
      response?.error ?? "타겟 페이지의 사생활 보호 상태를 확인하지 못했습니다."
    );
  }

  return response.enabled;
};

