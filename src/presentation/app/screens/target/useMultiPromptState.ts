import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { FieldSelection } from "./formData";
import { createMultiPromptEntry } from "./multiPrompt";
import type { MultiPromptEntry } from "./multiPrompt";

const DEFAULT_PROMPT_ROWS = 2;
const STORAGE_KEY = "higgsfield:multiPromptState";
const STORAGE_VERSION = 1;

const EXTRA_RATIO_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "2:3", label: "2:3" },
  { value: "3:2", label: "3:2" },
];

type MultiPromptStoredEntry = Partial<MultiPromptEntry> | null | undefined;
type MultiPromptStoredState = {
  version?: number;
  ratioValue?: string;
  entries?: MultiPromptStoredEntry[];
};

const isStorageAvailable = () =>
  typeof chrome !== "undefined" && typeof chrome.storage?.local !== "undefined";

const normaliseStoredEntry = (
  stored: MultiPromptStoredEntry,
  fallbackRatio: string
): MultiPromptEntry => {
  const fallback = createMultiPromptEntry(fallbackRatio);

  if (!stored || typeof stored !== "object") {
    return fallback;
  }

  const candidate = stored as Partial<MultiPromptEntry>;

  return {
    id:
      typeof candidate.id === "string" && candidate.id.trim().length
        ? candidate.id
        : fallback.id,
    prompt:
      typeof candidate.prompt === "string" ? candidate.prompt : fallback.prompt,
    ratio:
      typeof candidate.ratio === "string"
        ? candidate.ratio
        : typeof fallbackRatio === "string"
        ? fallbackRatio
        : fallback.ratio,
    count:
      typeof candidate.count === "string" && candidate.count.trim().length
        ? candidate.count
        : fallback.count,
  };
};

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

  const baseOptions = uniqueValues.map((value) => {
    const matched = ratioOptions.find((option) => option.value === value);

    return {
      value,
      label: matched?.label ?? value,
    };
  });

  EXTRA_RATIO_OPTIONS.forEach((option) => {
    const exists = baseOptions.some((base) => base.value === option.value);

    if (!exists) {
      baseOptions.push(option);
    }
  });

  return baseOptions;
};

export const useMultiPromptState = (
  ratioSelection: FieldSelection | undefined
): UseMultiPromptStateResult => {
  const storageSupportedRef = useRef(isStorageAvailable());
  const storageSupported = storageSupportedRef.current;
  const hasHydratedRef = useRef(!storageSupported);
  const [ratioValue, setRatioValue] = useState("");
  const [entries, setEntries] = useState<MultiPromptEntry[]>(() =>
    Array.from({ length: DEFAULT_PROMPT_ROWS }, () =>
      createMultiPromptEntry("")
    )
  );

  useEffect(() => {
    if (!storageSupported) {
      return;
    }

    let cancelled = false;

    chrome.storage.local.get([STORAGE_KEY], (result) => {
      if (cancelled) {
        return;
      }

      const lastError = chrome.runtime.lastError;

      if (!lastError) {
        const stored = result?.[STORAGE_KEY] as
          | MultiPromptStoredState
          | undefined;

        const versionIsCompatible =
          typeof stored?.version !== "number" ||
          stored.version === STORAGE_VERSION;

        if (stored && versionIsCompatible) {
          const storedRatio =
            typeof stored.ratioValue === "string" ? stored.ratioValue : "";

          const storedEntries = Array.isArray(stored.entries)
            ? stored.entries
            : [];

          let nextEntries = storedEntries.map((entry) =>
            normaliseStoredEntry(entry, storedRatio || "")
          );

          if (!nextEntries.length) {
            nextEntries = Array.from({ length: DEFAULT_PROMPT_ROWS }, () =>
              createMultiPromptEntry(storedRatio || "")
            );
          }

          setRatioValue(storedRatio ?? "");
          setEntries(nextEntries);
        }
      }

      hasHydratedRef.current = true;
    });

    return () => {
      cancelled = true;
    };
  }, [storageSupported]);

  useEffect(() => {
    if (!storageSupported || !hasHydratedRef.current) {
      return;
    }

    const payload: MultiPromptStoredState = {
      version: STORAGE_VERSION,
      ratioValue: ratioValue ?? "",
      entries: entries.map((entry) => ({
        id: entry.id,
        prompt: entry.prompt,
        ratio: entry.ratio,
        count: entry.count,
      })),
    };

    chrome.storage.local.set({ [STORAGE_KEY]: payload });
  }, [storageSupported, ratioValue, entries]);

  const ratioOptions = useMemo(
    () => filterRatioOptions(ratioSelection?.options),
    [ratioSelection?.options]
  );

  useEffect(() => {
    if (!ratioSelection) {
      setRatioValue("");
      setEntries((prev) =>
        prev.map((entry) => ({
          ...entry,
          ratio: "",
        }))
      );
      return;
    }

    const nextRatioValue = ratioSelection.value?.trim()
      ? ratioSelection.value ?? ""
      : ratioOptions[0]?.value ?? "";

    setRatioValue(nextRatioValue ?? "");

    setEntries((prev) => {
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

        return [...prev, ...newEntries];
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
    canAddMore: true,
  };
};
