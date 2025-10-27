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

const collectJobIdsFromCursor = async (
  rootSelector: string,
  itemSelector: string,
  overlaySelector: string,
  cursorJobId: string
): Promise<QueueInjectionResult> => {
  const normalisedCursor = cursorJobId.trim().toLowerCase();
  const shouldFindCursor = normalisedCursor.length > 0;
  const feedRoot = document.querySelector(rootSelector);

  if (!feedRoot) {
    return {
      success: false,
      error: "피드 영역을 찾을 수 없습니다.",
    };
  }

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => window.setTimeout(resolve, ms));
  const waitForNextFrame = () =>
    new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const waitForSettled = async () => {
    await waitForNextFrame();
    await sleep(120);
  };

  const resolveScrollContainer = () => {
    if (
      feedRoot instanceof HTMLElement &&
      feedRoot.scrollHeight > feedRoot.clientHeight + 1
    ) {
      return feedRoot;
    }

    const scrollingElement = document.scrollingElement;

    if (scrollingElement instanceof HTMLElement) {
      return scrollingElement;
    }

    if (document.documentElement instanceof HTMLElement) {
      return document.documentElement;
    }

    return document.body instanceof HTMLElement ? document.body : null;
  };

  const scrollContainer = resolveScrollContainer();

  const getViewportHeight = () => {
    if (scrollContainer instanceof HTMLElement) {
      return scrollContainer.clientHeight;
    }

    return (
      window.innerHeight ||
      document.documentElement?.clientHeight ||
      document.body?.clientHeight ||
      0
    );
  };

  const getScrollHeight = () => {
    if (scrollContainer instanceof HTMLElement) {
      return scrollContainer.scrollHeight;
    }

    const element =
      document.scrollingElement ??
      (document.documentElement instanceof HTMLElement
        ? document.documentElement
        : document.body instanceof HTMLElement
        ? document.body
        : null);

    return element?.scrollHeight ?? 0;
  };

  const getScrollTop = () => {
    if (scrollContainer instanceof HTMLElement) {
      return scrollContainer.scrollTop;
    }

    return (
      window.scrollY ||
      document.scrollingElement?.scrollTop ||
      document.documentElement?.scrollTop ||
      document.body?.scrollTop ||
      0
    );
  };

  const getMaxScrollTop = () => {
    const viewportHeight = getViewportHeight();
    const scrollHeight = getScrollHeight();
    return Math.max(0, scrollHeight - viewportHeight);
  };

  const setScrollTop = (nextTop: number) => {
    if (scrollContainer instanceof HTMLElement) {
      scrollContainer.scrollTop = nextTop;
      return;
    }

    window.scrollTo({ top: nextTop, behavior: "auto" });

    const element =
      document.scrollingElement ??
      (document.documentElement instanceof HTMLElement
        ? document.documentElement
        : document.body instanceof HTMLElement
        ? document.body
        : null);

    if (element) {
      element.scrollTop = nextTop;
    }
  };

  const isAtTop = () => getScrollTop() <= 1;

  const isAtBottom = () => {
    if (scrollContainer instanceof HTMLElement) {
      return (
        scrollContainer.scrollHeight <= scrollContainer.clientHeight + 2 ||
        scrollContainer.scrollTop >=
          scrollContainer.scrollHeight - scrollContainer.clientHeight - 1
      );
    }

    const element =
      document.scrollingElement ??
      (document.documentElement instanceof HTMLElement
        ? document.documentElement
        : document.body instanceof HTMLElement
        ? document.body
        : null);

    if (!element) {
      return true;
    }

    const viewportHeight = getViewportHeight();
    const remaining =
      element.scrollHeight - (element.scrollTop + viewportHeight);
    return remaining <= 2;
  };

  const getItems = () => Array.from(feedRoot.querySelectorAll(itemSelector));

  const extractJobIdFromItem = (item: Element) => {
    const link = item.querySelector(overlaySelector);

    if (!(link instanceof HTMLAnchorElement)) {
      return null;
    }

    const href = link.getAttribute("href") ?? "";
    const match = /\/job\/([^/?#]+)/i.exec(href);

    if (!match?.[1]) {
      return null;
    }

    return match[1];
  };

  const cursorElementExists = () => {
    if (!shouldFindCursor) {
      return true;
    }

    return getItems().some((item) => {
      const jobId = extractJobIdFromItem(item);

      return (
        typeof jobId === "string" &&
        jobId.trim().toLowerCase() === normalisedCursor
      );
    });
  };

  const scrollDownStep = () => {
    const viewportHeight = getViewportHeight();
    const maxTop = getMaxScrollTop();
    const currentTop = getScrollTop();

    if (maxTop <= 0 || currentTop >= maxTop - 1) {
      return false;
    }

    const delta = Math.max(viewportHeight * 0.9, 240);
    const nextTop = Math.min(maxTop, currentTop + delta);

    if (Math.abs(nextTop - currentTop) < 1) {
      return false;
    }

    setScrollTop(nextTop);
    return true;
  };

  const scrollUpStep = () => {
    const viewportHeight = getViewportHeight();
    const currentTop = getScrollTop();

    if (currentTop <= 1) {
      return false;
    }

    const delta = Math.max(viewportHeight * 0.9, 240);
    const nextTop = Math.max(0, currentTop - delta);

    if (Math.abs(currentTop - nextTop) < 1) {
      setScrollTop(0);
      return false;
    }

    setScrollTop(nextTop);
    return true;
  };

  if (shouldFindCursor) {
    let cursorLocated = cursorElementExists();
    const maxDownAttempts = 180;
    let attempts = 0;
    let stagnantCount = 0;

    while (!cursorLocated && attempts < maxDownAttempts) {
      attempts += 1;
      const beforeTop = getScrollTop();
      const beforeItemCount = getItems().length;
      const moved = scrollDownStep();
      await waitForSettled();
      cursorLocated = cursorElementExists();

      const afterTop = getScrollTop();
      const afterItemCount = getItems().length;

      if (!moved && isAtBottom()) {
        break;
      }

      if (
        Math.abs(afterTop - beforeTop) < 1 &&
        afterItemCount <= beforeItemCount
      ) {
        stagnantCount += 1;
      } else {
        stagnantCount = 0;
      }

      if (stagnantCount >= 3 && isAtBottom()) {
        break;
      }
    }

    if (!cursorLocated) {
      return {
        success: false,
        error: "다운로드 커서에 해당하는 Job ID를 피드에서 찾을 수 없습니다.",
      };
    }
  }

  await waitForSettled();

  let jobQueue: string[] = [];
  const seenJobIds = new Set<string>();
  const maxUpAttempts = 180;
  let attempts = 0;
  let stagnantUpCount = 0;
  let cursorSeenAtLeastOnce = !shouldFindCursor;

  const processVisibleItems = () => {
    const items = getItems();
    const passItems: string[] = [];
    let cursorVisibleInPass = false;

    for (const item of items) {
      const jobId = extractJobIdFromItem(item);

      if (!jobId) {
        continue;
      }

      const normalisedJobId = jobId.trim().toLowerCase();

      if (shouldFindCursor && normalisedJobId === normalisedCursor) {
        cursorVisibleInPass = true;
        break;
      }

      if (seenJobIds.has(normalisedJobId)) {
        continue;
      }

      seenJobIds.add(normalisedJobId);
      passItems.push(jobId);
    }

    if (passItems.length) {
      jobQueue = passItems.concat(jobQueue);
    }

    return {
      cursorVisibleInPass,
      added: passItems.length > 0,
    };
  };

  while (attempts < maxUpAttempts) {
    attempts += 1;
    const { cursorVisibleInPass, added } = processVisibleItems();

    if (cursorVisibleInPass) {
      cursorSeenAtLeastOnce = true;
    }

    const atTop = isAtTop() || getScrollHeight() <= getViewportHeight() + 2;

    if (atTop) {
      if (!added) {
        break;
      }

      await waitForSettled();
      continue;
    }

    const previousTop = getScrollTop();
    const previousItemCount = getItems().length;
    const moved = scrollUpStep();
    await waitForSettled();
    const currentTop = getScrollTop();
    const currentItemCount = getItems().length;

    if (moved) {
      stagnantUpCount = 0;
      continue;
    }

    if (
      Math.abs(currentTop - previousTop) < 1 &&
      currentItemCount <= previousItemCount
    ) {
      stagnantUpCount += 1;
    } else {
      stagnantUpCount = 0;
    }

    if (!added && stagnantUpCount >= 3) {
      break;
    }
  }

  const finalPass = processVisibleItems();
  if (finalPass.cursorVisibleInPass) {
    cursorSeenAtLeastOnce = true;
  }

  if (shouldFindCursor && !cursorSeenAtLeastOnce) {
    return {
      success: false,
      error: "다운로드 커서에 해당하는 Job ID를 피드에서 찾을 수 없습니다.",
    };
  }

  return {
    success: true,
    jobIds: jobQueue,
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
