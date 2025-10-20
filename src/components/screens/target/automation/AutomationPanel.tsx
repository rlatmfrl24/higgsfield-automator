import { useCallback, useEffect, useState } from "react";

import type { AutomationState } from "../../../../hooks/useAutomationState";

type AutomationPanelProps = {
  state: AutomationState;
  errorMessage: string | null;
  plannedCount: number;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  onStop: () => Promise<void>;
};

const formatTime = (timestamp: number | null) => {
  if (!timestamp) {
    return "-";
  }

  try {
    return new Date(timestamp).toLocaleTimeString();
  } catch (
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _error
  ) {
    return "-";
  }
};

export const AutomationPanel = ({
  state,
  errorMessage,
  plannedCount,
  onPause,
  onResume,
  onStop,
}: AutomationPanelProps) => {
  const isRunning = state.status === "running";
  const isPaused = state.status === "paused";
  const isIdle = state.status === "idle";

  const remainingCount = Math.max(state.maxCount - state.processedCount, 0);

  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setLocalMessage(null);
    setLocalError(null);
  }, [state.status, state.processedCount, state.nextRetryAt]);

  const runAction = useCallback(
    async (action: () => Promise<void>, successMessage: string) => {
      try {
        setIsProcessing(true);
        setLocalError(null);
        await action();
        setLocalMessage(successMessage);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "요청을 처리하는 중 오류가 발생했습니다.";
        setLocalError(message);
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  const handleResume = useCallback(() => {
    return runAction(onResume, "자동 생성 루프를 재개했습니다.");
  }, [onResume, runAction]);

  const handlePause = useCallback(() => {
    return runAction(onPause, "자동 생성 루프를 일시중단했습니다.");
  }, [onPause, runAction]);

  const handleStop = useCallback(() => {
    return runAction(onStop, "자동 생성 루프를 종료했습니다.");
  }, [onStop, runAction]);

  return (
    <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-blue-800">자동 생성 루프</p>
          <p className="text-xs text-blue-700">
            멀티 프롬프트에 입력된 {plannedCount}개의 생성 요청을 순차적으로
            실행합니다.
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-blue-700">
            <span title="현재 자동화 상태">상태: {state.status}</span>
            <span title="현재까지 성공적으로 요청한 이미지 생성 횟수">
              진행: {state.processedCount}/{state.maxCount}
            </span>
            <span title="피드 내에서 감지된 생성 진행 카드 수">
              대기 중 아이템: {state.activeCount}
            </span>
          </div>
          <p className="text-xs text-blue-700" title="다음 재시도 예정 시각">
            다음 재시도 예정 시각: {formatTime(state.nextRetryAt)}
          </p>
          <p className="text-xs text-blue-700" title="남은 프롬프트 수">
            남은 프롬프트: {remainingCount}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-right text-xs text-blue-700">
          <span title="오류 메시지">
            마지막 오류: {state.lastError ? state.lastError : "-"}
          </span>
          <span title="자동화 큐에 남아있는 프롬프트 미리보기">
            다음 프롬프트:
            {state.queue?.[state.cursor]?.prompt
              ? ` ${state.queue[state.cursor].prompt.slice(0, 20)}...`
              : " -"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="rounded border border-blue-400 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:bg-blue-100"
          onClick={handleResume}
          disabled={!isPaused || isProcessing}
          type="button"
        >
          재개
        </button>
        <button
          className="rounded border border-blue-400 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:bg-blue-100"
          onClick={handlePause}
          disabled={!isRunning || isProcessing}
          type="button"
        >
          일시중단
        </button>
        <button
          className="rounded border border-blue-400 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:bg-blue-100"
          onClick={handleStop}
          disabled={isIdle || isProcessing}
          type="button"
        >
          중단
        </button>
      </div>

      {localMessage ? (
        <p className="text-xs text-blue-700">{localMessage}</p>
      ) : null}

      {localError ? (
        <p className="text-xs text-red-600">{localError}</p>
      ) : errorMessage ? (
        <p className="text-xs text-red-600">{errorMessage}</p>
      ) : null}
    </div>
  );
};
