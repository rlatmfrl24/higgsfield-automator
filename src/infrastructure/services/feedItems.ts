import { FEED_ITEM_SELECTOR, FEED_ROOT_SELECTOR } from "@extension/constants";
import { requireActiveTabId } from "./tabs";

export type FeedItemPreview = {
  index: number;
  signature: string | null;
  html: string;
};

type FeedItemsScriptResult =
  | {
      success: true;
      items: FeedItemPreview[];
      totalCount: number;
    }
  | {
      success: false;
      error: string;
    };

type TriggerDownloadScriptResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
    };

const collectFeedItemsScript = (
  rootSelector: string,
  itemSelector: string,
  limit: number
): FeedItemsScriptResult => {
  const extractCardSignature = (card: Element | null | undefined) => {
    if (!card) {
      return null;
    }

    const text = card.textContent ?? "";
    const trimmed = text.replace(/\s+/g, " ").trim();

    if (!trimmed) {
      return null;
    }

    return trimmed.slice(0, 200);
  };

  if (!Number.isFinite(limit) || Number.isNaN(limit)) {
    return {
      success: false,
      error: "유효한 숫자를 입력해 주세요.",
    };
  }

  const safeLimit = Math.max(0, Math.floor(limit));

  const feedRoot = document.querySelector(rootSelector);

  if (!feedRoot) {
    return {
      success: false,
      error: "피드 컨테이너를 찾을 수 없습니다.",
    };
  }

  const feedItems = Array.from(feedRoot.querySelectorAll(itemSelector));

  if (!feedItems.length) {
    return {
      success: true,
      items: [],
      totalCount: 0,
    };
  }

  const clampedLimit =
    safeLimit > 0 ? Math.min(safeLimit, feedItems.length) : 0;

  const selectedItems =
    clampedLimit > 0 ? feedItems.slice(0, clampedLimit) : [];

  const itemPreviews = selectedItems.map((item) => {
    const index = feedItems.indexOf(item);

    return {
      index,
      signature: extractCardSignature(item),
      html: item.outerHTML,
    } satisfies FeedItemPreview;
  });

  return {
    success: true,
    items: itemPreviews,
    totalCount: feedItems.length,
  };
};

const triggerFeedItemDownloadScript = async (
  rootSelector: string,
  itemSelector: string,
  index: number,
  signature: string | null
): Promise<TriggerDownloadScriptResult> => {
  const extractCardSignature = (card: Element | null | undefined) => {
    if (!card) {
      return null;
    }

    const text = card.textContent ?? "";
    const trimmed = text.replace(/\s+/g, " ").trim();

    if (!trimmed) {
      return null;
    }

    return trimmed.slice(0, 200);
  };

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms);
    });

  const simulateHover = (element: Element) => {
    const hoverEvents: Array<{ type: string; event: Event }> = [];

    try {
      hoverEvents.push({
        type: "pointerenter",
        event: new PointerEvent("pointerenter", {
          bubbles: true,
          cancelable: true,
        }),
      });
      hoverEvents.push({
        type: "pointerover",
        event: new PointerEvent("pointerover", {
          bubbles: true,
          cancelable: true,
        }),
      });
    } catch {
      // PointerEvent may not be supported; fall back to mouse events only.
    }

    hoverEvents.push({
      type: "mouseenter",
      event: new MouseEvent("mouseenter", {
        bubbles: true,
        cancelable: true,
      }),
    });
    hoverEvents.push({
      type: "mouseover",
      event: new MouseEvent("mouseover", {
        bubbles: true,
        cancelable: true,
      }),
    });

    hoverEvents.forEach(({ event }) => {
      try {
        element.dispatchEvent(event);
      } catch {
        // Ignore dispatch errors to keep the flow resilient.
      }
    });
  };

  const findDownloadButton = (item: Element) => {
    const candidates = Array.from(
      item.querySelectorAll<HTMLElement | HTMLAnchorElement>(
        "button, [role='button'], a"
      )
    );

    const normalise = (value: string | null | undefined) =>
      value?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";

    return (
      candidates.find((candidate) => {
        const text = normalise(candidate.textContent);
        const aria = normalise(candidate.getAttribute("aria-label"));
        const title = normalise(candidate.getAttribute("title"));
        const dataLabel = normalise(
          candidate.getAttribute("data-tooltip") ??
            candidate.getAttribute("data-title") ??
            candidate.dataset.action
        );

        if (
          text.includes("download") ||
          aria.includes("download") ||
          title.includes("download") ||
          dataLabel.includes("download")
        ) {
          return true;
        }

        if (candidate.tagName === "A") {
          const href = normalise(candidate.getAttribute("href"));
          if (href.includes("download")) {
            return true;
          }
        }

        return false;
      }) ?? null
    );
  };

  const feedRoot = document.querySelector(rootSelector);

  if (!feedRoot) {
    return {
      success: false,
      error: "피드 컨테이너를 찾을 수 없습니다.",
    };
  }

  const items = Array.from(feedRoot.querySelectorAll(itemSelector));

  const resolveTarget = () => {
    if (Number.isInteger(index) && index >= 0 && index < items.length) {
      const direct = items[index];

      if (!signature || extractCardSignature(direct) === signature) {
        return direct;
      }
    }

    if (!signature) {
      return null;
    }

    return (
      items.find((item) => extractCardSignature(item) === signature) ?? null
    );
  };

  const target = resolveTarget();

  if (!target) {
    return {
      success: false,
      error: "대상 피드 아이템을 찾지 못했습니다.",
    };
  }

  if (target instanceof HTMLElement) {
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  simulateHover(target);
  await wait(60);

  let downloadButton = findDownloadButton(target);

  if (!downloadButton) {
    simulateHover(target);
    await wait(120);
    downloadButton = findDownloadButton(target);
  }

  if (!downloadButton) {
    return {
      success: false,
      error: "다운로드 버튼을 찾지 못했습니다.",
    };
  }

  if (downloadButton instanceof HTMLElement) {
    if ("disabled" in downloadButton) {
      try {
        downloadButton.disabled = false;
      } catch {
        // Ignore when the element doesn't support disabled assignment.
      }
    }

    if (downloadButton.getAttribute("aria-disabled") === "true") {
      downloadButton.setAttribute("aria-disabled", "false");
    }

    simulateHover(downloadButton);
    await wait(30);

    downloadButton.click();

    return {
      success: true,
    };
  }

  return {
    success: false,
    error: "다운로드 버튼 요소와 상호작용할 수 없습니다.",
  };
};

export const readFeedItems = async (
  limit: number
): Promise<{ items: FeedItemPreview[]; totalCount: number }> => {
  const tabId = await requireActiveTabId();

  const [injectionResult] = await chrome.scripting.executeScript({
    target: { tabId },
    func: collectFeedItemsScript,
    args: [FEED_ROOT_SELECTOR, FEED_ITEM_SELECTOR, limit],
  });

  const result = injectionResult?.result as FeedItemsScriptResult | undefined;

  if (!result || !result.success) {
    throw new Error(result?.error ?? "피드 아이템을 읽어오지 못했습니다.");
  }

  return {
    items: result.items,
    totalCount: result.totalCount,
  };
};

export const triggerFeedItemDownload = async (
  preview: FeedItemPreview
): Promise<void> => {
  const tabId = await requireActiveTabId();

  const [injectionResult] = await chrome.scripting.executeScript({
    target: { tabId },
    func: triggerFeedItemDownloadScript,
    args: [
      FEED_ROOT_SELECTOR,
      FEED_ITEM_SELECTOR,
      preview.index,
      preview.signature ?? null,
    ],
  });

  const result = injectionResult?.result as
    | TriggerDownloadScriptResult
    | undefined;

  if (!result || !result.success) {
    throw new Error(
      result?.error ?? "다운로드 버튼과 상호작용하는 데 실패했습니다."
    );
  }
};
