import {
  FEED_ITEM_OVERLAY_SELECTOR,
  FEED_ITEM_SELECTOR,
  FEED_ROOT_SELECTOR,
} from "./selectors";
import { requireActiveTabId } from "./tabs";

type DownloadJobResult = {
  jobId: string;
  initiated: boolean;
};

const DOWNLOAD_ICON_PATH_SIGNATURE =
  "M12 3C12.2761 3 12.5 3.22386 12.5 3.5V12.7929L15.6464";

export const downloadJobImage = async (
  jobId: string
): Promise<DownloadJobResult> => {
  const trimmedJobId = jobId.trim();

  if (!trimmedJobId) {
    throw new Error("유효한 Job ID를 입력해주세요.");
  }

  const tabId = await requireActiveTabId();

  const [injectionResult] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async (
      rootSelector: string,
      itemSelector: string,
      overlaySelector: string,
      targetJobId: string,
      downloadIconSignature: string
    ) => {
      const sleep = (ms: number) =>
        new Promise<void>((resolve) => setTimeout(resolve, ms));

      const waitForAnimationFrameInPage = () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const triggerHoverInPage = (target: Element | null) => {
        if (!target) {
          return;
        }

        const events = [
          "pointerenter",
          "pointerover",
          "mouseenter",
          "mouseover",
          "focus",
        ] as const;

        for (const type of events) {
          target.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              cancelable: true,
            })
          );
        }
      };

      const matchesDownloadIconInPage = (element: Element | null) => {
        if (!(element instanceof HTMLElement)) {
          return false;
        }

        const svg = element.querySelector("svg");
        if (!svg) {
          return false;
        }

        const ariaLabel =
          element.getAttribute("aria-label") || svg.getAttribute("aria-label");
        if (ariaLabel && /download/i.test(ariaLabel)) {
          return true;
        }

        const title = svg.getAttribute("title");
        if (title && /download/i.test(title)) {
          return true;
        }

        const path = svg.querySelector("path");
        if (!path) {
          return false;
        }

        const d = path.getAttribute("d") ?? "";
        return d.includes(downloadIconSignature);
      };

      const findDownloadButtonInPage = (item: Element) => {
        const bottomContainer = item.querySelector(
          "div[class*='bottom-2'][class*='right-2']"
        );

        if (bottomContainer) {
          const buttonCandidate = Array.from(
            bottomContainer.querySelectorAll("button")
          ).find((candidate) => matchesDownloadIconInPage(candidate));

          if (buttonCandidate instanceof HTMLElement) {
            return buttonCandidate;
          }
        }

        const fallback = Array.from(item.querySelectorAll("button")).find(
          (candidate) => matchesDownloadIconInPage(candidate)
        );

        return fallback instanceof HTMLElement ? fallback : null;
      };

      const feedRoot = document.querySelector(rootSelector);

      if (!feedRoot) {
        return {
          success: false as const,
          error: "피드 영역을 찾지 못했습니다.",
        };
      }

      const items = Array.from(feedRoot.querySelectorAll(itemSelector));

      if (items.length === 0) {
        return {
          success: false as const,
          error: "피드에 표시된 항목이 없습니다.",
        };
      }

      const normalisedTarget = targetJobId.trim().toLowerCase();

      for (const item of items) {
        const overlay = item.querySelector(overlaySelector);

        if (!(overlay instanceof HTMLAnchorElement)) {
          continue;
        }

        const href = overlay.getAttribute("href") ?? "";
        const match = /\/job\/([^/?#]+)/i.exec(href);

        if (!match?.[1]) {
          continue;
        }

        const rawJobId = match[1];
        const normalisedJobId = rawJobId.trim().toLowerCase();

        if (normalisedJobId !== normalisedTarget) {
          continue;
        }

        const downloadButton = findDownloadButtonInPage(item);

        if (!downloadButton) {
          return {
            success: false as const,
            error: "다운로드 버튼을 찾지 못했습니다.",
          };
        }

        downloadButton.scrollIntoView({ block: "center", behavior: "smooth" });
        triggerHoverInPage(item);
        await waitForAnimationFrameInPage();
        triggerHoverInPage(downloadButton);
        await sleep(50);

        downloadButton.click();
        await waitForAnimationFrameInPage();

        if (
          downloadButton.getAttribute("aria-busy") === "true" ||
          downloadButton.matches("[disabled]")
        ) {
          await sleep(150);
          triggerHoverInPage(downloadButton);
          downloadButton.click();
        }

        return {
          success: true as const,
          jobId: rawJobId,
        };
      }

      return {
        success: false as const,
        error: "해당 Job ID 카드가 화면에 존재하지 않습니다.",
      };
    },
    args: [
      FEED_ROOT_SELECTOR,
      FEED_ITEM_SELECTOR,
      FEED_ITEM_OVERLAY_SELECTOR,
      trimmedJobId,
      DOWNLOAD_ICON_PATH_SIGNATURE,
    ],
  });

  const response = injectionResult?.result as
    | { success: true; jobId: string }
    | { success: false; error: string }
    | undefined;

  if (!response?.success) {
    throw new Error(
      response?.error ?? "이미지 다운로드 정보를 가져오지 못했습니다."
    );
  }

  return {
    jobId: trimmedJobId,
    initiated: true,
  };
};

export type { DownloadJobResult };
