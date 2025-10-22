import type {
  FigureSnapshot,
  FormFieldSnapshot,
  FormSnapshotPayload,
} from "./formSnapshot";

import { FORM_SELECTOR } from "@extension/constants";

type ScriptResult =
  | {
      success: true;
      payload: FormSnapshotPayload;
    }
  | {
      success: false;
      error: string;
    };

export const formSnapshotScript = (formSelector?: string): ScriptResult => {
  const safeCSSId = (id: string) => {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(id);
    }

    return id.replace(/([\s!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, "\\$1");
  };

  const extractDataset = (element: Element | null) => {
    const dataset: Record<string, string> = {};

    if (element instanceof HTMLElement) {
      Object.entries(element.dataset).forEach(([key, value]) => {
        dataset[key] = value ?? "";
      });
    }

    return dataset;
  };

  const collectLabelText = (element: Element, form: HTMLFormElement) => {
    const labelledby = element.getAttribute("aria-labelledby");

    if (!labelledby) {
      return null;
    }

    const ids = labelledby.split(/\s+/).filter(Boolean);

    if (!ids.length) {
      return null;
    }

    const texts = new Set<string>();

    ids.forEach((labelId) => {
      const escapedId = safeCSSId(labelId);
      const labelElement =
        document.getElementById(labelId) ??
        form.querySelector(`#${escapedId}`) ??
        form.querySelector(`[for="${escapedId}"]`);

      if (labelElement?.textContent) {
        const content = labelElement.textContent.trim();
        if (content) {
          texts.add(content);
        }
      }

      const labelledControls = form.querySelectorAll(
        `[id="${escapedId}"] [aria-label], label[for="${escapedId}"]`
      );

      labelledControls.forEach((control) => {
        const ariaLabel =
          control instanceof HTMLElement
            ? control.getAttribute("aria-label")
            : null;
        if (ariaLabel) {
          texts.add(ariaLabel);
        }
      });
    });

    return texts.size ? Array.from(texts).join(" | ") : null;
  };

  const mapFigures = (form: HTMLFormElement) => {
    const figureMap = new Map<Element, string>();
    const fieldFigureMap = new Map<Element, Set<Element>>();

    Array.from(form.querySelectorAll("figure")).forEach((figure) => {
      const text = figure.textContent?.trim();

      if (!text) {
        return;
      }

      figureMap.set(figure, text);

      const candidateAncestors: Element[] = [];

      let ancestor: Element | null = figure.parentElement;

      while (ancestor) {
        candidateAncestors.push(ancestor);

        if (ancestor === form) {
          break;
        }

        ancestor = ancestor.parentElement;
      }

      if (!candidateAncestors.length) {
        candidateAncestors.push(form);
      }

      candidateAncestors.forEach((candidate) => {
        const currentSet = fieldFigureMap.get(candidate) ?? new Set<Element>();
        currentSet.add(figure);
        fieldFigureMap.set(candidate, currentSet);
      });
    });

    return {
      figureMap,
      fieldFigureMap,
    };
  };

  const collectRelatedFigures = (
    element: Element,
    form: HTMLFormElement,
    figureMap: Map<Element, string>,
    fieldFigureMap: Map<Element, Set<Element>>
  ) => {
    const figureTexts = new Set<string>();

    let current: Element | null = element;
    const maxDepth = 5;
    let depth = 0;

    while (current && depth < maxDepth) {
      current.querySelectorAll("figure").forEach((figure) => {
        const text = figure.textContent?.trim();
        if (text) {
          figureTexts.add(text);
        }
      });

      current = current.parentElement;
      depth += 1;
    }

    const directSiblingFigures: string[] = [];
    const visitedFigures = new Set<Element>();

    let traversalElement: Element | null = element;
    let siblingDepth = 0;
    const siblingDepthLimit = 6;

    while (traversalElement && siblingDepth <= siblingDepthLimit) {
      const relatedFigures = fieldFigureMap.get(traversalElement);

      if (relatedFigures) {
        relatedFigures.forEach((figure) => {
          if (visitedFigures.has(figure)) {
            return;
          }

          visitedFigures.add(figure);

          if (figure.contains(element)) {
            return;
          }

          const text = figureMap.get(figure);

          if (text) {
            directSiblingFigures.push(text);
          }
        });
      }

      if (directSiblingFigures.length >= 8 || traversalElement === form) {
        break;
      }

      traversalElement = traversalElement.parentElement;
      siblingDepth += 1;
    }

    return {
      relatedFigureTexts: Array.from(figureTexts),
      siblingFigures: directSiblingFigures,
    };
  };

  const collectFieldSnapshot = (
    element: Element,
    form: HTMLFormElement,
    figureMap: Map<Element, string>,
    fieldFigureMap: Map<Element, Set<Element>>
  ): FormFieldSnapshot => {
    const tag = element.tagName.toLowerCase();
    const name = element.getAttribute("name");
    const id = element.getAttribute("id");
    const dataset = extractDataset(element);

    const { relatedFigureTexts, siblingFigures } = collectRelatedFigures(
      element,
      form,
      figureMap,
      fieldFigureMap
    );

    const common = {
      tag,
      name,
      id,
      placeholder: element.getAttribute("placeholder"),
      ariaLabel: element.getAttribute("aria-label"),
      labelText: collectLabelText(element, form),
      dataset,
      relatedFigureTexts,
      siblingFigures,
    };

    if (element instanceof HTMLInputElement) {
      return {
        ...common,
        type: element.type,
        value: element.value,
        checked: element.checked,
      };
    }

    if (element instanceof HTMLTextAreaElement) {
      return {
        ...common,
        value: element.value,
      };
    }

    if (element instanceof HTMLSelectElement) {
      return {
        ...common,
        multiple: element.multiple,
        options: Array.from(element.options).map((option) => ({
          value: option.value,
          label: option.label,
          selected: option.selected,
        })),
      };
    }

    return common;
  };

  const collectFigureSnapshot = (figure: Element): FigureSnapshot => {
    const figcaption = figure.querySelector("figcaption");
    const img = figure.querySelector("img");
    const siblingTextContent = Array.from(figure.parentElement?.children ?? [])
      .filter((sibling) => sibling !== figure && sibling instanceof HTMLElement)
      .map((sibling) => sibling.textContent?.trim())
      .filter((text): text is string => Boolean(text));

    const figureDataset = extractDataset(figure);

    return {
      textContent: figure.textContent?.trim() ?? "",
      figcaption: figcaption?.textContent?.trim() ?? null,
      imgAlt: img?.getAttribute("alt") ?? null,
      imgSrc: img?.getAttribute("src") ?? null,
      dataset: figureDataset,
      siblings: siblingTextContent,
    };
  };

  const selector = formSelector ?? FORM_SELECTOR;
  const form = document.querySelector(selector);

  if (!(form instanceof HTMLFormElement)) {
    return {
      success: false,
      error: "선택자에 해당하는 폼을 찾지 못했습니다.",
    };
  }

  const formData = new FormData(form);
  const values: Record<string, string | string[]> = {};

  formData.forEach((value, key) => {
    const nextValue = value instanceof File ? value.name : value.toString();

    if (Object.prototype.hasOwnProperty.call(values, key)) {
      const current = values[key];

      if (Array.isArray(current)) {
        current.push(nextValue);
      } else {
        values[key] = [current, nextValue];
      }
    } else {
      values[key] = nextValue;
    }
  });

  const { figureMap, fieldFigureMap } = mapFigures(form);

  const fields = Array.from(
    form.querySelectorAll("input, textarea, select")
  ).map((element) =>
    collectFieldSnapshot(element, form, figureMap, fieldFigureMap)
  );

  const figures = Array.from(form.querySelectorAll("figure")).map((figure) =>
    collectFigureSnapshot(figure)
  );

  return {
    success: true,
    payload: {
      values,
      fields,
      figures,
    },
  };
};

export { FORM_SELECTOR };
export type { FormSnapshotPayload };
