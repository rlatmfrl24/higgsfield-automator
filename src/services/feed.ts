import {
  FEED_ITEM_OVERLAY_SELECTOR,
  FEED_ITEM_SELECTOR,
  FEED_ROOT_SELECTOR,
} from "./selectors";
import { requireActiveTabId } from "./tabs";

type InjectionResult =
  | { success: true; jobId: string }
  | { success: false; error: string };

type QueueInjectionResult =
  | { success: true; jobIds: string[] }
  | { success: false; error: string };

const extractFirstFeedJobId = (
  rootSelector: string,
  itemSelector: string,
  overlaySelector: string
): InjectionResult => {
  const feedRoot = document.querySelector(rootSelector);

  if (!feedRoot) {
    return {
      success: false,
      error: "피드 영역을 찾을 수 없습니다.",
    };
  }

  const firstItem = feedRoot.querySelector(itemSelector);

  if (!firstItem) {
    return {
      success: false,
      error: "피드에 표시된 항목이 없습니다.",
    };
  }

  const overlayLink = firstItem.querySelector(overlaySelector);

  if (!(overlayLink instanceof HTMLAnchorElement)) {
    return {
      success: false,
      error: "첫 번째 항목에서 Job 링크를 찾지 못했습니다.",
    };
  }

  const href = overlayLink.getAttribute("href") ?? "";
  const match = /\/job\/([^/?#]+)/i.exec(href);

  if (!match?.[1]) {
    return {
      success: false,
      error: "Job ID를 추출할 수 없습니다.",
    };
  }

  return {
    success: true,
    jobId: match[1],
  };
};

const collectJobIdsFromCursor = (
  rootSelector: string,
  itemSelector: string,
  overlaySelector: string,
  cursorJobId: string
): QueueInjectionResult => {
  const normalisedCursor = cursorJobId.trim().toLowerCase();
  const feedRoot = document.querySelector(rootSelector);

  if (!feedRoot) {
    return {
      success: false,
      error: "피드 영역을 찾을 수 없습니다.",
    };
  }

  const items = Array.from(feedRoot.querySelectorAll(itemSelector));

  if (items.length === 0) {
    return {
      success: false,
      error: "피드에 표시된 항목이 없습니다.",
    };
  }

  const collected: string[] = [];
  let cursorFound = normalisedCursor.length === 0;

  for (const item of items) {
    const link = item.querySelector(overlaySelector);

    if (!(link instanceof HTMLAnchorElement)) {
      continue;
    }

    const href = link.getAttribute("href") ?? "";
    const match = /\/job\/([^/?#]+)/i.exec(href);

    if (!match?.[1]) {
      continue;
    }

    const jobId = match[1];
    const normalisedJobId = jobId.trim().toLowerCase();

    if (normalisedCursor.length > 0 && normalisedJobId === normalisedCursor) {
      cursorFound = true;
      break;
    }

    collected.push(jobId);
  }

  if (!cursorFound) {
    return {
      success: false,
      error: "다운로드 커서에 해당하는 Job ID를 피드에서 찾을 수 없습니다.",
    };
  }

  return {
    success: true,
    jobIds: collected,
  };
};

export const getFirstFeedJobId = async (): Promise<string> => {
  const tabId = await requireActiveTabId();

  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: extractFirstFeedJobId,
    args: [FEED_ROOT_SELECTOR, FEED_ITEM_SELECTOR, FEED_ITEM_OVERLAY_SELECTOR],
  });

  const response = result?.result as InjectionResult | undefined;

  if (!response?.success) {
    throw new Error(response?.error ?? "피드의 Job ID를 가져오지 못했습니다.");
  }

  return response.jobId;
};

export const getDownloadQueueFromCursor = async (
  cursorJobId: string
): Promise<string[]> => {
  const tabId = await requireActiveTabId();

  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: collectJobIdsFromCursor,
    args: [
      FEED_ROOT_SELECTOR,
      FEED_ITEM_SELECTOR,
      FEED_ITEM_OVERLAY_SELECTOR,
      cursorJobId,
    ],
  });

  const response = result?.result as QueueInjectionResult | undefined;

  if (!response?.success) {
    throw new Error(
      response?.error ?? "다운로드 큐를 구성하는 중 문제가 발생했습니다."
    );
  }

  return response.jobIds;
};
