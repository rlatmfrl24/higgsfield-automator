import { TARGET_URL } from "../constants";
import { checkActiveTabMatchesTarget, getActiveTab } from "./tabs";

type NavigateOptions = {
  maxAttempts?: number;
  attemptDelayMs?: number;
  onAttempt?: (matches: boolean, attempt: number) => void;
};

const delay = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const navigateActiveTabToTargetPage = async (
  options: NavigateOptions = {}
): Promise<boolean> => {
  const { maxAttempts = 10, attemptDelayMs = 500, onAttempt } = options;

  const tab = await getActiveTab();

  const targetUrl = TARGET_URL;

  if (tab?.id) {
    await chrome.tabs.update(tab.id, { url: targetUrl });
  } else {
    await chrome.tabs.create({ url: targetUrl, active: true });
  }

  let matchesTarget = false;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) {
      await delay(attemptDelayMs);
    }

    matchesTarget = await checkActiveTabMatchesTarget();

    onAttempt?.(matchesTarget, attempt);

    if (matchesTarget) {
      break;
    }
  }

  return matchesTarget;
};
