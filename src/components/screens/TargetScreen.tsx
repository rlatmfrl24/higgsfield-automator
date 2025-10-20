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

  return (
    <div className="flex flex-col items-center gap-6 min-h-screen w-full bg-slate-50 text-slate-800 px-6 py-12">
      <div className="rounded-xl border border-green-200 bg-green-50 px-6 py-4 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-green-700">
          타겟 페이지에 도달했습니다!
        </h1>
        <p className="mt-2 text-sm text-green-600">
          현재 Higgsfield Soul 페이지에 있으므로 익스텐션 기능을 사용할 수
          있습니다.
        </p>
      </div>

      <button
        className="rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold px-6 py-3 transition-colors disabled:bg-emerald-300"
        onClick={onReadForm}
        disabled={isReadingForm}
      >
        {isReadingForm ? "폼 데이터 읽는 중..." : "폼 데이터 화면 출력"}
      </button>

      {formReadError ? (
        <p className="text-sm text-red-600">{formReadError}</p>
      ) : null}

      {derived ? (
        <div className="w-full mt-2">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm max-w-6xl mx-auto w-full">
            <div className="border-b border-slate-200 bg-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-700 flex items-center justify-between">
              <span>폼 제어 패널</span>
            </div>

            <div className="p-6 space-y-6" aria-live="polite">
              <HighlightBadges
                figures={derived.figures}
                datasetValues={derived.datasetValues}
              />

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

              <details className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                <summary className="cursor-pointer select-none text-sm font-semibold text-slate-700">
                  원본 폼 데이터
                </summary>
                <div className="mt-3 space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      values
                    </h3>
                    <pre className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded bg-slate-900 px-3 py-2 font-mono text-[11px] text-slate-100">
                      {JSON.stringify(formPayload?.values ?? {}, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      fields
                    </h3>
                    <pre className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded bg-slate-900 px-3 py-2 font-mono text-[11px] text-slate-100">
                      {JSON.stringify(formPayload?.fields ?? [], null, 2)}
                    </pre>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default TargetScreen;
