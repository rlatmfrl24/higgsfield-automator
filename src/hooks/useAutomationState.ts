import { useCallback, useEffect, useMemo, useState } from "react";

type AutomationStatus = "idle" | "running" | "paused";

type AutomationQueueEntry = {
  prompt: string;
  ratio: string | null;
};

type AutomationState = {
  status: AutomationStatus;
  processedCount: number;
  maxCount: number;
  activeCount: number;
  nextRetryAt: number | null;
  lastError: string | null;
  queue: AutomationQueueEntry[];
  cursor: number;
};

type FetchStateResult = {
  success: boolean;
  state: AutomationState;
  error?: string;
};

type UseAutomationStateResult = {
  state: AutomationState;
  isLoading: boolean;
  error: string | null;
  start: (payload: {
    queue: Array<{ prompt: string; ratio: string | null }>;
    promptFieldIndex: number;
    ratioFieldIndex: number | null;
  }) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  refresh: () => Promise<void>;
};

const INITIAL_STATE: AutomationState = {
  status: "idle",
  processedCount: 0,
  maxCount: 0,
  activeCount: 0,
  nextRetryAt: null,
  lastError: null,
  queue: [],
  cursor: 0,
};

type BackgroundMessagePayload = {
  type?: string;
  payload?: AutomationState;
};

const callBackground = async (
  type: string,
  payload?: Record<string, unknown>
): Promise<FetchStateResult> => {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        type,
        payload,
      },
      (response: FetchStateResult | undefined) => {
        const lastError = chrome.runtime.lastError;

        if (lastError) {
          resolve({
            success: false,
            error: lastError.message ?? "메시지 전송에 실패했습니다.",
            state: INITIAL_STATE,
          });
          return;
        }

        if (!response) {
          resolve({
            success: false,
            error: "배경 스크립트 응답이 없습니다.",
            state: INITIAL_STATE,
          });
          return;
        }

        resolve(response);
      }
    );
  });
};

export const useAutomationState = (): UseAutomationStateResult => {
  const [state, setState] = useState<AutomationState>(INITIAL_STATE);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const applyResult = useCallback((result: FetchStateResult) => {
    if (!result.success) {
      setError(result.error ?? "자동화 상태 갱신에 실패했습니다.");
      setState(INITIAL_STATE);
    } else {
      setError(result.state.lastError ?? null);
      setState(result.state ?? INITIAL_STATE);
    }

    setIsLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const result = await callBackground("automation:getState");
    applyResult(result);
  }, [applyResult]);

  const start = useCallback(
    async (payload: {
      queue: Array<{ prompt: string; ratio: string | null }>;
      promptFieldIndex: number;
      ratioFieldIndex: number | null;
    }) => {
      setIsLoading(true);
      const result = await callBackground("automation:start", payload);
      applyResult(result);
    },
    [applyResult]
  );

  const pause = useCallback(async () => {
    setIsLoading(true);
    const result = await callBackground("automation:pause");
    applyResult(result);
  }, [applyResult]);

  const resume = useCallback(async () => {
    setIsLoading(true);
    const result = await callBackground("automation:resume");
    applyResult(result);
  }, [applyResult]);

  const stop = useCallback(async () => {
    setIsLoading(true);
    const result = await callBackground("automation:stop");
    applyResult(result);
  }, [applyResult]);

  useEffect(() => {
    refresh().catch(() => {
      setIsLoading(false);
      setError("자동화 상태를 불러오지 못했습니다.");
    });

    const listener = (message: BackgroundMessagePayload) => {
      if (message?.type === "automation:state" && message.payload) {
        setState(message.payload);
        setError(message.payload.lastError ?? null);
      }
    };

    chrome.runtime.onMessage.addListener(listener);

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [refresh]);

  const derivedError = useMemo(
    () => error ?? state.lastError ?? null,
    [error, state.lastError]
  );

  return {
    state,
    isLoading,
    error: derivedError,
    start,
    pause,
    resume,
    stop,
    refresh,
  };
};

export type { AutomationState, AutomationStatus, AutomationQueueEntry };
