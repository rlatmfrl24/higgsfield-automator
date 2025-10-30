import { useCallback, useMemo } from "react";

import type { FormSnapshotPayload } from "@infrastructure/services/formSnapshot";

import type { FieldSelection } from "./target/formData";
import { deriveFormData } from "./target/formData";
import { MultiPromptTable } from "./target/MultiPromptTable";
import { useMultiPromptState } from "./target/useMultiPromptState";

type MultiPromptSetupScreenProps = {
  onBack: () => void;
  onNavigateToTarget: () => void;
  formReadError: string | null;
  formPayload: FormSnapshotPayload | null;
};

const DEFAULT_RATIO_SELECTION: FieldSelection = {
  fieldIndex: -1,
  value: "1:1",
  label: "1:1",
  options: [
    { value: "1:1", label: "1:1" },
    { value: "3:4", label: "3:4" },
    { value: "4:3", label: "4:3" },
    { value: "9:16", label: "9:16" },
    { value: "16:9", label: "16:9" },
  ],
};

export const MultiPromptSetupScreen = ({
  onBack,
  onNavigateToTarget,
  formReadError,
  formPayload,
}: MultiPromptSetupScreenProps) => {
  const derived = useMemo(() => deriveFormData(formPayload), [formPayload]);
  const ratioSelection = derived?.ratio ?? DEFAULT_RATIO_SELECTION;

  const {
    entries,
    selectOptions,
    addEntry,
    removeEntry,
    updateEntry,
    canAddMore,
  } = useMultiPromptState(ratioSelection);

  const handleAddPrompt = useCallback(() => {
    addEntry();
  }, [addEntry]);

  const handleRemovePrompt = useCallback(
    (id: string) => {
      removeEntry(id);
    },
    [removeEntry]
  );

  const handleChangePrompt = useCallback(
    (id: string, value: string) => {
      updateEntry(id, { prompt: value });
    },
    [updateEntry]
  );

  const handleChangeRatio = useCallback(
    (id: string, value: string) => {
      updateEntry(id, { ratio: value });
    },
    [updateEntry]
  );

  const handleChangeCount = useCallback(
    (id: string, value: string) => {
      updateEntry(id, { count: value });
    },
    [updateEntry]
  );

  return (
    <div className="min-h-screen w-full bg-slate-50 px-4 py-8 text-slate-800 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-emerald-50 px-6 py-5 shadow">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">
              Multi Prompt Planner
            </p>
            <h1 className="text-2xl font-bold text-emerald-700">
              멀티 프롬프트 사전 설정
            </h1>
            <p className="text-sm text-emerald-600">
              타겟 페이지에 접속하지 않아도 프롬프트와 매개변수를 미리 준비하고
              저장하세요.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              onClick={onBack}
              type="button"
            >
              돌아가기
            </button>
            <button
              className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-600 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
              onClick={onNavigateToTarget}
              type="button"
            >
              타겟 페이지로 이동
            </button>
          </div>
        </header>

        <div className="space-y-6">
          <section className="space-y-5 rounded-2xl border border-white bg-white px-6 py-5 shadow-lg shadow-slate-200/60">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-800">
                멀티 프롬프트 입력
              </h2>
              <span className="text-xs text-slate-500">
                입력 내용은 자동으로 저장됩니다.
              </span>
            </div>

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

            {formReadError ? (
              <p className="text-sm font-semibold text-rose-600">
                {formReadError}
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
};

export default MultiPromptSetupScreen;
