import { useCallback, useMemo, useState, useEffect } from "react";

import type { FormSnapshotPayload } from "../../services/formSnapshot";
import { updateActiveTabFieldValue } from "../../services/formControl";
import { useLiveRegion } from "../../hooks/useLiveRegion";
import { HighlightBadges } from "./target/HighlightBadges";
import { GenerationPanel } from "./target/GenerationPanel";
import { AutomationPanel } from "./target/automation/AutomationPanel";
import { useAutomationState } from "../../hooks/useAutomationState";
import {
  deriveFormData,
  extractHighlightFromText,
  isBasicQualitySelection,
} from "./target/formData";
import {
  buildSuccessAnnouncement,
  SUCCESS_PREPARATION_MESSAGE,
} from "./target/messages";
import {
  createMultiPromptEntry,
  hasNonEmptyString,
  isPositiveIntegerString,
} from "./target/multiPrompt";
import { MultiPromptTable } from "./target/MultiPromptTable";
import { useMultiPromptState } from "./target/useMultiPromptState";
import {
  validateMultiPromptEntries,
  validatePreparation,
} from "./target/validation";

type TargetScreenProps = {
  isReadingForm: boolean;
  formReadError: string | null;
  formPayload: FormSnapshotPayload | null;
  onReadForm: () => void;
};

export const TargetScreen = ({
  isReadingForm,
  formReadError,
  formPayload,
  onReadForm,
}: TargetScreenProps) => {
  const announce = useLiveRegion();
  const derived = useMemo(() => deriveFormData(formPayload), [formPayload]);

  const {
    setRatioValue,
    entries,
    setEntries,
    selectOptions,
    addEntry,
    removeEntry,
    updateEntry,
    canAddMore,
  } = useMultiPromptState(derived?.ratio);

  useEffect(() => {
    if (!derived) {
      return;
    }

    if (entries.length === 0) {
      const initialCount = Math.max(2, entries.length);
      const nextEntries = Array.from({ length: initialCount }).map(() =>
        createMultiPromptEntry(derived.ratio?.value ?? "")
      );
      setEntries(nextEntries);
    }
  }, [derived, entries.length, setEntries]);

  const [isConfirming, setIsConfirming] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [preparationMessage, setPreparationMessage] = useState<string | null>(
    null
  );

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

  const resetMessages = useCallback(() => {
    setPreparationMessage(null);
    setGenerationError(null);
    setIsConfirming(false);
  }, []);

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

  const handleAddPrompt = useCallback(() => {
    resetMessages();
    addEntry();
  }, [addEntry, resetMessages]);

  const handleRemovePrompt = useCallback(
    (id: string) => {
      resetMessages();
      removeEntry(id);
    },
    [removeEntry, resetMessages]
  );

  const handleChangePrompt = useCallback(
    (id: string, value: string) => {
      resetMessages();
      updateEntry(id, { prompt: value });
    },
    [resetMessages, updateEntry]
  );

  const handleChangeRatio = useCallback(
    (id: string, value: string) => {
      resetMessages();
      updateEntry(id, { ratio: value });
    },
    [resetMessages, updateEntry]
  );

  const handleChangeCount = useCallback(
    (id: string, value: string) => {
      resetMessages();
      updateEntry(id, { count: value });
    },
    [resetMessages, updateEntry]
  );

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

  const handleRefreshAutomation = useCallback(() => {
    void refreshAutomationState();
  }, [refreshAutomationState]);

  const isAutomationRunning = automationState.status === "running";

  return (
    <div className="flex flex-col items-center gap-6 min-h-screen w-full bg-slate-50 text-slate-800 px-4 py-10 sm:px-6">
      <div className="rounded-xl border border-green-200 bg-green-50 px-6 py-4 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-green-700">
          타겟 페이지에 도달했습니다!
        </h1>
        <p className="mt-2 text-sm text-green-600">
          현재 Higgsfield Soul 페이지에 있으므로 익스텐션 기능을 사용할 수
          있습니다.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          className="rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold px-6 py-3 transition-colors disabled:bg-emerald-300"
          onClick={onReadForm}
          disabled={isReadingForm}
          type="button"
        >
          {isReadingForm ? "폼 데이터 읽는 중..." : "폼 데이터 화면 출력"}
        </button>
        <button
          className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:border-slate-200 disabled:text-slate-400"
          onClick={handleRefreshAutomation}
          disabled={isAutomationLoading}
          type="button"
        >
          {isAutomationLoading
            ? "자동화 상태 동기화 중..."
            : "자동화 상태 새로고침"}
        </button>
      </div>

      {formReadError ? (
        <p className="text-sm text-red-600">{formReadError}</p>
      ) : null}

      {derived ? (
        <div className="w-full mt-2">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm max-w-6xl mx-auto w-full">
            <div className="border-b border-slate-200 bg-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-700 flex items-center justify-between">
              <span>폼 제어 패널</span>
            </div>

            <div className="p-6 space-y-8" aria-live="polite">
              <div className="grid gap-6 xl:grid-cols-[2fr_1fr] xl:items-start">
                <section className="space-y-6">
                  <HighlightBadges
                    figures={derived.figures}
                    datasetValues={derived.datasetValues}
                  />

                  {isAutomationRunning ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-100 px-4 py-6 text-center text-sm text-slate-600">
                      자동 생성 루프가 실행 중입니다. 자동화가 종료되면 멀티
                      프롬프트 입력 폼이 다시 표시됩니다.
                    </div>
                  ) : (
                    <MultiPromptTable
                      entries={entries}
                      selectOptions={selectOptions}
                      onChangePrompt={handleChangePrompt}
                      onChangeRatio={handleChangeRatio}
                      onChangeCount={handleChangeCount}
                      onRemove={handleRemovePrompt}
                      onAdd={handleAddPrompt}
                      disabledAdd={!canAddMore}
                    />
                  )}
                </section>

                <aside className="space-y-6">
                  <section className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-6 shadow-sm">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                        현재 진행 중
                      </p>
                      <p className="text-lg font-semibold text-emerald-900 break-words">
                        {automationStatusMeta.currentPrompt ?? "-"}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                        다음 예정
                      </p>
                      <p className="text-base font-semibold text-emerald-800 break-words">
                        {automationStatusMeta.nextPrompt ?? "-"}
                      </p>
                    </div>
                  </section>

                  <section className="space-y-4 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-800">
                          자동화 개요
                        </p>
                        <p className="text-xs text-slate-500">
                          {automationStatusMeta.description}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${automationStatusMeta.badgeClass}`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${automationStatusMeta.dotClass}`}
                          aria-hidden="true"
                        />
                        {automationStatusMeta.label}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-700">
                          예약된 생성
                        </span>
                        <span>{automationQueue.length}개</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-700">
                          진행 상황
                        </span>
                        <span>
                          {automationStatusMeta.processedCount}/
                          {automationStatusMeta.totalCount}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-700">
                          대기 중 아이템
                        </span>
                        <span>{automationState.activeCount}개</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-700">
                          다음 재시도 시각
                        </span>
                        <span>{automationStatusMeta.nextRetryAt}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-700">
                          다음 프롬프트
                        </span>
                        <span className="max-w-[12rem] truncate text-right">
                          {automationStatusMeta.nextPrompt ?? "-"}
                        </span>
                      </div>
                    </div>

                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{
                          width: `${automationStatusMeta.progressPercent}%`,
                        }}
                        aria-hidden="true"
                      />
                    </div>

                    {automationError ? (
                      <p className="text-xs text-red-600">{automationError}</p>
                    ) : null}
                  </section>

                  <GenerationPanel
                    onPrepare={handleRequestGeneration}
                    highlightInfo={highlightInfo}
                    preparationMessage={preparationMessage}
                    isConfirming={isConfirming}
                    onConfirm={handleConfirmGeneration}
                    onCancel={handleCancelGeneration}
                    errorMessage={generationError}
                  />

                  <AutomationPanel
                    state={automationState}
                    errorMessage={automationError}
                    onPause={pauseAutomationLoop}
                    onResume={resumeAutomationLoop}
                    onStop={stopAutomationLoop}
                    plannedCount={automationQueue.length}
                  />
                </aside>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default TargetScreen;
