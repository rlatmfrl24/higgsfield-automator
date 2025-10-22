import { FORM_SELECTOR } from "@extension/constants";
import { requireActiveTabId } from "./tabs";

type UpdateFieldValueArgs = {
  fieldIndex: number;
  value: string;
};

type InjectionResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
    };

const updateFieldValueInPage = (
  selector: string,
  fieldIndex: number,
  value: string
): InjectionResult => {
  const setNativeValue = (
    element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
    nextValue: string
  ) => {
    const ownDescriptor = Object.getOwnPropertyDescriptor(element, "value");

    if (ownDescriptor?.set) {
      ownDescriptor.set.call(element, nextValue);
      return;
    }

    let prototype = Object.getPrototypeOf(element);

    while (prototype) {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

      if (descriptor?.set) {
        descriptor.set.call(element, nextValue);
        return;
      }

      prototype = Object.getPrototypeOf(prototype);
    }

    element.value = nextValue;
  };

  const form = document.querySelector(selector);

  if (!(form instanceof HTMLFormElement)) {
    return {
      success: false,
      error: "폼을 찾을 수 없습니다.",
    };
  }

  const fields = form.querySelectorAll("input, textarea, select");
  const element = fields.item(fieldIndex);

  if (!(element instanceof HTMLElement)) {
    return {
      success: false,
      error: "대상 필드를 찾을 수 없습니다.",
    };
  }

  if (element instanceof HTMLInputElement) {
    setNativeValue(element, value);
  } else if (element instanceof HTMLTextAreaElement) {
    setNativeValue(element, value);
  } else if (element instanceof HTMLSelectElement) {
    setNativeValue(element, value);

    Array.from(element.options).forEach((option) => {
      option.selected = option.value === value;
    });
  } else {
    return {
      success: false,
      error: "지원하지 않는 필드 타입입니다.",
    };
  }

  const inputEvent = new Event("input", {
    bubbles: true,
    composed: true,
    cancelable: false,
  });
  const changeEvent = new Event("change", {
    bubbles: true,
    cancelable: false,
  });

  element.dispatchEvent(inputEvent);
  element.dispatchEvent(changeEvent);

  return { success: true };
};

export const updateActiveTabFieldValue = async ({
  fieldIndex,
  value,
}: UpdateFieldValueArgs): Promise<void> => {
  const tabId = await requireActiveTabId();

  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: updateFieldValueInPage,
    args: [FORM_SELECTOR, fieldIndex, value],
  });

  const response = result?.result as InjectionResult | undefined;

  if (!response?.success) {
    throw new Error(response?.error ?? "필드 값을 업데이트하지 못했습니다.");
  }
};
