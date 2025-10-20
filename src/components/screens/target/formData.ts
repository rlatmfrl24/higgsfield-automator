import type { FormSnapshotPayload } from "../../../services/formSnapshot";

export type FieldSelection = {
  fieldIndex: number;
  value: string;
  label?: string;
  options?: Array<{ value: string; label: string }>;
  dataset?: Record<string, string>;
  tag?: string;
};

export type DerivedFormData = {
  prompt?: FieldSelection;
  ratio?: FieldSelection;
  quality?: FieldSelection;
  figures: string[];
  datasetValues: Record<string, string>;
};

export type CreditHighlight = {
  amount: string;
  display: string;
  raw: string;
};

type DatasetDisplayConfig = {
  label: string;
  datasetKey: string;
};

const HIGHLIGHT_PATTERN = /Generate(\d+)\s*Daily free credits left/i;

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

const addUniqueFigureText = (
  texts: string[],
  value: string | null | undefined
) => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return;
  }

  if (!texts.includes(trimmed)) {
    texts.push(trimmed);
  }
};

export const extractHighlightFromText = (
  text: string
): CreditHighlight | null => {
  const match = text.match(HIGHLIGHT_PATTERN);

  if (!match) {
    return null;
  }

  const amount = match[1];

  return {
    amount,
    display: `남은 크레딧: ${amount}`,
    raw: text,
  };
};

export const formatQualityDisplay = (value: string | null | undefined) => {
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

export const isBasicQualitySelection = (
  selection: FieldSelection | undefined
) => {
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

export const deriveFormData = (
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

  figures.forEach((figure) => {
    addUniqueFigureText(figureTexts, figure.textContent);
    addUniqueFigureText(figureTexts, figure.figcaption);
    figure.siblings?.forEach((text) => addUniqueFigureText(figureTexts, text));
  });

  const datasetValues: Record<string, string> = {};

  fields.forEach((field) => {
    field.relatedFigureTexts?.forEach((text) =>
      addUniqueFigureText(figureTexts, text)
    );
    field.siblingFigures?.forEach((text) =>
      addUniqueFigureText(figureTexts, text)
    );

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
