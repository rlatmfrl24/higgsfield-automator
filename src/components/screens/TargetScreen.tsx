import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";

import type { FormSnapshotPayload } from "../../services/formSnapshot";
import { updateActiveTabFieldValue } from "../../services/formControl";

type TargetScreenProps = {
  isReadingForm: boolean;
  formReadError: string | null;
  formPayload: FormSnapshotPayload | null;
  onReadForm: () => void;
};

type FieldSelection = {
  fieldIndex: number;
  value: string;
  options?: Array<{ value: string; label: string }>;
};

type DerivedFormData = {
  prompt?: FieldSelection;
  ratio?: FieldSelection;
  quality?: FieldSelection;
  figures: string[];
  datasetValues: Record<string, string>;
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

  const { fields, figures } = payload;

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

    const hasNamedQuality = field.name === "quality";
    const hasQualityLikeOption =
      field.options?.some((option) => /\d+p$/i.test(option.value)) ?? false;

    return hasNamedQuality || hasQualityLikeOption;
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
  });

  return {
    prompt,
    ratio,
    quality,
    figures: Array.from(figureTexts),
    datasetValues,
  };
};

export const TargetScreen = ({
  isReadingForm,
  formReadError,
  formPayload,
  onReadForm,
}: TargetScreenProps) => {
  const derived = useMemo(() => deriveFormData(formPayload), [formPayload]);

  const [promptValue, setPromptValue] = useState("");
  const [ratioValue, setRatioValue] = useState("");
  const [qualityValue, setQualityValue] = useState("");
  const [controlError, setControlError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (!derived) {
      setPromptValue("");
      setRatioValue("");
      setQualityValue("");
      return;
    }

    if (derived.prompt) {
      setPromptValue(derived.prompt.value);
    }

    if (derived.ratio) {
      setRatioValue(derived.ratio.value);
    }

    if (derived.quality) {
      setQualityValue(derived.quality.value);
    }
  }, [derived]);

  const applyFieldValue = useCallback(
    async (selection: FieldSelection | undefined, value: string) => {
      if (!selection) {
        setControlError("제어 가능한 필드를 찾지 못했습니다.");
        return;
      }

      setControlError(null);
      setIsApplying(true);

      try {
        await updateActiveTabFieldValue({
          fieldIndex: selection.fieldIndex,
          value,
        });
      } catch (error) {
        console.error("필드 업데이트 중 오류", error);
        const message =
          error instanceof Error
            ? error.message
            : "필드 값을 업데이트하지 못했습니다.";
        setControlError(message);
      } finally {
        setIsApplying(false);
      }
    },
    []
  );

  const handlePromptChange = useCallback(
    async (event: ChangeEvent<HTMLTextAreaElement>) => {
      const nextValue = event.target.value;
      setPromptValue(nextValue);
      await applyFieldValue(derived?.prompt, nextValue);
    },
    [applyFieldValue, derived?.prompt]
  );

  const handleRatioChange = useCallback(
    async (event: ChangeEvent<HTMLSelectElement>) => {
      const nextValue = event.target.value;
      setRatioValue(nextValue);
      await applyFieldValue(derived?.ratio, nextValue);
    },
    [applyFieldValue, derived?.ratio]
  );

  const handleQualityChange = useCallback(
    async (event: ChangeEvent<HTMLSelectElement>) => {
      const nextValue = event.target.value;
      setQualityValue(nextValue);
      await applyFieldValue(derived?.quality, nextValue);
    },
    [applyFieldValue, derived?.quality]
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
              {isApplying ? (
                <span className="text-xs text-emerald-600">DOM 반영 중...</span>
              ) : null}
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h2 className="text-sm font-semibold text-slate-700">
                  표시 정보
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {derived.figures.length ? (
                    derived.figures.map((text) => (
                      <span
                        key={text}
                        className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                      >
                        {text}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500">
                      표시할 정보를 찾지 못했습니다.
                    </span>
                  )}
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-slate-700">
                    프롬프트
                  </span>
                  <textarea
                    className="min-h-[120px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={promptValue}
                    onChange={handlePromptChange}
                    placeholder="프롬프트를 입력하세요"
                    disabled={!derived.prompt}
                  />
                </label>

                <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-1">
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-slate-700">
                      Ratio
                    </span>
                    <select
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      value={ratioValue}
                      onChange={handleRatioChange}
                      disabled={!derived.ratio}
                    >
                      {derived.ratio?.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      )) ?? <option value="">선택 불가</option>}
                    </select>
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-slate-700">
                      Quality
                    </span>
                    <select
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      value={qualityValue}
                      onChange={handleQualityChange}
                      disabled={!derived.quality}
                    >
                      {derived.quality?.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      )) ?? <option value="">선택 불가</option>}
                    </select>
                  </label>
                </div>
              </div>

              {controlError ? (
                <p className="text-xs text-red-600">{controlError}</p>
              ) : null}

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
