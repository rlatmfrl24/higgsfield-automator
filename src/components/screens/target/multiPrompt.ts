export type MultiPromptEntry = {
  id: string;
  prompt: string;
  ratio: string;
  count: string;
};

const generateEntryId = () => {
  const globalCrypto = globalThis.crypto;

  if (globalCrypto && typeof globalCrypto.randomUUID === "function") {
    return globalCrypto.randomUUID();
  }

  return `multi-${Math.random().toString(36).slice(2, 10)}`;
};

export const createMultiPromptEntry = (ratio: string): MultiPromptEntry => ({
  id: generateEntryId(),
  prompt: "",
  ratio,
  count: "1",
});

export const createEmptyMultiPromptEntries = (ratio: string) => [
  createMultiPromptEntry(ratio),
  createMultiPromptEntry(ratio),
];

export const hasNonEmptyString = (value: string | null | undefined) =>
  Boolean(value && value.trim().length > 0);

export const isPositiveIntegerString = (value: string | null | undefined) => {
  if (!value) {
    return false;
  }

  if (!/^\d+$/.test(value.trim())) {
    return false;
  }

  return Number.parseInt(value, 10) > 0;
};
