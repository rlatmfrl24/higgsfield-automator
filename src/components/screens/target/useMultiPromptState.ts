import { useCallback, useEffect, useMemo, useState } from "react";

import type { FieldSelection } from "./formData";
import {
  createEmptyMultiPromptEntries,
  createMultiPromptEntry,
} from "./multiPrompt";
import type { MultiPromptEntry } from "./multiPrompt";

const MAX_PROMPT_ROW = 10;
const DEFAULT_PROMPT_ROWS = 2;

export type UseMultiPromptStateResult = {
  ratioValue: string;
  ratioOptions: Array<{ value: string; label: string }>;
  selectOptions: Array<{ value: string; label: string }>;
  entries: MultiPromptEntry[];
  setEntries: React.Dispatch<React.SetStateAction<MultiPromptEntry[]>>;
  setRatioValue: React.Dispatch<React.SetStateAction<string>>;
  addEntry: () => void;
  removeEntry: (id: string) => void;
  updateEntry: (
    id: string,
    update: Partial<Pick<MultiPromptEntry, "prompt" | "ratio" | "count">>
  ) => void;
  canAddMore: boolean;
  addInitialRows: (count: number) => void;
};

const filterRatioOptions = (options: FieldSelection["options"] | undefined) => {
  if (!options) {
    return [];
  }

  return options.filter((option) => option.value?.trim() !== "");
};

const toSelectOptions = (
  ratioValue: string,
  ratioOptions: Array<{ value: string; label: string }>
) => {
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
};

export const useMultiPromptState = (
  ratioSelection: FieldSelection | undefined
): UseMultiPromptStateResult => {
  const [ratioValue, setRatioValue] = useState("");
  const [entries, setEntries] = useState<MultiPromptEntry[]>(() =>
    createEmptyMultiPromptEntries("").slice(0, DEFAULT_PROMPT_ROWS)
  );

  const ratioOptions = useMemo(
    () => filterRatioOptions(ratioSelection?.options),
    [ratioSelection?.options]
  );

  useEffect(() => {
    if (!ratioSelection) {
      setRatioValue("");
      setEntries(createEmptyMultiPromptEntries(""));
      return;
    }

    const nextRatioValue = ratioSelection.value?.trim()
      ? ratioSelection.value ?? ""
      : ratioOptions[0]?.value ?? "";

    setRatioValue(nextRatioValue ?? "");

    setEntries((prev) => {
      if (!prev.length) {
        return createEmptyMultiPromptEntries(nextRatioValue ?? "");
      }

      return prev.map((entry) => ({
        ...entry,
        ratio: entry.ratio || nextRatioValue || "",
      }));
    });
  }, [ratioSelection, ratioOptions]);

  useEffect(() => {
    if (!ratioValue?.trim()) {
      return;
    }

    setEntries((prev) =>
      prev.map((entry) => ({
        ...entry,
        ratio: entry.ratio?.trim() ? entry.ratio : ratioValue,
      }))
    );
  }, [ratioValue]);

  const updateEntry = useCallback(
    (
      id: string,
      update: Partial<Pick<MultiPromptEntry, "prompt" | "ratio" | "count">>
    ) => {
      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                ...update,
              }
            : entry
        )
      );
    },
    []
  );

  const addEntry = useCallback(() => {
    setEntries((prev) => {
      if (prev.length >= MAX_PROMPT_ROW) {
        return prev;
      }

      return [...prev, createMultiPromptEntry(ratioValue)];
    });
  }, [ratioValue]);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => {
      if (prev.length <= 1) {
        return prev;
      }

      return prev.filter((entry) => entry.id !== id);
    });
  }, []);

  const selectOptions = useMemo(
    () => toSelectOptions(ratioValue, ratioOptions),
    [ratioValue, ratioOptions]
  );

  const addInitialRows = useCallback(
    (count: number) => {
      setEntries((prev) => {
        if (prev.length >= count) {
          return prev;
        }

        const rowsToAdd = count - prev.length;

        const newEntries = Array.from({ length: rowsToAdd }).map(() =>
          createMultiPromptEntry(ratioValue)
        );

        return [...prev, ...newEntries].slice(0, MAX_PROMPT_ROW);
      });
    },
    [ratioValue]
  );

  return {
    ratioValue,
    ratioOptions,
    selectOptions,
    entries,
    setEntries,
    setRatioValue,
    addEntry,
    removeEntry,
    updateEntry,
    addInitialRows,
    canAddMore: entries.length < MAX_PROMPT_ROW,
  };
};
