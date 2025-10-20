const TARGET_ORIGIN = "https://higgsfield.ai";
const TARGET_PATH = "/image/soul";
const TARGET_URL = `${TARGET_ORIGIN}${TARGET_PATH}`;
const FORM_SELECTOR = "#main > div > form";
const GENERATION_BUTTON_KEY_PHRASE = "Daily free credits left";
const RETRY_ALARM_NAME = "automation:retry";
const RETRY_DELAY_MS = 3000;

const DEFAULT_STATE = {
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

let automationState = { ...DEFAULT_STATE };

const withDefaultState = (state) => ({
  ...DEFAULT_STATE,
  ...(state ?? {}),
  queue: Array.isArray(state?.queue) ? state.queue : [],
  cursor: typeof state?.cursor === "number" ? state.cursor : 0,
  promptFieldIndex:
    typeof state?.promptFieldIndex === "number" ? state.promptFieldIndex : null,
  ratioFieldIndex:
    typeof state?.ratioFieldIndex === "number" ? state.ratioFieldIndex : null,
});

const toPublicState = (state) => ({
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

const log = (...args) => {
  console.info("[HiggsfieldAutomator]", ...args);
};

const warn = (...args) => {
  console.warn("[HiggsfieldAutomator]", ...args);
};

const errorLog = (...args) => {
  console.error("[HiggsfieldAutomator]", ...args);
};

const logEvent = (event, detail = {}) => {
  log(`event=${event}`, detail);
};

async function persistState(nextState) {
  await chrome.storage.local.set({ automationState: nextState });
}

function broadcastState(state = automationState) {
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

async function updateState(partial) {
  automationState = withDefaultState({
    ...automationState,
    ...(partial ?? {}),
  });
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

function matchesTarget(url) {
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

function clickGenerationButton(keyPhrase) {
  const normalise = (value) => value?.replace(/\s+/g, " ").trim().toLowerCase();

  const equalsTarget = (value) => {
    if (!value) {
      return false;
    }

    return normalise(value)?.includes(keyPhrase.toLowerCase()) ?? false;
  };

  const candidates = Array.from(
    document.querySelectorAll("button, [role='button']")
  ).filter((element) => element instanceof HTMLElement);

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
        .filter((label) => label instanceof HTMLElement);

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
    };
  }

  targetButton.click();

  return { success: true };
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
        };
      }

      const normalise = (value) =>
        value?.replace(/\s+/g, " ").trim().toLowerCase();

      const equalsTarget = (value) => {
        if (!value) {
          return false;
        }

        return normalise(value)?.includes(
          "daily free credits left".toLowerCase()
        );
      };

      const candidates = Array.from(
        document.querySelectorAll("button, [role='button']")
      ).filter((element) => element instanceof HTMLElement);

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
            .filter((label) => label instanceof HTMLElement);

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
        };
      }

      targetButton.click();

      return {
        success: true,
        feedHasUpsell: false,
      };
    },
  });

  const response = result?.result;

  if (!response?.success) {
    throw new Error(
      response?.error ?? "이미지 생성 버튼을 클릭하지 못했습니다."
    );
  }
}

function sanitizeQueue(queue) {
  if (!Array.isArray(queue)) {
    return [];
  }

  return queue
    .map((entry) => {
      const prompt =
        typeof entry?.prompt === "string" ? entry.prompt.trim() : "";
      const ratio = typeof entry?.ratio === "string" ? entry.ratio.trim() : "";

      if (!prompt) {
        return null;
      }

      return {
        prompt,
        ratio: ratio || null,
      };
    })
    .filter((entry) => entry !== null);
}

function applyFieldsInPage(
  selector,
  promptIndex,
  promptValue,
  ratioIndex,
  ratioValue
) {
  const setNativeValue = (element, value) => {
    const ownDescriptor = Object.getOwnPropertyDescriptor(element, "value");

    if (ownDescriptor?.set) {
      ownDescriptor.set.call(element, value);
      return;
    }

    let prototype = Object.getPrototypeOf(element);

    while (prototype) {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

      if (descriptor?.set) {
        descriptor.set.call(element, value);
        return;
      }

      prototype = Object.getPrototypeOf(prototype);
    }

    element.value = value;
  };

  const applyValue = (fieldIndex, value) => {
    if (typeof fieldIndex !== "number" || fieldIndex < 0) {
      return { success: true };
    }

    const form = document.querySelector(selector);

    if (!(form instanceof HTMLFormElement)) {
      return { success: false, error: "폼을 찾을 수 없습니다." };
    }

    const fields = form.querySelectorAll("input, textarea, select");
    const element = fields.item(fieldIndex);

    if (!(element instanceof HTMLElement)) {
      return { success: false, error: "대상 필드를 찾을 수 없습니다." };
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
      return { success: false, error: "지원하지 않는 필드 타입입니다." };
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

    return { success: true };
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

  return { success: true };
}

async function applyEntryToForm(entry) {
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

  const response = result?.result;

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

async function stopAutomationInternal({ reset = true, reason = null } = {}) {
  await clearRetryAlarm();
  logEvent("automation:stop", { reset, reason });

  const nextState = {
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

async function handleFeedActiveCount(activeCount, signatures = []) {
  const clamped =
    Number.isFinite(activeCount) && activeCount > 0
      ? Math.floor(activeCount)
      : 0;
  await updateState({ activeCount: clamped, activeSignatures: signatures });
  logEvent("feed:update", { activeCount: clamped, signatures });

  if (automationState.status === "paused") {
    await clearRetryAlarm();
    return automationState;
  }

  if (automationState.status !== "running") {
    return automationState;
  }

  if (automationState.cursor >= automationState.queue.length) {
    await stopAutomationInternal({ reset: true, reason: null });
    return automationState;
  }

  return automationState;
}

async function runNextGeneration() {
  if (automationState.activeCount > 0) {
    logEvent("queue:blocked", {
      reason: "active_cards",
      activeCount: automationState.activeCount,
      signatures: automationState.activeSignatures,
    });
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
}

async function startAutomation({
  queue,
  promptFieldIndex,
  ratioFieldIndex,
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

function buildSuccessResponse(state) {
  return {
    success: true,
    state: toPublicState(state),
  };
}

function buildErrorResponse(cause) {
  const message =
    cause instanceof Error
      ? cause.message
      : String(cause ?? "알 수 없는 오류가 발생했습니다.");
  return {
    success: false,
    error: message,
    state: toPublicState(automationState),
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message ?? {};

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
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
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
