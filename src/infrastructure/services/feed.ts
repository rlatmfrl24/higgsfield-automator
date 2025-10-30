import {
  FEED_ITEM_OVERLAY_SELECTOR,
  FEED_ITEM_SELECTOR,
  FEED_ROOT_SELECTOR,
} from "./selectors";
import { requireActiveTabId } from "./tabs";

const JOB_ID_REGEX =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const JOB_PATH_REGEX = /\/job\/([^/?#]+)/i;
const JOB_HASH_REGEX = /(?:#|jobId=)([a-f0-9-]{10,})/i;
const HOVER_EVENT_TYPES = [
  "pointerenter",
  "pointerover",
  "mouseenter",
  "mouseover",
  "focus",
] as const;

const safeDecodeURIComponent = (value: string): string | null => {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

const isHTMLElement = (element: Element | null): element is HTMLElement => {
  return (
    typeof globalThis.HTMLElement === "function" &&
    element instanceof globalThis.HTMLElement
  );
};

const isHTMLAnchorElement = (
  element: Element | null
): element is HTMLAnchorElement => {
  return (
    typeof globalThis.HTMLAnchorElement === "function" &&
    element instanceof globalThis.HTMLAnchorElement
  );
};

const isHTMLImageElement = (
  element: Element | null
): element is HTMLImageElement => {
  return (
    typeof globalThis.HTMLImageElement === "function" &&
    element instanceof globalThis.HTMLImageElement
  );
};

const dispatchHoverEvents = (target: Element | null) => {
  if (!target) {
    return;
  }

  const PointerEventCtor =
    typeof globalThis.PointerEvent === "function"
      ? (globalThis.PointerEvent as typeof PointerEvent)
      : undefined;
  const MouseEventCtor =
    typeof globalThis.MouseEvent === "function"
      ? (globalThis.MouseEvent as typeof MouseEvent)
      : undefined;

  for (const type of HOVER_EVENT_TYPES) {
    try {
      if (PointerEventCtor) {
        target.dispatchEvent(
          new PointerEventCtor(type, {
            bubbles: true,
            cancelable: true,
          } as PointerEventInit)
        );
      } else if (MouseEventCtor) {
        target.dispatchEvent(
          new MouseEventCtor(type, {
            bubbles: true,
            cancelable: true,
          } as MouseEventInit)
        );
      } else {
        target.dispatchEvent(
          new Event(type, { bubbles: true, cancelable: true })
        );
      }
    } catch {
      target.dispatchEvent(
        new Event(type, { bubbles: true, cancelable: true })
      );
    }
  }
};

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    const timer =
      typeof globalThis.setTimeout === "function"
        ? globalThis.setTimeout.bind(globalThis)
        : setTimeout;
    timer(resolve, ms);
  });

const waitForAnimationFrame = () =>
  new Promise<void>((resolve) => {
    if (typeof globalThis.requestAnimationFrame === "function") {
      globalThis.requestAnimationFrame(() => resolve());
    } else {
      const timer =
        typeof globalThis.setTimeout === "function"
          ? globalThis.setTimeout.bind(globalThis)
          : setTimeout;
      timer(() => resolve(), 16);
    }
  });

const extractJobIdFromUrl = (
  value: string | null | undefined
): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const pathMatch = JOB_PATH_REGEX.exec(trimmed);
  if (pathMatch?.[1]) {
    return pathMatch[1];
  }

  const hashMatch = JOB_HASH_REGEX.exec(trimmed);
  if (hashMatch?.[1]) {
    return hashMatch[1];
  }

  const jobMatch = JOB_ID_REGEX.exec(trimmed);
  if (jobMatch?.[0]) {
    return jobMatch[0];
  }

  const urlParamMatch = /[?&]url=([^&#]+)/i.exec(trimmed);
  if (urlParamMatch?.[1]) {
    const decoded = safeDecodeURIComponent(urlParamMatch[1]);

    if (decoded && decoded.trim() && decoded.trim() !== trimmed) {
      const nestedJobId = extractJobIdFromUrl(decoded.trim());
      if (nestedJobId) {
        return nestedJobId;
      }
    }
  }

  return null;
};

const extractJobIdFromElementAttributes = (
  element: Element | null
): string | null => {
  if (!element) {
    return null;
  }

  const attributeCandidates = [
    element.getAttribute("data-job-id"),
    element.getAttribute("data-sentry-job-id"),
    element.getAttribute("data-jobid"),
  ];

  for (const candidate of attributeCandidates) {
    const trimmed = candidate?.trim();

    if (!trimmed) {
      continue;
    }

    if (JOB_ID_REGEX.test(trimmed)) {
      return trimmed;
    }

    const fromUrl = extractJobIdFromUrl(trimmed);
    if (fromUrl) {
      return fromUrl;
    }
  }

  if (isHTMLElement(element)) {
    const datasetValues = Object.values(element.dataset ?? {});
    for (const value of datasetValues) {
      const trimmed = value?.trim();

      if (!trimmed) {
        continue;
      }

      const directMatch = JOB_ID_REGEX.exec(trimmed);
      if (directMatch?.[0]) {
        return directMatch[0];
      }

      const fromUrl = extractJobIdFromUrl(trimmed);
      if (fromUrl) {
        return fromUrl;
      }
    }
  }

  const hrefCandidates: Array<string | null> = [
    element.getAttribute("href"),
    element.getAttribute("data-href"),
  ];

  if (isHTMLAnchorElement(element)) {
    hrefCandidates.push(element.href);
  }

  for (const candidate of hrefCandidates) {
    const jobId = extractJobIdFromUrl(candidate ?? undefined);
    if (jobId) {
      return jobId;
    }
  }

  return null;
};

const resolveJobIdFromItem = (
  item: Element,
  overlaySelector: string
): string | null => {
  const direct = extractJobIdFromElementAttributes(item);
  if (direct) {
    return direct;
  }

  const overlayElement = item.querySelector(overlaySelector);
  const overlayJobId = extractJobIdFromElementAttributes(overlayElement);
  if (overlayJobId) {
    return overlayJobId;
  }

  if (overlayElement) {
    const nestedWithData = overlayElement.querySelector(
      "[data-job-id], [data-sentry-job-id]"
    );
    const nestedJobId = extractJobIdFromElementAttributes(nestedWithData);
    if (nestedJobId) {
      return nestedJobId;
    }

    const interactiveDescendants = overlayElement.querySelectorAll(
      "a[href], button[href], button[data-href]"
    );

    for (const candidate of interactiveDescendants) {
      const extracted = extractJobIdFromElementAttributes(candidate);
      if (extracted) {
        return extracted;
      }
    }
  }

  const image = item.querySelector(
    "img[data-sentry-element='Image'], img[data-sentry-component='Media'], img"
  );

  if (isHTMLImageElement(image)) {
    const candidateSources = [
      image.getAttribute("src"),
      image.getAttribute("data-src"),
      image.getAttribute("srcset"),
      image.getAttribute("data-srcset"),
    ];

    for (const source of candidateSources) {
      const jobId = extractJobIdFromUrl(source ?? undefined);
      if (jobId) {
        return jobId;
      }
    }
  }

  const sourceElement = item.querySelector("source[srcset]");

  if (isHTMLElement(sourceElement)) {
    const sourceJobId = extractJobIdFromUrl(
      sourceElement.getAttribute("srcset") ?? undefined
    );
    if (sourceJobId) {
      return sourceJobId;
    }
  }

  const overlayText = overlayElement?.textContent ?? "";
  const overlayTextMatch = JOB_ID_REGEX.exec(overlayText);
  if (overlayTextMatch?.[0]) {
    return overlayTextMatch[0];
  }

  const itemTextMatch = JOB_ID_REGEX.exec(item.textContent ?? "");
  if (itemTextMatch?.[0]) {
    return itemTextMatch[0];
  }

  return null;
};

const extractJobIdFromFeedItem = async (
  item: Element | null,
  overlaySelector: string
): Promise<string | null> => {
  if (!item) {
    return null;
  }

  const attempt = () => resolveJobIdFromItem(item, overlaySelector);

  const immediate = attempt();
  if (immediate) {
    return immediate;
  }

  dispatchHoverEvents(item);
  const overlayElement = item.querySelector(overlaySelector);
  if (overlayElement) {
    dispatchHoverEvents(overlayElement);
  }

  await waitForAnimationFrame();

  const postFrame = attempt();
  if (postFrame) {
    return postFrame;
  }

  await delay(120);

  if (overlayElement) {
    dispatchHoverEvents(overlayElement);
  }

  return attempt();
};

type InjectionResult =
  | { success: true; jobId: string }
  | { success: false; error: string };

type QueueInjectionResult =
  | { success: true; jobIds: string[] }
  | { success: false; error: string };

const extractFirstFeedJobId = async (
  rootSelector: string,
  itemSelector: string,
  overlaySelector: string
): Promise<InjectionResult> => {
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

  const jobId = await extractJobIdFromFeedItem(firstItem, overlaySelector);

  if (!jobId) {
    return {
      success: false,
      error: "Job ID를 추출할 수 없습니다.",
    };
  }

  return {
    success: true,
    jobId,
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

  const setScrollTop = (nextTop: number) => {
    if (scrollContainer instanceof HTMLElement) {
      scrollContainer.scrollTop = nextTop;
      return;
    }

    window.scrollTo({ top: nextTop, behavior: "auto" });

    const element = document.scrollingElement as HTMLElement | null;

    if (element) {
      element.scrollTop = nextTop;
    }
  };

  const isAtBottom = () => {
    if (scrollContainer instanceof HTMLElement) {
      const diff =
        scrollContainer.scrollHeight -
        (scrollContainer.scrollTop + scrollContainer.clientHeight);
      return diff <= 2;
    }

    const element = document.scrollingElement as HTMLElement | null;

    if (!element) {
      return true;
    }

    return (
      element.scrollHeight - (element.scrollTop + getViewportHeight()) <= 2
    );
  };

  const getItems = () => Array.from(feedRoot.querySelectorAll(itemSelector));

  const scrollDownStep = () => {
    const viewportHeight = getViewportHeight();
    let currentTop = 0;
    let maxTop = 0;

    if (scrollContainer instanceof HTMLElement) {
      currentTop = scrollContainer.scrollTop;
      maxTop = Math.max(
        0,
        scrollContainer.scrollHeight - scrollContainer.clientHeight
      );
    } else {
      const element = document.scrollingElement as HTMLElement | null;
      currentTop = element?.scrollTop ?? window.scrollY;
      maxTop = Math.max(
        0,
        getViewportHeight()
          ? document.body.scrollHeight - getViewportHeight()
          : 0
      );
    }

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

  const seenJobIds = new Set<string>();
  const jobQueue: string[] = [];

  const collectVisibleItems = async (stopAtCursor: boolean) => {
    const items = getItems();
    let cursorVisible = false;

    for (const item of items) {
      const jobId = await extractJobIdFromFeedItem(item, overlaySelector);

      if (!jobId) {
        continue;
      }

      const normalisedJobId = jobId.trim().toLowerCase();

      if (stopAtCursor && normalisedJobId === normalisedCursor) {
        cursorVisible = true;
        break;
      }

      if (seenJobIds.has(normalisedJobId)) {
        continue;
      }

      seenJobIds.add(normalisedJobId);
      jobQueue.push(jobId);
    }

    return {
      cursorVisible,
      seenCount: seenJobIds.size,
    } as const;
  };

  const initialCollect = await collectVisibleItems(shouldFindCursor);
  let cursorLocated = initialCollect.cursorVisible;

  const maxScrollAttempts = 240;
  const maxIdleAttempts = 10;
  let attempts = 0;
  let idleAttempts = 0;
  let previousSeenCount = seenJobIds.size;

  while (attempts < maxScrollAttempts) {
    if (shouldFindCursor && cursorLocated) {
      break;
    }

    const moved = scrollDownStep();
    attempts += 1;
    await waitForSettled();

    const { cursorVisible, seenCount } = await collectVisibleItems(
      shouldFindCursor
    );
    cursorLocated = cursorLocated || cursorVisible;

    if (seenCount > previousSeenCount) {
      idleAttempts = 0;
      previousSeenCount = seenCount;
    } else {
      idleAttempts += 1;
    }

    if (!moved && isAtBottom()) {
      if (shouldFindCursor && !cursorLocated) {
        break;
      }

      if (!shouldFindCursor) {
        break;
      }
    }

    if (idleAttempts >= maxIdleAttempts) {
      break;
    }
  }

  if (shouldFindCursor && !cursorLocated) {
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
    func: async (
      rootSelector: string,
      itemSelector: string,
      overlaySelector: string
    ) => {
      return extractFirstFeedJobId(rootSelector, itemSelector, overlaySelector);
    },
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
    func: async (
      rootSelector: string,
      itemSelector: string,
      overlaySelector: string,
      cursor: string
    ) => {
      return collectJobIdsFromCursor(
        rootSelector,
        itemSelector,
        overlaySelector,
        cursor
      );
    },
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
