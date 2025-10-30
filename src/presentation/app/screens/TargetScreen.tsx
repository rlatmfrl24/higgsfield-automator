import { useCallback, useMemo, useState, useEffect } from "react";

import type { FormSnapshotPayload } from "@infrastructure/services/formSnapshot";
import { updateActiveTabFieldValue } from "@infrastructure/services/formControl";
import { useLiveRegion } from "@presentation/hooks/useLiveRegion";
import { useAutomationState } from "@presentation/hooks/useAutomationState";
import {
  deriveFormData,
  extractHighlightFromText,
  isBasicQualitySelection,
} from "./target/formData";
import {
  buildSuccessAnnouncement,
  SUCCESS_PREPARATION_MESSAGE,
} from "./target/messages";
import { useMultiPromptState } from "./target/useMultiPromptState";
import {
  validateMultiPromptEntries,
  validatePreparation,
} from "./target/validation";
import { AutomationPanel } from "./target/AutomationPanel";
import { ControlPanel } from "./target/ControlPanel";
import {
  hasNonEmptyString,
  isPositiveIntegerString,
} from "./target/multiPrompt";

type TargetScreenProps = {
  isReadingForm: boolean;
  formReadError: string | null;
  formPayload: FormSnapshotPayload | null;
  onReadForm: () => void;
  onOpenStandaloneMultiPrompt?: () => void;
};

export const TargetScreen = ({
  isReadingForm,
  formReadError,
  formPayload,
  onReadForm,
  onOpenStandaloneMultiPrompt,
}: TargetScreenProps) => {
  const announce = useLiveRegion();
  const derived = useMemo(() => deriveFormData(formPayload), [formPayload]);

  const {
    setRatioValue,
    entries,
    setEntries,
  } = useMultiPromptState(derived?.ratio);

  const [isConfirming, setIsConfirming] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [preparationMessage, setPreparationMessage] = useState<string | null>(
    null
  );
  const [automationActionMessage, setAutomationActionMessage] = useState<
    string | null
  >(null);
  const [automationActionError, setAutomationActionError] = useState<
    string | null
  >(null);
  const [isAutomationActionProcessing, setIsAutomationActionProcessing] =
    useState(false);
  const {
    state: automationState,
    error: automationError,
    start: startAutomationLoop,
    pause: pauseAutomationLoop,
    resume: resumeAutomationLoop,
    stop: stopAutomationLoop,
    isLoading: isAutomationLoading,
    refresh: refreshAutomationState,
  } = useAutomationState();

  useEffect(() => {
    setAutomationActionMessage(null);
    setAutomationActionError(null);
  }, [
    automationState.status,
    automationState.processedCount,
    automationState.nextRetryAt,
  ]);

  const automationQueue = useMemo(() => {
    return entries
      .filter((entry) => hasNonEmptyString(entry.prompt))
      .flatMap((entry) => {
        const countValue = isPositiveIntegerString(entry.count)
          ? Number.parseInt(entry.count, 10)
          : 0;

        if (countValue <= 0) {
          return [];
        }

        return Array.from({ length: countValue }).map(() => ({
          prompt: entry.prompt.trim(),
          ratio: entry.ratio?.trim() || null,
        }));
      });
  }, [entries]);

  const buildAutomationPayload = useCallback(() => {
    return {
      queue: automationQueue,
      promptFieldIndex: derived?.prompt?.fieldIndex ?? -1,
      ratioFieldIndex: derived?.ratio?.fieldIndex ?? null,
    };
  }, [
    automationQueue,
    derived?.prompt?.fieldIndex,
    derived?.ratio?.fieldIndex,
  ]);

  const highlightInfo = useMemo(() => {
    if (!derived) {
      return null;
    }

    for (const text of derived.figures) {
      const result = extractHighlightFromText(text);
      if (result) {
        return result;
      }
    }

    return null;
  }, [derived]);

  const failPreparation = useCallback(
    (message: string) => {
      setGenerationError(message);
      setPreparationMessage(null);
      setIsConfirming(false);
      announce(message);
    },
    [announce]
  );

  const handleRequestGeneration = useCallback(async () => {
    setGenerationError(null);
    setPreparationMessage(null);
    setIsConfirming(false);

    const baseValidation = validatePreparation({ derived, entries });

    if (!baseValidation.ok) {
      failPreparation(baseValidation.message ?? "폼 검증에 실패했습니다.");
      return;
    }

    if (!derived?.quality || !isBasicQualitySelection(derived.quality)) {
      failPreparation("퀄리티 옵션이 Basic으로 설정되어야 합니다.");
      return;
    }

    const entryValidation = validateMultiPromptEntries(entries);

    if (!entryValidation.ok) {
      failPreparation(
        entryValidation.message ?? "멀티 프롬프트 검증에 실패했습니다."
      );
      return;
    }

    const [firstPrompt, ...rest] = entries;
    const { prompt, ratio } = derived;

    try {
      if (
        prompt &&
        typeof prompt.fieldIndex === "number" &&
        prompt.fieldIndex >= 0 &&
        hasNonEmptyString(firstPrompt.prompt)
      ) {
        await updateActiveTabFieldValue({
          fieldIndex: prompt.fieldIndex,
          value: firstPrompt.prompt,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "프롬프트 입력에 실패했습니다.";
      failPreparation(message);
      return;
    }

    try {
      if (
        ratio &&
        typeof ratio.fieldIndex === "number" &&
        ratio.fieldIndex >= 0 &&
        hasNonEmptyString(firstPrompt.ratio)
      ) {
        await updateActiveTabFieldValue({
          fieldIndex: ratio.fieldIndex,
          value: firstPrompt.ratio,
        });
        setRatioValue(firstPrompt.ratio);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "비율 입력에 실패했습니다.";
      failPreparation(message);
      return;
    }

    if (!derived?.prompt?.value || !hasNonEmptyString(derived.prompt.value)) {
      setEntries((prev) => {
        const normalised = prev.map((entry, index) =>
          index === 0
            ? {
                ...entry,
                prompt: entry.prompt || firstPrompt.prompt,
                ratio: entry.ratio || firstPrompt.ratio,
              }
            : entry
        );

        return normalised;
      });
    } else {
      setEntries([firstPrompt, ...rest]);
    }

    setPreparationMessage(SUCCESS_PREPARATION_MESSAGE);
    announce(buildSuccessAnnouncement(highlightInfo));
    setIsConfirming(true);
  }, [
    announce,
    derived,
    entries,
    failPreparation,
    highlightInfo,
    setEntries,
    setRatioValue,
  ]);

  const runAutomationAction = useCallback(
    async (action: () => Promise<void>, successMessage: string) => {
      try {
        setIsAutomationActionProcessing(true);
        setAutomationActionError(null);
        await action();
        setAutomationActionMessage(successMessage);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "요청을 처리하는 중 오류가 발생했습니다.";
        setAutomationActionError(message);
      } finally {
        setIsAutomationActionProcessing(false);
      }
    },
    []
  );

  const handleResumeAutomation = useCallback(() => {
    return runAutomationAction(
      resumeAutomationLoop,
      "자동 생성 루프를 재개했습니다."
    );
  }, [resumeAutomationLoop, runAutomationAction]);

  const handlePauseAutomation = useCallback(() => {
    return runAutomationAction(
      pauseAutomationLoop,
      "자동 생성 루프를 일시중단했습니다."
    );
  }, [pauseAutomationLoop, runAutomationAction]);

  const handleStopAutomation = useCallback(() => {
    return runAutomationAction(
      stopAutomationLoop,
      "자동 생성 루프를 종료했습니다."
    );
  }, [runAutomationAction, stopAutomationLoop]);

  const handleCancelGeneration = useCallback(() => {
    setIsConfirming(false);
  }, []);

  const handleConfirmGeneration = useCallback(async () => {
    try {
      const payload = buildAutomationPayload();

      if (!payload.queue.length) {
        throw new Error("자동화할 프롬프트가 없습니다.");
      }

      setIsConfirming(false);
      await startAutomationLoop(payload);
      setPreparationMessage(
        `자동 생성 루프를 시작했습니다. 총 ${payload.queue.length}회의 생성이 예약되었습니다.`
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "자동화 시작 중 오류가 발생했습니다.";
      failPreparation(message);
    }
  }, [buildAutomationPayload, failPreparation, startAutomationLoop]);

  const formatTimeLabel = useCallback((timestamp: number | null) => {
    if (!timestamp) {
      return "-";
    }

    try {
      return new Date(timestamp).toLocaleTimeString();
    } catch (error) {
      console.warn("Failed to format time", error);
      return "-";
    }
  }, []);

  const automationStatusMeta = useMemo(() => {
    const status = automationState.status;
    const statusMap: Record<
      typeof status,
      {
        label: string;
        description: string;
        badgeClass: string;
        dotClass: string;
      }
    > = {
      running: {
        label: "진행 중",
        description: "자동 생성 루프가 실행되고 있습니다.",
        badgeClass: "bg-emerald-100 text-emerald-700",
        dotClass: "bg-emerald-500",
      },
      paused: {
        label: "일시중단",
        description: "자동 생성 루프가 일시중단 상태입니다.",
        badgeClass: "bg-amber-100 text-amber-700",
        dotClass: "bg-amber-500",
      },
      idle: {
        label: "대기 중",
        description: "자동화를 시작하면 상태가 갱신됩니다.",
        badgeClass: "bg-slate-200 text-slate-700",
        dotClass: "bg-slate-500",
      },
    };

    const meta = statusMap[status];
    const totalCount = automationState.maxCount || automationQueue.length;
    const processedCount = automationState.processedCount;
    const progressPercent = totalCount
      ? Math.min(100, Math.round((processedCount / totalCount) * 100))
      : 0;

    const stateQueue = automationState.queue ?? [];
    const hasStateQueue = stateQueue.length > 0;
    const stateCurrentPrompt =
      hasStateQueue &&
      automationState.cursor >= 0 &&
      automationState.cursor < stateQueue.length
        ? stateQueue[automationState.cursor]?.prompt ?? null
        : null;
    const stateNextPrompt =
      hasStateQueue && automationState.cursor + 1 < stateQueue.length
        ? stateQueue[automationState.cursor + 1]?.prompt ?? null
        : null;

    const plannedCurrentPrompt = automationQueue[0]?.prompt ?? null;
    const plannedNextPrompt =
      automationQueue.length > 1 ? automationQueue[1]?.prompt ?? null : null;

    const currentPrompt =
      status === "idle"
        ? plannedCurrentPrompt
        : stateCurrentPrompt ?? plannedCurrentPrompt;
    const nextPrompt =
      status === "idle"
        ? plannedNextPrompt
        : stateNextPrompt ?? plannedNextPrompt;

    return {
      ...meta,
      totalCount,
      processedCount,
      progressPercent,
      currentPrompt,
      nextPrompt,
      nextRetryAt: formatTimeLabel(automationState.nextRetryAt),
      status,
      maxCount: automationState.maxCount,
    };
  }, [
    automationQueue,
    automationState.cursor,
    automationState.maxCount,
    automationState.nextRetryAt,
    automationState.processedCount,
    automationState.queue,
    automationState.status,
    formatTimeLabel,
  ]);

  const automationRemainingCount = Math.max(
    (automationStatusMeta.maxCount ?? automationQueue.length) -
      automationStatusMeta.processedCount,
    0
  );

  const handleRefreshAutomation = useCallback(() => {
    void refreshAutomationState();
  }, [refreshAutomationState]);

  const isAutomationRunning = automationState.status === "running";

  const baseButtonClasses =
    "inline-flex items-center justify-center rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60";
  const primaryButtonClasses = `${baseButtonClasses} bg-gradient-to-r from-emerald-400 to-emerald-500 text-white shadow-lg shadow-emerald-200/60 hover:from-emerald-500 hover:to-emerald-600 active:from-emerald-600 active:to-emerald-600`;
  const secondaryButtonClasses = `${baseButtonClasses} border border-emerald-200 bg-white text-emerald-600 shadow-sm shadow-emerald-100/60 hover:bg-emerald-50 active:bg-emerald-100`;
  const controlSectionHeadingId = "target-screen-section-control-heading";
  const generationPanelId = "target-screen-panel-generation";
  const automationPanelId = "target-screen-panel-automation";

  return (
    <div className="flex min-h-screen w-full justify-center bg-slate-50 px-4 py-10 text-slate-800 sm:px-6">
      <div className="flex w-full max-w-6xl flex-col gap-8">
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-emerald-50 px-8 py-6 text-center shadow-md">
          <h1 className="text-3xl font-bold text-emerald-700">
            타겟 페이지에 도달했습니다!
          </h1>
          <p className="mt-2 text-sm text-emerald-600">
            현재 Higgsfield Soul 페이지에 있으므로 익스텐션 기능을 곧바로 실행할
            수 있습니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            className={`${primaryButtonClasses} px-6 py-3 text-base`}
            onClick={onReadForm}
            disabled={isReadingForm}
            type="button"
          >
            {isReadingForm ? "폼 데이터 읽는 중..." : "폼 데이터 화면 출력"}
          </button>
          <button
            className={`${secondaryButtonClasses} px-5 py-3 text-sm`}
            onClick={handleRefreshAutomation}
            disabled={isAutomationLoading}
            type="button"
          >
            {isAutomationLoading
              ? "자동화 상태 동기화 중..."
              : "자동화 상태 새로고침"}
          </button>
          {onOpenStandaloneMultiPrompt ? (
            <button
              className={`${secondaryButtonClasses} px-5 py-3 text-sm`}
              onClick={onOpenStandaloneMultiPrompt}
              type="button"
            >
              멀티 프롬프트 독립 화면
            </button>
          ) : null}
        </div>

        {formReadError ? (
          <p className="text-sm font-semibold text-rose-600">{formReadError}</p>
        ) : null}

        <div className="w-full">
          <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60">
            <div className="border-b border-slate-200 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 px-6 py-5">
              <h2
                id={controlSectionHeadingId}
                className="text-lg font-semibold text-emerald-700"
              >
                폼 제어 패널
              </h2>
              <p className="mt-1 text-sm text-emerald-600">
                자동 생성 요청과 멀티 프롬프트 요약 정보를 확인하세요.
              </p>
              {!derived ? (
                <p className="mt-2 text-xs text-emerald-600">
                  아직 폼 데이터를 읽지 않았습니다. 필요한 경우 언제든지
                  "폼 데이터 화면 출력" 버튼으로 동기화할 수 있습니다.
                </p>
              ) : null}
            </div>

            <ControlPanel
              panelId={generationPanelId}
              labelledById={controlSectionHeadingId}
              highlightInfo={highlightInfo}
              onPrepareGeneration={handleRequestGeneration}
              preparationMessage={preparationMessage}
              isConfirming={isConfirming}
              onConfirmGeneration={handleConfirmGeneration}
              onCancelGeneration={handleCancelGeneration}
              generationError={generationError}
            />

            <AutomationPanel
              panelId={automationPanelId}
              labelledById={controlSectionHeadingId}
              figures={derived?.figures ?? []}
              datasetValues={derived?.datasetValues ?? {}}
              isAutomationRunning={isAutomationRunning}
              entries={entries}
              automationQueueLength={automationQueue.length}
              automationActiveCount={automationState.activeCount}
              automationRemainingCount={automationRemainingCount}
              automationLastError={automationState.lastError ?? null}
              automationStatusMeta={automationStatusMeta}
              automationActionMessage={automationActionMessage}
              automationActionError={automationActionError}
              automationError={automationError}
              isAutomationActionProcessing={isAutomationActionProcessing}
              onResumeAutomation={handleResumeAutomation}
              onPauseAutomation={handlePauseAutomation}
              onStopAutomation={handleStopAutomation}
              isFormDataReady={Boolean(derived)}
              onOpenStandalone={onOpenStandaloneMultiPrompt}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TargetScreen;
