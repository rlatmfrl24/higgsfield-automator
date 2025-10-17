export type FormFieldSnapshot = {
  tag: string;
  name: string | null;
  id: string | null;
  type?: string;
  value?: string;
  checked?: boolean;
  multiple?: boolean;
  options?: Array<{
    value: string;
    label: string;
    selected: boolean;
  }>;
  placeholder?: string | null;
  ariaLabel?: string | null;
  labelText?: string | null;
  dataset: Record<string, string>;
  relatedFigureTexts: string[];
  siblingFigures: string[];
};

export type FigureSnapshot = {
  textContent: string;
  figcaption?: string | null;
  imgAlt?: string | null;
  imgSrc?: string | null;
  dataset: Record<string, string>;
  siblings: string[];
};

export type FormSnapshotPayload = {
  values: Record<string, string | string[]>;
  fields: FormFieldSnapshot[];
  figures: FigureSnapshot[];
};
