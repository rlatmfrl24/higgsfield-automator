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
      html: string;
    }
  | {
      success: false;
      error: string;
      html?: string;
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
  const TARGET_DOWNLOAD_ICON_SIGNATURE =
    "M12 3C12.2761 3 12.5 3.22386 12.5 3.5V12.7929L15.6464 9.64645C15.8417 9.45118 16.1583 9.45118 16.3536 9.64645C16.5488 9.84171 16.5488 10.1583 16.3536 10.3536L12.3536 14.3536C12.1583 14.5488 11.8417 14.5488 11.6464 14.3536L7.64645 10.3536C7.45118 10.1583 7.45118 9.84171 7.64645 9.64645C7.84171 9.45118 8.15829 9.45118 8.35355 9.64645L11.5 12.7929V3.5C11.5 3.22386 11.7239 3 12 3ZM4 14.5C4.27614 14.5 4.5 14.7239 4.5 15V18C4.5 18.8284 5.17157 19.5 6 19.5H18C18.8284 19.5 19.5 18.8284 19.5 18V15C19.5 14.7239 19.7239 14.5 20 14.5C20.2761 14.5 20.5 14.7239 20.5 15V18C20.5 19.3807 19.3807 20.5 18 20.5H6C4.61929 20.5 3.5 19.3807 3.5 18V15C3.5 14.7239 3.72386 14.5 4 14.5Z";

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

  const waitForAnimationFrame = () =>
    new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });

  const serialiseElement = (element: Element) => {
    if (element instanceof HTMLElement) {
      return element.outerHTML;
    }

    try {
      return new XMLSerializer().serializeToString(element);
    } catch {
      return element.textContent ?? "";
    }
  };

  const createPointerAndMouseEventInits = (element: Element) => {
    const rect = element.getBoundingClientRect();

    const clientX = Number.isFinite(rect.left)
      ? rect.left + Math.max(1, rect.width / 2)
      : 0;
    const clientY = Number.isFinite(rect.top)
      ? rect.top + Math.max(1, rect.height / 2)
      : 0;

    const baseMouseInit: MouseEventInit = {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX,
      clientY,
      screenX: window.screenX + clientX,
      screenY: window.screenY + clientY,
    };

    const pointerInit: PointerEventInit = {
      ...baseMouseInit,
      pointerId: 1,
      pointerType: "mouse",
    };

    return {
      pointerInit,
      mouseInit: baseMouseInit,
      clientX,
      clientY,
    };
  };

  const simulateHover = async (element: Element | null) => {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const { pointerInit, mouseInit } = createPointerAndMouseEventInits(element);

    if (typeof window.PointerEvent === "function") {
      for (const type of ["pointerover", "pointerenter", "pointermove"]) {
        try {
          element.dispatchEvent(new PointerEvent(type, pointerInit));
        } catch {
          // ignore
        }
      }
    }

    for (const type of ["mouseover", "mouseenter", "mousemove"]) {
      try {
        element.dispatchEvent(new MouseEvent(type, mouseInit));
      } catch {
        // ignore
      }
    }

    try {
      element.dispatchEvent(
        new FocusEvent("focus", {
          bubbles: true,
          cancelable: true,
        })
      );
    } catch {
      // ignore
    }

    if (typeof element.focus === "function") {
      try {
        element.focus({ preventScroll: true });
      } catch {
        // ignore
      }
    }

    await waitForAnimationFrame();

    return element.matches(":hover");
  };

  const ensureHover = async (element: Element | null) => {
    if (!element) {
      return false;
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (await simulateHover(element)) {
        return true;
      }

      await wait(60);
    }

    return false;
  };

  const simulateClick = async (element: Element | null) => {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const { pointerInit, mouseInit } = createPointerAndMouseEventInits(element);

    const pointerDownInit: PointerEventInit = {
      ...pointerInit,
      buttons: 1,
      button: 0,
    };

    const mouseDownInit: MouseEventInit = {
      ...mouseInit,
      buttons: 1,
      button: 0,
    };

    if (typeof window.PointerEvent === "function") {
      try {
        element.dispatchEvent(new PointerEvent("pointerdown", pointerDownInit));
      } catch {
        // ignore
      }
    }

    try {
      element.dispatchEvent(new MouseEvent("mousedown", mouseDownInit));
    } catch {
      // ignore
    }

    await wait(30);

    if (typeof window.PointerEvent === "function") {
      try {
        element.dispatchEvent(new PointerEvent("pointerup", pointerDownInit));
      } catch {
        // ignore
      }
    }

    try {
      element.dispatchEvent(new MouseEvent("mouseup", mouseDownInit));
    } catch {
      // ignore
    }

    try {
      element.dispatchEvent(new MouseEvent("click", mouseInit));
    } catch {
      // ignore
    }

    try {
      element.focus({ preventScroll: true });
    } catch {
      // ignore
    }

    await waitForAnimationFrame();

    try {
      element.click();
    } catch {
      // ignore
    }

    return true;
  };

  const normaliseSvgPath = (value: string) => value.replace(/\s+/g, " ").trim();

  const matchesSvgSignature = (element: Element | null, signature: string) => {
    if (!element) {
      return false;
    }

    const svg = element.querySelector("svg");

    if (!svg) {
      return false;
    }

    const path = svg.querySelector("path");

    if (!path) {
      return false;
    }

    const d = normaliseSvgPath(path.getAttribute("d") ?? "");
    const normalisedSignature = normaliseSvgPath(signature);

    return d === normalisedSignature;
  };

  const findButtonBySvgSignature = (
    scope: Element,
    signature: string
  ): HTMLElement | null => {
    const interactiveSelectors = "button, [role='button'], a, [tabindex]";
    const normalisedSignature = normaliseSvgPath(signature);

    const buttons = scope.querySelectorAll<HTMLElement>(interactiveSelectors);

    for (const button of buttons) {
      if (matchesSvgSignature(button, normalisedSignature)) {
        return button;
      }
    }

    const paths = scope.querySelectorAll<SVGPathElement>("svg path");

    for (const path of paths) {
      const d = normaliseSvgPath(path.getAttribute("d") ?? "");

      if (d !== normalisedSignature) {
        continue;
      }

      const interactiveAncestor = path.closest(interactiveSelectors);

      if (interactiveAncestor instanceof HTMLElement) {
        return interactiveAncestor;
      }

      if (path.parentElement instanceof HTMLElement) {
        return path.parentElement;
      }
    }

    return null;
  };

  const waitForButtonBySvgSignature = async (
    scope: Element,
    signature: string,
    attempts = 15,
    delayMs = 120
  ): Promise<HTMLElement | null> => {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const button = findButtonBySvgSignature(scope, signature);

      if (button) {
        return button;
      }

      await wait(delayMs);
      await ensureHover(scope);
    }

    return null;
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

  await ensureHover(target);
  await wait(120);

  const downloadButton = await waitForButtonBySvgSignature(
    target,
    TARGET_DOWNLOAD_ICON_SIGNATURE
  );

  if (!downloadButton) {
    return {
      success: false,
      error: "지정된 SVG 버튼을 찾지 못했습니다.",
      html: serialiseElement(target),
    };
  }

  if ("disabled" in downloadButton) {
    try {
      (downloadButton as HTMLButtonElement).disabled = false;
    } catch {
      // ignore
    }
  }

  if (downloadButton.getAttribute("aria-disabled") === "true") {
    downloadButton.setAttribute("aria-disabled", "false");
  }

  await ensureHover(downloadButton);
  await wait(80);

  const hoveredHtml = serialiseElement(target);

  try {
    const clicked = await simulateClick(downloadButton);

    if (!clicked) {
      downloadButton.click();
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "지정된 SVG 버튼 클릭에 실패했습니다.",
      html: hoveredHtml,
    };
  }

  await waitForAnimationFrame();
  await wait(120);

  return {
    success: true,
    html: hoveredHtml,
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
): Promise<TriggerDownloadScriptResult> => {
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

  if (!result) {
    throw new Error("다운로드 버튼과 상호작용하는 데 실패했습니다.");
  }

  if (!result.success) {
    throw new Error(
      result.error ?? "다운로드 버튼과 상호작용하는 데 실패했습니다."
    );
  }

  return result;
};
