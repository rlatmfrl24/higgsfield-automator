import { useCallback, useEffect, useMemo, useState } from "react";

import type { FormSnapshotPayload } from "../../services/formSnapshot";
import { GENERATION_BUTTON_KEY_PHRASE } from "../../services/generation";
import { updateActiveTabFieldValue } from "../../services/formControl";
import { useLiveRegion } from "../../hooks/useLiveRegion";

type TargetScreenProps = {
  isReadingForm: boolean;
  formReadError: string | null;
  formPayload: FormSnapshotPayload | null;
  onReadForm: () => void;
};

type FieldSelection = {
  fieldIndex: number;
  value: string;
  label?: string;
  options?: Array<{ value: string; label: string }>;
};

type DerivedFormData = {
  prompt?: FieldSelection;
  ratio?: FieldSelection;
  quality?: FieldSelection;
  figures: string[];
  datasetValues: Record<string, string>;
};

type MultiPromptEntry = {
  id: string;
  prompt: string;
  ratio: string;
  count: string;
};

const HIGHLIGHT_PATTERN = /Generate(\d+)\s*Daily free credits left/i;

const extractHighlightFromText = (text: string) => {
  const match = text.match(HIGHLIGHT_PATTERN);

  if (!match) {
    return null;
  }

  const amount = match[1];

  return {
    amount,
    display: `남은 크레딧: ${amount}`,
    raw: text,
  } as const;
};

type DatasetDisplayConfig = {
  label: string;
  datasetKey: string;
};

const DATASET_DISPLAY_CONFIG: DatasetDisplayConfig[] = [
  {
    label: "모델",
    datasetKey: "model",
  },
  {
    label: "카테고리",
    datasetKey: "category",
  },
  {
    label: "그룹",
    datasetKey: "group",
  },
];

const extractFieldSelection = (
  fields: FormSnapshotPayload["fields"],
  predicate: (field: FormSnapshotPayload["fields"][number]) => boolean
): FieldSelection | undefined => {
  const index = fields.findIndex(predicate);

  if (index === -1) {
    return undefined;
  }

  const field = fields[index];

  if (field.tag === "textarea" || field.tag === "input") {
    return {
      fieldIndex: index,
      value: field.value ?? "",
    };
  }

  if (field.tag === "select") {
    const selectedOption = field.options?.find((option) => option.selected);

    return {
      fieldIndex: index,
      value: selectedOption?.value ?? "",
      label: selectedOption?.label ?? selectedOption?.value ?? "",
      options: field.options?.map((option) => ({
        value: option.value,
        label: option.label || option.value,
      })),
    };
  }

  return undefined;
};

const deriveFormData = (
  payload: FormSnapshotPayload | null
): DerivedFormData | null => {
  if (!payload) {
    return null;
  }

  const { fields, figures, values } = payload;

  const prompt = extractFieldSelection(
    fields,
    (field) =>
      field.name === "prompt" ||
      (field.tag === "textarea" &&
        field.dataset?.sentryComponent === "ImageFormPrompt")
  );

  const ratio = extractFieldSelection(fields, (field) => {
    if (field.tag !== "select") {
      return false;
    }

    const hasNamedRatio = field.name === "ratio";
    const hasRatioLikeOption =
      field.options?.some((option) => /\d+:\d+/.test(option.value)) ?? false;

    return hasNamedRatio || hasRatioLikeOption;
  });

  const quality = extractFieldSelection(fields, (field) => {
    if (field.tag !== "select") {
      return false;
    }

    const isQualityByName = field.name === "quality";
    const hasQualityDataset =
      field.dataset?.quality === "true" ||
      field.dataset?.sentryComponent === "QualitySelect";
    const hasExplicitQualityOptions =
      field.options
        ?.map((option) => option.label || option.value)
        .filter(Boolean)
        .map((text) => text.trim().toLowerCase()) ?? [];
    const includesBasicHigh =
      hasExplicitQualityOptions.includes("basic") &&
      hasExplicitQualityOptions.includes("high");

    if (!(isQualityByName || hasQualityDataset || includesBasicHigh)) {
      return false;
    }

    return (
      field.options?.some((option) => {
        const optionLabel = option.label?.trim().toLowerCase();
        const optionValue = option.value?.trim().toLowerCase();

        return optionLabel === "basic" || optionValue === "basic";
      }) ?? false
    );
  });

  const figureTexts: string[] = [];
  const addFigureText = (text: string | null | undefined) => {
    const trimmed = text?.trim();

    if (!trimmed) {
      return;
    }

    if (!figureTexts.includes(trimmed)) {
      figureTexts.push(trimmed);
    }
  };

  figures.forEach((figure) => {
    addFigureText(figure.textContent);
    addFigureText(figure.figcaption);
    figure.siblings?.forEach((text) => addFigureText(text));
  });

  const datasetValues: Record<string, string> = {};

  fields.forEach((field) => {
    field.relatedFigureTexts?.forEach((text) => addFigureText(text));
    field.siblingFigures?.forEach((text) => addFigureText(text));

    DATASET_DISPLAY_CONFIG.forEach(({ label, datasetKey }) => {
      if (datasetValues[label]) {
        return;
      }

      const datasetValue = field.dataset?.[datasetKey];

      if (typeof datasetValue === "string" && datasetValue.trim()) {
        datasetValues[label] = datasetValue;
      }
    });

    const qualityLabel = field.labelText || field.ariaLabel;

    if (
      field.tag === "select" &&
      qualityLabel &&
      /quality|퀄리티/i.test(qualityLabel) &&
      !datasetValues["퀄리티"]
    ) {
      const selectedOption = field.options?.find((option) => option.selected);

      if (selectedOption?.label || selectedOption?.value) {
        datasetValues["퀄리티"] =
          selectedOption.label || selectedOption.value || "";
      }
    }
  });

  if (values) {
    const rawQuality = Array.isArray(values["quality"])
      ? values["quality"][0]
      : values["quality"];

    const formattedQuality = formatQualityDisplay(rawQuality ?? null);

    if (formattedQuality) {
      datasetValues["퀄리티"] = formattedQuality;
    }
  }

  if (quality && !datasetValues["퀄리티"]) {
    const preferred =
      quality.label?.trim() ?? formatQualityDisplay(quality.value) ?? null;

    if (preferred) {
      datasetValues["퀄리티"] = preferred;
    }
  }

  return {
    prompt,
    ratio,
    quality,
    figures: Array.from(figureTexts),
    datasetValues,
  };
};

const generateEntryId = () => {
  const globalCrypto = globalThis.crypto;

  if (globalCrypto && typeof globalCrypto.randomUUID === "function") {
    return globalCrypto.randomUUID();
  }

  return `multi-${Math.random().toString(36).slice(2, 10)}`;
};

const createMultiPromptEntry = (ratio: string): MultiPromptEntry => ({
  id: generateEntryId(),
  prompt: "",
  ratio,
  count: "1",
});

const createEmptyMultiPromptEntries = (ratio: string) => [
  createMultiPromptEntry(ratio),
  createMultiPromptEntry(ratio),
  createMultiPromptEntry(ratio),
  createMultiPromptEntry(ratio),
];

const hasNonEmptyString = (value: string | null | undefined) =>
  Boolean(value && value.trim().length > 0);

const isPositiveIntegerString = (value: string | null | undefined) => {
  if (!value) {
    return false;
  }

  if (!/^\d+$/.test(value.trim())) {
    return false;
  }

  return Number.parseInt(value, 10) > 0;
};

const formatQualityDisplay = (value: string | null | undefined) => {
  const normalised = value?.trim().toLowerCase();

  if (!normalised) {
    return null;
  }

  if (normalised === "basic" || normalised === "720p") {
    return "Basic";
  }

  if (normalised === "high" || normalised === "1080p") {
    return "High";
  }

  return value?.trim() ?? null;
};

const isBasicQualitySelection = (selection: FieldSelection | undefined) => {
  if (!selection) {
    return false;
  }

  const normalisedValue = selection.value?.trim().toLowerCase();
  const normalisedLabel = selection.label?.trim().toLowerCase();

  if (normalisedLabel === "basic") {
    return true;
  }

  if (!normalisedValue) {
    return false;
  }

  return ["basic", "720p", "low"].includes(normalisedValue);
};

export const TargetScreen = ({
  isReadingForm,
  formReadError,
  formPayload,
  onReadForm,
}: TargetScreenProps) => {
  const derived = useMemo(() => deriveFormData(formPayload), [formPayload]);

  const [ratioValue, setRatioValue] = useState("");
  const [multiPromptEntries, setMultiPromptEntries] = useState<
    MultiPromptEntry[]
  >(() => createEmptyMultiPromptEntries(""));
  const [isConfirming, setIsConfirming] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [preparationMessage, setPreparationMessage] = useState<string | null>(
    null
  );
  const announce = useLiveRegion();
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
  const ratioOptions = useMemo(() => {
    const options = derived?.ratio?.options;
    if (!options) {
      return [];
    }

    return options.filter((option) => option.value?.trim() !== "");
  }, [derived?.ratio?.options]);
  const multiPromptRatioOptions = useMemo(() => {
    const values = [ratioValue, ...ratioOptions.map((option) => option.value)];
    const uniqueValues = values.filter((value, index, array) => {
      if (!value?.trim()) {
        return false;
      }

      return array.indexOf(value) === index;
    });

    return uniqueValues.map((value) => {
      const matched = ratioOptions.find((option) => option.value === value);

      return {
        value,
        label: matched?.label ?? value,
      };
    });
  }, [ratioValue, ratioOptions]);

  useEffect(() => {
    if (!derived) {
      setRatioValue("");
      setMultiPromptEntries(createEmptyMultiPromptEntries(""));
      setPreparationMessage(null);
      return;
    }

    const nextRatioValue = derived?.ratio?.value?.trim()
      ? derived?.ratio?.value ?? ""
      : ratioOptions[0]?.value ?? "";
    setRatioValue(nextRatioValue);

    setMultiPromptEntries((prev) => {
      if (!prev.length) {
        return createEmptyMultiPromptEntries(nextRatioValue);
      }

      return prev.map((entry) => ({
        ...entry,
        ratio: entry.ratio || nextRatioValue,
      }));
    });
  }, [derived, ratioOptions]);

  const updateMultiEntry = useCallback(
    (id: string, key: keyof MultiPromptEntry, value: string) => {
      setMultiPromptEntries((prev) =>
        prev.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                [key]: value,
              }
            : entry
        )
      );
    },
    []
  );

  const handleMultiPromptChange = useCallback(
    (id: string, value: string) => {
      updateMultiEntry(id, "prompt", value);
    },
    [updateMultiEntry]
  );

  const handleMultiRatioChange = useCallback(
    (id: string, value: string) => {
      updateMultiEntry(id, "ratio", value);
    },
    [updateMultiEntry]
  );

  const handleMultiCountChange = useCallback(
    (id: string, value: string) => {
      updateMultiEntry(id, "count", value);
    },
    [updateMultiEntry]
  );

  const addMultiPromptRow = useCallback(() => {
    setPreparationMessage(null);
    setGenerationError(null);
    setIsConfirming(false);

    setMultiPromptEntries((prev) => {
      if (prev.length >= 6) {
        return prev;
      }

      return [...prev, createMultiPromptEntry(ratioValue)];
    });
  }, [ratioValue]);

  const removeMultiPromptRow = useCallback((id: string) => {
    setPreparationMessage(null);
    setGenerationError(null);
    setIsConfirming(false);

    setMultiPromptEntries((prev) => {
      if (prev.length <= 1) {
        return prev;
      }

      return prev.filter((entry) => entry.id !== id);
    });
  }, []);

  useEffect(() => {
    if (!ratioValue?.trim()) {
      return;
    }

    setMultiPromptEntries((prev) =>
      prev.map((entry) => ({
        ...entry,
        ratio: entry.ratio?.trim() ? entry.ratio : ratioValue,
      }))
    );
  }, [ratioValue]);

  useEffect(() => {
    setPreparationMessage(null);
    setGenerationError(null);
    setIsConfirming(false);
  }, [multiPromptEntries]);

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

    if (!derived) {
      failPreparation("폼 데이터를 찾을 수 없습니다.");
      return;
    }

    if (!multiPromptEntries.length) {
      failPreparation("등록된 멀티 프롬프트가 없습니다.");
      return;
    }

    const { prompt, ratio, quality } = derived;

    if (!prompt || !hasNonEmptyString(prompt.value)) {
      failPreparation("기본 프롬프트 입력을 확인해주세요.");
      return;
    }

    if (!ratio || !hasNonEmptyString(ratio.value)) {
      failPreparation("기본 비율 입력을 확인해주세요.");
      return;
    }

    if (!quality || !hasNonEmptyString(quality.value)) {
      failPreparation("퀄리티 옵션을 확인할 수 없습니다.");
      return;
    }

    if (!isBasicQualitySelection(quality)) {
      failPreparation("퀄리티 옵션이 Basic으로 설정되어야 합니다.");
      return;
    }

    if (multiPromptEntries.some((entry) => !hasNonEmptyString(entry.prompt))) {
      failPreparation("모든 멀티 프롬프트를 입력해주세요.");
      return;
    }

    if (multiPromptEntries.some((entry) => !hasNonEmptyString(entry.ratio))) {
      failPreparation("모든 멀티 프롬프트의 비율을 선택해주세요.");
      return;
    }

    if (
      multiPromptEntries.some((entry) => !isPositiveIntegerString(entry.count))
    ) {
      failPreparation("생성 횟수는 1 이상의 정수로 입력해주세요.");
      return;
    }

    const firstPrompt = multiPromptEntries[0];

    if (!hasNonEmptyString(firstPrompt?.prompt)) {
      failPreparation("첫 번째 프롬프트를 입력해주세요.");
      return;
    }

    if (!hasNonEmptyString(firstPrompt?.ratio)) {
      failPreparation("첫 번째 프롬프트의 비율을 선택해주세요.");
      return;
    }

    try {
      if (
        typeof prompt.fieldIndex === "number" &&
        prompt.fieldIndex >= 0 &&
        firstPrompt.prompt
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
        typeof ratio.fieldIndex === "number" &&
        ratio.fieldIndex >= 0 &&
        firstPrompt.ratio
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

    const successMessage = "첫 번째 프롬프트와 비율을 폼에 입력했습니다.";
    setPreparationMessage(successMessage);
    if (highlightInfo) {
      announce(
        `${successMessage} ${highlightInfo.display} - 이미지 생성 버튼을 누르려면 동의가 필요합니다.`
      );
    } else {
      announce(successMessage);
    }

    setIsConfirming(true);
  }, [announce, derived, failPreparation, highlightInfo, multiPromptEntries]);

  const handleCancelGeneration = useCallback(() => {
    setIsConfirming(false);
  }, []);

  const handleConfirmGeneration = useCallback(async () => {
    setIsConfirming(false);
  }, []);

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
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-700">
                  표시 정보
                </h2>
                <div className="flex flex-wrap gap-2">
                  {derived.figures.map((text) => {
                    const info = extractHighlightFromText(text);

                    return (
                      <span
                        key={text}
                        className={
                          info
                            ? "inline-flex items-center rounded-full border border-amber-400 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm"
                            : "inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                        }
                      >
                        {info?.display ?? text}
                      </span>
                    );
                  })}

                  {Object.entries(derived.datasetValues).map(
                    ([label, value]) => (
                      <span
                        key={`${label}-${value}`}
                        className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700"
                      >
                        {`${label}: ${value}`}
                      </span>
                    )
                  )}

                  {!derived.figures.length &&
                  !Object.keys(derived.datasetValues).length ? (
                    <span className="text-xs text-slate-500">
                      표시할 정보를 찾지 못했습니다.
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-700">
                    멀티 프롬프트 입력
                  </h2>
                  <button
                    type="button"
                    className="rounded border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                    onClick={addMultiPromptRow}
                    disabled={multiPromptEntries.length >= 6}
                  >
                    프롬프트 추가
                  </button>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                  <div className="grid grid-cols-[minmax(0,1fr)_92px_92px_36px] items-center gap-3 border-b border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600">
                    <span>프롬프트</span>
                    <span className="text-center">비율</span>
                    <span className="text-center">생성 횟수</span>
                    <span className="text-center">&nbsp;</span>
                  </div>

                  <div className="divide-y divide-slate-200">
                    {multiPromptEntries.map((entry, index) => (
                      <div
                        key={entry.id}
                        className="grid grid-cols-[minmax(0,1fr)_92px_92px_36px] items-start gap-3 px-4 py-3"
                      >
                        <textarea
                          className="min-h-[140px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder={`프롬프트 ${index + 1}`}
                          value={entry.prompt}
                          onChange={(event) =>
                            handleMultiPromptChange(
                              entry.id,
                              event.target.value
                            )
                          }
                        />
                        <select
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          value={entry.ratio}
                          onChange={(event) =>
                            handleMultiRatioChange(entry.id, event.target.value)
                          }
                        >
                          {multiPromptRatioOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <input
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-center text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          type="number"
                          min={1}
                          max={99}
                          value={entry.count}
                          onChange={(event) =>
                            handleMultiCountChange(entry.id, event.target.value)
                          }
                        />
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                          onClick={() => removeMultiPromptRow(entry.id)}
                          disabled={multiPromptEntries.length <= 1}
                          aria-label={`프롬프트 ${index + 1} 삭제`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5">
                    <p className="text-xs text-slate-500">
                      최소 1개, 최대 6개의 프롬프트를 설정할 수 있습니다.
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>프롬프트 길이를 넉넉히 확보했습니다.</span>
                      <span>비율·횟수 입력은 최소 크기로 유지됩니다.</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-emerald-800">
                      이미지 생성
                    </p>
                    <p className="text-xs text-emerald-700">
                      {highlightInfo
                        ? highlightInfo.display
                        : `버튼 텍스트에 "${GENERATION_BUTTON_KEY_PHRASE}" 문구가 포함된 버튼을 찾아 클릭합니다.`}
                    </p>
                    {preparationMessage ? (
                      <p className="text-xs text-emerald-600">
                        {preparationMessage}
                      </p>
                    ) : null}
                  </div>
                  <button
                    className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-emerald-500 active:bg-emerald-700 disabled:bg-emerald-300"
                    onClick={handleRequestGeneration}
                  >
                    이미지 생성 준비
                  </button>
                </div>

                {isConfirming ? (
                  <div className="space-y-2 rounded-md border border-amber-300 bg-white px-3 py-2 text-xs text-slate-700">
                    <p className="font-semibold text-amber-700">
                      하루 무료 크레딧이 차감됩니다. 계속 진행할까요?
                    </p>
                    <div className="flex gap-2">
                      <button
                        className="rounded border border-amber-400 bg-amber-50 px-3 py-1 font-semibold text-amber-700 hover:bg-amber-100"
                        onClick={handleConfirmGeneration}
                      >
                        동의하고 진행
                      </button>
                      <button
                        className="rounded border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600 hover:bg-slate-100"
                        onClick={handleCancelGeneration}
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : null}

                {generationError ? (
                  <p className="text-xs text-red-600">{generationError}</p>
                ) : null}
              </div>

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
