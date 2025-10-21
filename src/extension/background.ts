/// <reference lib="dom" />

import { TARGET_ORIGIN, TARGET_PATH, FORM_SELECTOR } from "../constants";

const RETRY_ALARM_NAME = "automation:retry";
const RETRY_DELAY_MS = 3000;

type QueueEntry = { prompt: string; ratio: string | null };

type AutomationState = {
  status: "idle" | "running" | "paused";
  processedCount: number;
  maxCount: number;
  activeCount: number;
  nextRetryAt: number | null;
  lastError: string | null;
  queue: QueueEntry[];
  cursor: number;
  promptFieldIndex: number | null;
  ratioFieldIndex: number | null;
  activeSignatures: string[];
};

const DEFAULT_STATE: AutomationState = {
  status: "idle",
  processedCount: 0,
  maxCount: 0,
  activeCount: 0,
  nextRetryAt: null,
  lastError: null,
  queue: [],
  cursor: 0,
  promptFieldIndex: null,
  ratioFieldIndex: null,
  activeSignatures: [],
};

let automationState: AutomationState = { ...DEFAULT_STATE };
let isAdvancingQueue = false;

const queuesAreEqual = (
  nextQueue: AutomationState["queue"],
  previousQueue: AutomationState["queue"]
) => {
  if (nextQueue === previousQueue) {
    return true;
  }

  if (!Array.isArray(nextQueue) || !Array.isArray(previousQueue)) {
    return false;
  }

  if (nextQueue.length !== previousQueue.length) {
    return false;
  }

  return nextQueue.every((entry, index) => {
    const previousEntry = previousQueue[index];

    if (!entry && !previousEntry) {
      return true;
    }

    if (!entry || !previousEntry) {
      return false;
    }

    return (
      entry.prompt === previousEntry.prompt &&
      entry.ratio === previousEntry.ratio
    );
  });
};

const signaturesAreEqual = (
  nextSignatures: string[],
  previousSignatures: string[]
) => {
  if (nextSignatures === previousSignatures) {
    return true;
  }

  if (!Array.isArray(nextSignatures) || !Array.isArray(previousSignatures)) {
    return false;
  }

  if (nextSignatures.length !== previousSignatures.length) {
    return false;
  }

  return nextSignatures.every(
    (signature, index) => signature === previousSignatures[index]
  );
};

const automationStatesAreEqual = (
  nextState: AutomationState,
  previousState: AutomationState
) => {
  if (nextState === previousState) {
    return true;
  }

  if (!nextState || !previousState) {
    return false;
  }

  return (
    nextState.status === previousState.status &&
    nextState.processedCount === previousState.processedCount &&
    nextState.maxCount === previousState.maxCount &&
    nextState.activeCount === previousState.activeCount &&
    nextState.nextRetryAt === previousState.nextRetryAt &&
    nextState.lastError === previousState.lastError &&
    nextState.cursor === previousState.cursor &&
    nextState.promptFieldIndex === previousState.promptFieldIndex &&
    nextState.ratioFieldIndex === previousState.ratioFieldIndex &&
    queuesAreEqual(nextState.queue, previousState.queue) &&
    signaturesAreEqual(
      nextState.activeSignatures,
      previousState.activeSignatures
    )
  );
};

const withDefaultState = (
  state: Partial<AutomationState> | undefined
): AutomationState => ({
  ...DEFAULT_STATE,
  ...(state ?? {}),
  queue: Array.isArray(state?.queue) ? state.queue : [],
  cursor: typeof state?.cursor === "number" ? state.cursor : 0,
  promptFieldIndex:
    typeof state?.promptFieldIndex === "number" ? state.promptFieldIndex : null,
  ratioFieldIndex:
    typeof state?.ratioFieldIndex === "number" ? state.ratioFieldIndex : null,
});

const toPublicState = (state: AutomationState) => ({
  status: state.status,
  processedCount: state.processedCount,
  maxCount: state.maxCount,
  activeCount: state.activeCount,
  nextRetryAt: state.nextRetryAt,
  lastError: state.lastError,
  queue: state.queue,
  cursor: state.cursor,
  activeSignatures: state.activeSignatures,
});

const log = (...args: unknown[]) => {
  console.info("[HiggsfieldAutomator]", ...args);
};

const warn = (...args: unknown[]) => {
  console.warn("[HiggsfieldAutomator]", ...args);
};

const errorLog = (...args: unknown[]) => {
  console.error("[HiggsfieldAutomator]", ...args);
};

const logEvent = (event: string, detail: Record<string, unknown> = {}) => {
  log(`event=${event}`, detail);
};

async function persistState(nextState: AutomationState) {
  await chrome.storage.local.set({ automationState: nextState });
}

function broadcastState(state: AutomationState = automationState) {
  chrome.runtime.sendMessage(
    { type: "automation:state", payload: toPublicState(state) },
    () => {
      const lastError = chrome.runtime.lastError;
      if (
        lastError &&
        !/Receiving end does not exist/.test(lastError.message ?? "")
      ) {
        warn("Failed to broadcast automation state", lastError);
      }
    }
  );
}

async function updateState(partial: Partial<AutomationState>) {
  const nextState = withDefaultState({
    ...automationState,
    ...(partial ?? {}),
  });

  if (automationStatesAreEqual(nextState, automationState)) {
    logEvent("state:noop", toPublicState(nextState));
    return automationState;
  }

  automationState = nextState;
  await persistState(automationState);
  broadcastState();
  logEvent("state:update", toPublicState(automationState));
  return automationState;
}

async function restoreState() {
  try {
    const stored = await chrome.storage.local.get("automationState");
    automationState = withDefaultState(stored?.automationState);
    log("Restored automation state", automationState);
    broadcastState();
  } catch (cause) {
    errorLog("Failed to restore automation state", cause);
    automationState = { ...DEFAULT_STATE };
  }
}

function matchesTarget(url: string | undefined | null) {
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return (
      parsed.origin === TARGET_ORIGIN && parsed.pathname.startsWith(TARGET_PATH)
    );
  } catch (cause) {
    warn("Failed to parse URL", url, cause);
    return false;
  }
}

async function getActiveSoulTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });

  if (tab && matchesTarget(tab.url ?? "")) {
    return tab;
  }

  const [matchingTab] = await chrome.tabs.query({ url: `${TARGET_ORIGIN}/*` });
  return matchingTab ?? tab;
}

async function triggerGeneration() {
  const tab = await getActiveSoulTab();

  if (!tab?.id) {
    throw new Error("이미지 생성 탭을 찾지 못했습니다.");
  }

  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const hasUpsell = Boolean(
        document.querySelector("[data-sentry-component='ImageUpsellComponent']")
      );

      if (hasUpsell) {
        return {
          success: false,
          error: "업셀 카드가 감지되었습니다.",
          feedHasUpsell: true,
        } as const;
      }

      const normalise = (value: string | null | undefined) =>
        value?.replace(/\s+/g, " ").trim().toLowerCase();

      const equalsTarget = (value: string | null | undefined) => {
        if (!value) {
          return false;
        }

        return (
          normalise(value)?.includes("daily free credits left".toLowerCase()) ??
          false
        );
      };

      const candidates = Array.from(
        document.querySelectorAll("button, [role='button']")
      ).filter(
        (element): element is HTMLElement => element instanceof HTMLElement
      );

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
            .filter(
              (label): label is HTMLElement => label instanceof HTMLElement
            );

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
          feedHasUpsell: false,
        } as const;
      }

      targetButton.click();

      return {
        success: true,
        feedHasUpsell: false,
      } as const;
    },
  });

  const response = result?.result as
    | { success: true; feedHasUpsell: boolean }
    | { success: false; error?: string; feedHasUpsell?: boolean }
    | undefined;

  if (!response?.success) {
    throw new Error(
      response?.error ?? "이미지 생성 버튼을 클릭하지 못했습니다."
    );
  }
}

function sanitizeQueue(queue: unknown): QueueEntry[] {
  if (!Array.isArray(queue)) {
    return [];
  }

  return queue
    .map((raw) => {
      if (!raw || typeof raw !== "object") {
        return null;
      }

      const entry = raw as { prompt?: unknown; ratio?: unknown };

      const prompt =
        typeof entry.prompt === "string" ? entry.prompt.trim() : "";
      const ratio = typeof entry.ratio === "string" ? entry.ratio.trim() : "";

      if (!prompt) {
        return null;
      }

      return {
        prompt,
        ratio: ratio || null,
      } satisfies QueueEntry;
    })
    .filter((entry): entry is QueueEntry => entry !== null);
}

function applyFieldsInPage(
  selector: string,
  promptIndex: number | null,
  promptValue: string | null,
  ratioIndex: number | null,
  ratioValue: string | null
) {
  const setNativeValue = (
    element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
    value: string | null
  ) => {
    const ownDescriptor = Object.getOwnPropertyDescriptor(element, "value");

    if (ownDescriptor?.set) {
      ownDescriptor.set.call(element, value);
      return;
    }

    let prototype: HTMLElement | null = Object.getPrototypeOf(element);

    while (prototype) {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

      if (descriptor?.set) {
        descriptor.set.call(element, value);
        return;
      }

      prototype = Object.getPrototypeOf(prototype);
    }

    (element as HTMLInputElement).value = value ?? "";
  };

  const applyValue = (fieldIndex: number | null, value: string | null) => {
    if (typeof fieldIndex !== "number" || fieldIndex < 0) {
      return { success: true } as const;
    }

    const form = document.querySelector(selector);

    if (!(form instanceof HTMLFormElement)) {
      return { success: false, error: "폼을 찾을 수 없습니다." } as const;
    }

    const fields = form.querySelectorAll("input, textarea, select");
    const element = fields.item(fieldIndex);

    if (!(element instanceof HTMLElement)) {
      return {
        success: false,
        error: "대상 필드를 찾을 수 없습니다.",
      } as const;
    }

    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    ) {
      setNativeValue(element, value ?? "");
    } else if (element instanceof HTMLSelectElement) {
      setNativeValue(element, value ?? "");
      Array.from(element.options).forEach((option) => {
        option.selected = option.value === value;
      });
    } else {
      return {
        success: false,
        error: "지원하지 않는 필드 타입입니다.",
      } as const;
    }

    const inputEvent = new Event("input", {
      bubbles: true,
      composed: true,
      cancelable: false,
    });
    const changeEvent = new Event("change", {
      bubbles: true,
      cancelable: false,
    });

    element.dispatchEvent(inputEvent);
    element.dispatchEvent(changeEvent);

    return { success: true } as const;
  };

  const promptResult = applyValue(promptIndex, promptValue ?? "");
  if (!promptResult.success) {
    return promptResult;
  }

  if (
    typeof ratioIndex === "number" &&
    ratioIndex >= 0 &&
    typeof ratioValue === "string" &&
    ratioValue.length
  ) {
    const ratioResult = applyValue(ratioIndex, ratioValue ?? "");
    if (!ratioResult.success) {
      return ratioResult;
    }
  }

  return { success: true } as const;
}

async function applyEntryToForm(entry: {
  prompt: string;
  ratio: string | null;
}) {
  const tab = await getActiveSoulTab();

  if (!tab?.id) {
    throw new Error("이미지 생성 탭을 찾지 못했습니다.");
  }

  logEvent("form:apply", { cursor: automationState.cursor, entry });

  const promptIndex = automationState.promptFieldIndex;

  if (typeof promptIndex !== "number" || promptIndex < 0) {
    throw new Error("프롬프트 입력 필드 정보를 확인할 수 없습니다.");
  }

  const ratioIndex =
    typeof automationState.ratioFieldIndex === "number"
      ? automationState.ratioFieldIndex
      : null;

  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: applyFieldsInPage,
    args: [
      FORM_SELECTOR,
      promptIndex,
      entry.prompt,
      ratioIndex,
      typeof entry.ratio === "string" ? entry.ratio : null,
    ],
  });

  const response = result?.result as
    | ReturnType<typeof applyFieldsInPage>
    | undefined;

  if (!response?.success) {
    throw new Error(response?.error ?? "폼 데이터를 업데이트하지 못했습니다.");
  }
}

async function clearRetryAlarm() {
  await chrome.alarms.clear(RETRY_ALARM_NAME);
  if (automationState.nextRetryAt) {
    await updateState({ nextRetryAt: null });
  }
}

async function scheduleRetry() {
  if (
    automationState.cursor >= automationState.queue.length ||
    automationState.queue.length === 0
  ) {
    await stopAutomationInternal({ reset: true, reason: null });
    return null;
  }

  const existingAlarm = await chrome.alarms.get(RETRY_ALARM_NAME);

  if (existingAlarm) {
    return existingAlarm.when ?? null;
  }

  const when = Date.now() + RETRY_DELAY_MS;
  await chrome.alarms.create(RETRY_ALARM_NAME, { when });
  await updateState({ nextRetryAt: when });
  logEvent("retry:scheduled", { when });
  return when;
}

async function stopAutomationInternal({
  reset = true,
  reason = null,
}: { reset?: boolean; reason?: string | null } = {}) {
  await clearRetryAlarm();
  logEvent("automation:stop", { reset, reason });

  const nextState: AutomationState = {
    ...automationState,
    status: "idle",
    nextRetryAt: null,
    lastError: reason ?? automationState.lastError,
  };

  if (reset) {
    nextState.queue = [];
    nextState.cursor = 0;
    nextState.maxCount = 0;
    nextState.processedCount = 0;
  }

  return updateState(nextState);
}

async function handleFeedActiveCount(
  activeCount: number,
  signatures: string[] = []
) {
  const clamped =
    Number.isFinite(activeCount) && activeCount > 0
      ? Math.floor(activeCount)
      : 0;
  const previousActiveCount = automationState.activeCount;
  const nextState = await updateState({
    activeCount: clamped,
    activeSignatures: signatures,
  });
  logEvent("feed:update", { activeCount: clamped, signatures });

  if (nextState.status === "paused") {
    await clearRetryAlarm();
    return automationState;
  }

  if (nextState.status !== "running") {
    return automationState;
  }

  if (nextState.cursor >= nextState.queue.length) {
    await stopAutomationInternal({ reset: true, reason: null });
    return automationState;
  }

  if (clamped === 0 && previousActiveCount > 0) {
    await clearRetryAlarm();
    await scheduleRetry();
    return automationState;
  }

  if (clamped > 0) {
    await scheduleRetry();
  }

  return automationState;
}

async function runNextGeneration() {
  if (isAdvancingQueue) {
    logEvent("queue:advance:skipped", { reason: "in_flight" });
    return false;
  }

  isAdvancingQueue = true;
  try {
    if (automationState.activeCount > 0) {
      logEvent("queue:blocked", {
        reason: "active_cards",
        activeCount: automationState.activeCount,
        signatures: automationState.activeSignatures,
      });
      await scheduleRetry();
      return false;
    }

    if (
      automationState.cursor >= automationState.queue.length ||
      automationState.queue.length === 0
    ) {
      await stopAutomationInternal({ reset: true, reason: null });
      return false;
    }

    const entry = automationState.queue[automationState.cursor];

    if (!entry || !entry.prompt) {
      await updateState({
        lastError: "다음 프롬프트 데이터를 확인할 수 없습니다.",
        cursor: automationState.cursor + 1,
      });
      await scheduleRetry();
      return false;
    }

    await applyEntryToForm(entry);
    await triggerGeneration();

    const nextCursor = automationState.cursor + 1;
    const nextProcessed = automationState.processedCount + 1;

    await updateState({
      cursor: nextCursor,
      processedCount: nextProcessed,
      lastError: null,
    });
    logEvent("queue:advanced", {
      cursor: nextCursor,
      processedCount: nextProcessed,
    });

    if (nextCursor >= automationState.queue.length) {
      await stopAutomationInternal({ reset: true, reason: null });
      logEvent("queue:completed");
      return false;
    }

    await scheduleRetry();
    return true;
  } finally {
    isAdvancingQueue = false;
  }
}

async function startAutomation({
  queue,
  promptFieldIndex,
  ratioFieldIndex,
}: {
  queue?: unknown;
  promptFieldIndex?: number;
  ratioFieldIndex?: number | null;
} = {}) {
  const sanitizedQueue = sanitizeQueue(queue);

  if (!sanitizedQueue.length) {
    throw new Error("자동화할 유효한 프롬프트가 없습니다.");
  }

  if (typeof promptFieldIndex !== "number" || promptFieldIndex < 0) {
    throw new Error("프롬프트 입력 필드 정보를 확인할 수 없습니다.");
  }

  await clearRetryAlarm();

  await updateState({
    status: "running",
    processedCount: 0,
    maxCount: sanitizedQueue.length,
    nextRetryAt: null,
    lastError: null,
    queue: sanitizedQueue,
    cursor: 0,
    promptFieldIndex,
    ratioFieldIndex:
      typeof ratioFieldIndex === "number" && ratioFieldIndex >= 0
        ? ratioFieldIndex
        : null,
  });
  logEvent("automation:start", {
    maxCount: sanitizedQueue.length,
    promptFieldIndex,
    ratioFieldIndex,
  });

  if (automationState.activeCount > 0) {
    return automationState;
  }

  try {
    await runNextGeneration();
  } catch (cause) {
    await updateState({
      lastError:
        cause instanceof Error
          ? cause.message
          : String(cause ?? "이미지 생성 요청에 실패했습니다."),
    });
    await scheduleRetry();
    throw cause;
  }

  return automationState;
}

async function pauseAutomation() {
  if (automationState.status !== "running") {
    return automationState;
  }

  await clearRetryAlarm();
  logEvent("automation:pause");
  return updateState({ status: "paused", nextRetryAt: null });
}

async function resumeAutomation() {
  if (automationState.status !== "paused") {
    return automationState;
  }

  await updateState({ status: "running", lastError: null });
  logEvent("automation:resume");

  if (automationState.activeCount === 0) {
    try {
      await runNextGeneration();
    } catch (cause) {
      await updateState({
        lastError:
          cause instanceof Error
            ? cause.message
            : String(cause ?? "이미지 생성 요청에 실패했습니다."),
      });
      await scheduleRetry();
      return automationState;
    }
  }

  await scheduleRetry();
  return automationState;
}

function buildSuccessResponse(state: AutomationState) {
  return {
    success: true as const,
    state: toPublicState(state),
  };
}

function buildErrorResponse(cause: unknown) {
  const message =
    cause instanceof Error
      ? cause.message
      : String(cause ?? "알 수 없는 오류가 발생했습니다.");
  return {
    success: false as const,
    error: message,
    state: toPublicState(automationState),
  };
}

type AutomationMessagePayload = {
  queue?: unknown;
  promptFieldIndex?: number;
  ratioFieldIndex?: number | null;
  activeCount?: number;
  signatures?: string[];
};

chrome.runtime.onMessage.addListener(
  (
    message: { type?: string; payload?: AutomationMessagePayload } | undefined,
    _sender: unknown,
    sendResponse: (response: unknown) => void
  ) => {
    const { type, payload } = (message ?? {}) as {
      type?: string;
      payload?: {
        queue?: unknown;
        promptFieldIndex?: number;
        ratioFieldIndex?: number | null;
        activeCount?: number;
        signatures?: string[];
      };
    };

    (async () => {
      try {
        switch (type) {
          case "automation:getState": {
            sendResponse(buildSuccessResponse(automationState));
            return;
          }
          case "automation:start": {
            const state = await startAutomation(payload ?? {});
            sendResponse(buildSuccessResponse(state));
            return;
          }
          case "automation:pause": {
            const state = await pauseAutomation();
            sendResponse(buildSuccessResponse(state));
            return;
          }
          case "automation:resume": {
            const state = await resumeAutomation();
            sendResponse(buildSuccessResponse(state));
            return;
          }
          case "automation:stop": {
            const state = await stopAutomationInternal({
              reset: true,
              reason: null,
            });
            sendResponse(buildSuccessResponse(state));
            return;
          }
          case "feed:active-count": {
            const state = await handleFeedActiveCount(
              payload?.activeCount ?? 0,
              payload?.signatures ?? []
            );
            sendResponse(buildSuccessResponse(state));
            return;
          }
          default: {
            sendResponse(
              buildErrorResponse(new Error("지원되지 않는 메시지입니다."))
            );
          }
        }
      } catch (cause) {
        errorLog("Message handling failed", type, cause);
        sendResponse(buildErrorResponse(cause));
      }
    })();

    return true;
  }
);

chrome.alarms.onAlarm.addListener(async (alarm: { name: string }) => {
  if (alarm.name !== RETRY_ALARM_NAME) {
    return;
  }

  await updateState({ nextRetryAt: null });
  logEvent("retry:alarm");

  if (automationState.status !== "running") {
    return;
  }

  if (automationState.cursor >= automationState.queue.length) {
    await stopAutomationInternal({ reset: true, reason: null });
    return;
  }

  try {
    if (automationState.activeCount > 0) {
      await scheduleRetry();
      return;
    }

    const hasMore = await runNextGeneration();

    if (hasMore) {
      await scheduleRetry();
    }
  } catch (cause) {
    await updateState({
      lastError:
        cause instanceof Error
          ? cause.message
          : String(cause ?? "이미지 생성 요청에 실패했습니다."),
    });
    await scheduleRetry();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  log("Extension installed or updated");
  restoreState();
});

restoreState().catch((cause) => {
  errorLog("Initial state restore failed", cause);
});

export {};
