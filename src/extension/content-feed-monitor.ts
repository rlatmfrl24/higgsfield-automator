/// <reference lib="dom" />

// 주의: 콘텐츠 스크립트는 MV3에서 클래식 스크립트로 동작하므로
// 번들 결과에 ESM import 구문이 포함되면 실행이 중단된다.
// 공유 상수는 빌드 시 분리되어 import가 생성될 수 있어, 이 파일에서는
// 필요한 값을 직접 정의한다. 수정 시 `src/extension/constants.ts`와
// 반드시 동일하게 유지해야 한다.
const FEED_ROOT_SELECTOR = "[data-sentry-component='SoulFeed']";
const FEED_ITEM_SELECTOR = "[data-sentry-component='SoulFeedItem']";
const UPSALE_SELECTOR = "[data-sentry-component='ImageUpsellComponent']";

const UPSALE_TEXT_PATTERNS = [
  /Try\s+Higgsfield\s+Premium/i,
  /Less\s+Wait/i,
  /10x\s+faster\s+generations/i,
  /Access\s+to\s+consistent\s+characters/i,
  /Batch\s+size\s+up\s+to\s+4/i,
  /Upgrade/i,
];
const PROGRESS_SELECTOR =
  "[data-sentry-element='Progress'], [data-sentry-element='Loader']";
const GENERATING_TEXT_PATTERNS = [/generating/i, /loading/i];

const FEED_CHECK_INTERVAL_MS = 2000;
let observer: MutationObserver | undefined;
let intervalId: number | undefined;
let lastReportedSignature = "";

function extractCardSignature(card: Element) {
  const text = card.textContent ?? "";
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.slice(0, 200);
}

function containsUpsellText(textContent: string) {
  return UPSALE_TEXT_PATTERNS.some((pattern) => pattern.test(textContent));
}

function isGeneratingCard(card: Element | null | undefined) {
  if (!card) {
    return false;
  }

  const textContent = card.textContent ?? "";

  if (card.querySelector(UPSALE_SELECTOR)) {
    return true;
  }

  if (containsUpsellText(textContent)) {
    return true;
  }

  if (card.querySelector(PROGRESS_SELECTOR)) {
    return true;
  }

  if (GENERATING_TEXT_PATTERNS.some((pattern) => pattern.test(textContent))) {
    return true;
  }

  return false;
}

function collectActiveSignatures(cards: Element[]) {
  return cards
    .filter((card) => isGeneratingCard(card))
    .map((card) => extractCardSignature(card));
}

function reportActiveCount() {
  try {
    const feed = document.querySelector(FEED_ROOT_SELECTOR);
    if (!feed) {
      return;
    }

    const cards = Array.from(feed.querySelectorAll(FEED_ITEM_SELECTOR));
    const activeCards = cards.filter((card) => isGeneratingCard(card));
    const activeCount = activeCards.length;
    const signatures = collectActiveSignatures(activeCards);
    const signaturePayload = `${activeCount}:${signatures.join("|")}`;

    if (signaturePayload === lastReportedSignature) {
      return;
    }

    lastReportedSignature = signaturePayload;

    chrome.runtime.sendMessage(
      {
        type: "feed:active-count",
        payload: { activeCount, signatures },
      },
      () => {
        const err = chrome.runtime.lastError;
        if (err && !/Receiving end does not exist/.test(err.message ?? "")) {
          console.warn("[HiggsfieldAutomator] feed report failed", err);
        }
      }
    );
  } catch (cause) {
    console.error("[HiggsfieldAutomator] feed monitor error", cause);
  }
}

function startObserver() {
  const feed = document.querySelector(FEED_ROOT_SELECTOR);
  if (!feed) {
    return;
  }

  if (observer) {
    observer.disconnect();
  }

  observer = new MutationObserver(() => {
    reportActiveCount();
  });

  observer.observe(feed, {
    childList: true,
    subtree: true,
  });

  reportActiveCount();
}

function startInterval() {
  if (intervalId) {
    clearInterval(intervalId);
  }

  intervalId = window.setInterval(() => {
    reportActiveCount();
  }, FEED_CHECK_INTERVAL_MS);
}

function init() {
  const feed = document.querySelector(FEED_ROOT_SELECTOR);

  if (!feed) {
    const retry = () => {
      const nextFeed = document.querySelector(FEED_ROOT_SELECTOR);
      if (!nextFeed) {
        window.setTimeout(retry, 1000);
        return;
      }
      startObserver();
      startInterval();
    };

    retry();
    return;
  }

  startObserver();
  startInterval();
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    reportActiveCount();
  }
});

window.addEventListener("focus", () => {
  reportActiveCount();
});

init();

export {};
