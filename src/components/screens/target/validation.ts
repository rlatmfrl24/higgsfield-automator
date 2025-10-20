import type { DerivedFormData } from "./formData";
import { hasNonEmptyString, isPositiveIntegerString } from "./multiPrompt";
import type { MultiPromptEntry } from "./multiPrompt";

export type ValidationResult = {
  ok: boolean;
  message?: string;
};

export type ValidationOptions = {
  derived: DerivedFormData | null;
  entries: MultiPromptEntry[];
};

export const validatePreparation = ({
  derived,
  entries,
}: ValidationOptions): ValidationResult => {
  if (!derived) {
    return { ok: false, message: "폼 데이터를 찾을 수 없습니다." };
  }

  if (!entries.length) {
    return { ok: false, message: "등록된 멀티 프롬프트가 없습니다." };
  }

  const { prompt, ratio, quality } = derived;

  if (!prompt || !hasNonEmptyString(prompt.value)) {
    return { ok: false, message: "기본 프롬프트 입력을 확인해주세요." };
  }

  if (!ratio || !hasNonEmptyString(ratio.value)) {
    return { ok: false, message: "기본 비율 입력을 확인해주세요." };
  }

  if (!quality || !hasNonEmptyString(quality.value)) {
    return { ok: false, message: "퀄리티 옵션을 확인할 수 없습니다." };
  }

  return { ok: true };
};

export const validateMultiPromptEntries = (
  entries: MultiPromptEntry[]
): ValidationResult => {
  if (entries.some((entry) => !hasNonEmptyString(entry.prompt))) {
    return { ok: false, message: "모든 멀티 프롬프트를 입력해주세요." };
  }

  if (entries.some((entry) => !hasNonEmptyString(entry.ratio))) {
    return { ok: false, message: "모든 멀티 프롬프트의 비율을 선택해주세요." };
  }

  if (entries.some((entry) => !isPositiveIntegerString(entry.count))) {
    return { ok: false, message: "생성 횟수는 1 이상의 정수로 입력해주세요." };
  }

  const firstPrompt = entries[0];

  if (!hasNonEmptyString(firstPrompt?.prompt)) {
    return { ok: false, message: "첫 번째 프롬프트를 입력해주세요." };
  }

  if (!hasNonEmptyString(firstPrompt?.ratio)) {
    return { ok: false, message: "첫 번째 프롬프트의 비율을 선택해주세요." };
  }

  return { ok: true };
};
