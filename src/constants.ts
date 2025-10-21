export const TARGET_ORIGIN = "https://higgsfield.ai";
export const TARGET_PATH = "/image/soul";
export const TARGET_URL = `${TARGET_ORIGIN}${TARGET_PATH}`;

export const ACTIVE_TAB_QUERY = {
  active: true,
  lastFocusedWindow: true,
} as const;

export const FORM_SELECTOR = "#main > div > form";

export const FEED_ROOT_SELECTOR = "[data-sentry-component='SoulFeed']";
export const FEED_ITEM_SELECTOR = "[data-sentry-component='SoulFeedItem']";
export const UPSALE_SELECTOR = "[data-sentry-component='ImageUpsellComponent']";
