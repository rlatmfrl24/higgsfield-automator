import type { FormSnapshotPayload } from "./formSnapshot";
import {
  FORM_SELECTOR,
  formSnapshotScript,
} from "./tabScripts/formSnapshotScript";
import { requireActiveTabId } from "./tabs";

export const captureActiveTabFormSnapshot =
  async (): Promise<FormSnapshotPayload> => {
    const tabId = await requireActiveTabId();

    const [injectionResult] = await chrome.scripting.executeScript({
      target: { tabId },
      func: formSnapshotScript,
      args: [FORM_SELECTOR],
    });

    const result = injectionResult?.result;

    if (!result?.success) {
      throw new Error(result?.error ?? "폼 데이터를 읽어오지 못했습니다.");
    }

    return result.payload;
  };
