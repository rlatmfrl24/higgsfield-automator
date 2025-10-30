import { useCallback, useEffect, useMemo, useState } from "react";

import type { FormSnapshotPayload } from "@infrastructure/services/formSnapshot";

import type { FieldSelection } from "./target/formData";
import { deriveFormData } from "./target/formData";
import { MultiPromptTable } from "./target/MultiPromptTable";
import { createMultiPromptEntry } from "./target/multiPrompt";
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
    ratioValue,
    entries,
    selectOptions,
    setEntries,
    setRatioValue,
    addEntry,
    removeEntry,
    updateEntry,
    canAddMore,
  } = useMultiPromptState(ratioSelection);

  const [autoParserInput, setAutoParserInput] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [disallow169, setDisallow169] = useState(true);

  const fallbackRatio = useMemo(
    () =>
      selectOptions.find((option) => option.value === "4:3")?.value ??
      selectOptions.find((option) => option.value !== "16:9")?.value ??
      "4:3",
    [selectOptions]
  );

  const resolveRatio = useCallback(
    (rawRatio: string) => {
      const trimmed = rawRatio?.trim();

      if (!trimmed) {
        return (
          (disallow169 ? fallbackRatio : ratioValue) || fallbackRatio || ""
        );
      }

      let candidate = trimmed;

      if (disallow169 && candidate === "16:9") {
        candidate = fallbackRatio || "4:3";
      }

      const optionExists = selectOptions.some(
        (option) => option.value === candidate
      );

      if (!optionExists && selectOptions.length > 0) {
        if (disallow169) {
          return fallbackRatio;
        }

        return ratioValue || selectOptions[0].value;
      }

      return candidate;
    },
    [disallow169, fallbackRatio, ratioValue, selectOptions]
  );

  useEffect(() => {
    if (!disallow169) {
      return;
    }

    setEntries((prev) => {
      let mutated = false;

      const nextEntries = prev.map((entry) => {
        if (entry.ratio === "16:9") {
          mutated = true;
          return {
            ...entry,
            ratio: fallbackRatio,
          };
        }

        return entry;
      });

      return mutated ? nextEntries : prev;
    });

    if (ratioValue === "16:9" && ratioValue !== fallbackRatio) {
      setRatioValue(fallbackRatio);
    }
  }, [disallow169, fallbackRatio, ratioValue, setEntries, setRatioValue]);

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
      const nextRatio = resolveRatio(value);
      updateEntry(id, { ratio: nextRatio });
    },
    [resolveRatio, updateEntry]
  );

  const handleChangeCount = useCallback(
    (id: string, value: string) => {
      updateEntry(id, { count: value });
    },
    [updateEntry]
  );

  const handleParseAutoPrompts = useCallback(() => {
    setParseError(null);

    const matches = Array.from(
      autoParserInput.matchAll(/([^\n]*?)\s*--ar\s*([0-9]+:[0-9]+)/gi)
    );

    const parsedEntries = matches
      .map((match) => {
        const prompt = match[1]?.trim() ?? "";
        const ratio = match[2]?.trim() ?? "";

        if (!prompt || !ratio) {
          return null;
        }

        return {
          prompt,
          ratio: resolveRatio(ratio),
        };
      })
      .filter(
        (entry): entry is { prompt: string; ratio: string } => entry !== null
      );

    if (!parsedEntries.length) {
      setParseError("추출 가능한 --ar 비율을 찾을 수 없습니다.");
      return;
    }

    setEntries((prev) => {
      const appendEntries = parsedEntries.map(({ prompt, ratio }) => {
        const entry = createMultiPromptEntry(ratio);

        return {
          ...entry,
          prompt,
          ratio,
        };
      });

      return appendEntries.length ? [...prev, ...appendEntries] : prev;
    });

    setAutoParserInput("");
  }, [autoParserInput, resolveRatio, setEntries]);

  return (
    <div className="min-h-screen w-full bg-slate-50 px-4 py-8 text-slate-800 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 sm:gap-10 lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[96rem]">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-emerald-50 px-6 py-5 shadow lg:px-8 lg:py-6">
          <div className="space-y-1 lg:space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">
              Multi Prompt Planner
            </p>
            <h1 className="text-2xl font-bold text-emerald-700 sm:text-3xl">
              멀티 프롬프트 사전 설정
            </h1>
            <p className="text-sm text-emerald-600 sm:text-base">
              타겟 페이지에 접속하지 않아도 프롬프트와 매개변수를 미리 준비하고
              저장하세요.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 sm:px-5"
              onClick={onBack}
              type="button"
            >
              돌아가기
            </button>
            <button
              className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-600 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 sm:px-5"
              onClick={onNavigateToTarget}
              type="button"
            >
              타겟 페이지로 이동
            </button>
          </div>
        </header>

        <div className="space-y-6 sm:space-y-8">
          <section className="space-y-4 rounded-2xl border border-white bg-white px-6 py-5 shadow-lg shadow-slate-200/60 sm:px-8 sm:py-6 lg:px-10 lg:py-7">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <h2 className="text-lg font-semibold text-slate-800 sm:text-xl">
                Auto Parser
              </h2>
              <span className="text-xs text-slate-500 sm:text-sm">
                `--ar 0:00` 형식의 비율을 포함한 프롬프트를 붙여넣고 분석하세요.
              </span>
            </div>

            <textarea
              className="w-full min-h-[160px] resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="예) A cinematic portrait --ar 3:4"
              value={autoParserInput}
              onChange={(event) => {
                if (parseError) {
                  setParseError(null);
                }

                setAutoParserInput(event.target.value);
              }}
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-200"
                  onClick={handleParseAutoPrompts}
                  disabled={!autoParserInput.trim().length}
                >
                  Parse
                </button>
                <span className="text-xs text-slate-500 sm:text-sm">
                  추출된 프롬프트는 아래 목록에 자동으로 추가됩니다.
                </span>
              </div>

              {parseError ? (
                <p className="text-sm font-semibold text-rose-600">
                  {parseError}
                </p>
              ) : null}
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 shadow-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                checked={disallow169}
                onChange={(event) => setDisallow169(event.target.checked)}
              />
              <div className="flex flex-col">
                <span className="font-semibold">Not allow 16:9 ratio</span>
                <span className="text-xs text-slate-500">
                  활성화 시 16:9 비율은 자동으로 4:3 비율로 대체됩니다.
                </span>
              </div>
            </label>
          </section>

          <section className="space-y-5 rounded-2xl border border-white bg-white px-6 py-5 shadow-lg shadow-slate-200/60 sm:px-8 sm:py-6 lg:px-10 lg:py-7">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <h2 className="text-lg font-semibold text-slate-800 sm:text-xl">
                멀티 프롬프트 입력
              </h2>
              <span className="text-xs text-slate-500 sm:text-sm">
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
