import { useCallback, useState } from "react";

import {
  readFeedItems,
  triggerFeedItemDownload,
  type FeedItemPreview,
} from "@infrastructure/services/feedItems";

const extractPreviewImage = (html: string) => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const img = doc.querySelector("img");

    if (!img) {
      return null;
    }

    const src =
      img.getAttribute("src") ??
      img.getAttribute("data-src") ??
      img.getAttribute("srcset")?.split(" ")[0] ??
      null;

    if (!src) {
      return null;
    }

    return {
      src,
      alt: img.getAttribute("alt") ?? "",
    };
  } catch {
    return null;
  }
};

type DownloadQueueBuilderProps = {
  className?: string;
};

export const DownloadQueueBuilder = ({
  className = "",
}: DownloadQueueBuilderProps) => {
  const [requestedCount, setRequestedCount] = useState("3");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [items, setItems] = useState<FeedItemPreview[]>([]);
  const [meta, setMeta] = useState<{
    requested: number;
    totalCount: number;
  } | null>(null);
  const [downloadStates, setDownloadStates] = useState<
    Record<
      string,
      {
        status: "idle" | "loading" | "success" | "error";
        message?: string;
      }
    >
  >({});

  const buildItemKey = useCallback((preview: FeedItemPreview) => {
    return `${preview.index}:${preview.signature ?? "unknown"}`;
  }, []);

  const handleBuildQueue = useCallback(async () => {
    const parsed = Number.parseInt(requestedCount, 10);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      setErrorMessage("1 이상의 정수를 입력해 주세요.");
      setItems([]);
      setDownloadStates({});
      setMeta(null);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { items: fetchedItems, totalCount } = await readFeedItems(parsed);
      setItems(fetchedItems);
      setDownloadStates({});
      setMeta({ requested: parsed, totalCount });

      if (!fetchedItems.length) {
        setErrorMessage("피드에서 다운로드할 아이템을 찾지 못했습니다.");
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "피드 아이템을 읽는 중 오류가 발생했습니다.";
      setErrorMessage(message);
      setItems([]);
      setDownloadStates({});
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [requestedCount]);

  const handleDownloadItem = useCallback(
    async (preview: FeedItemPreview) => {
      const key = buildItemKey(preview);

      setDownloadStates((prev) => ({
        ...prev,
        [key]: {
          status: "loading",
        },
      }));

      try {
        const result = await triggerFeedItemDownload(preview);

        if (result.html) {
          setItems((prev) =>
            prev.map((item) =>
              buildItemKey(item) === key
                ? ({ ...item, html: result.html } as FeedItemPreview)
                : item
            )
          );
        }

        setDownloadStates((prev) => ({
          ...prev,
          [key]: {
            status: "success",
            message: "다운로드 버튼을 클릭했습니다.",
          },
        }));
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "다운로드 버튼을 활성화하는 중 오류가 발생했습니다.";
        setDownloadStates((prev) => ({
          ...prev,
          [key]: {
            status: "error",
            message,
          },
        }));
      }
    },
    [buildItemKey]
  );

  const buttonClasses =
    "inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-200/60 transition hover:from-emerald-500 hover:to-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60";
  const downloadActionButtonClasses =
    "inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-600 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <section
      className={`space-y-4 rounded-2xl border border-white bg-white px-6 py-5 shadow-lg shadow-slate-200/60 sm:px-8 sm:py-6 lg:px-10 lg:py-7 ${className}`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 sm:text-xl">
            다운로드 큐 생성
          </h2>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            피드에서 순서대로 읽어올 아이템 개수를 입력하고 HTML을 확인하세요.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <label
          className="flex flex-col gap-2 text-sm text-slate-700"
          htmlFor="download-queue-builder-count"
        >
          <span>아이템 개수</span>
          <input
            id="download-queue-builder-count"
            type="number"
            min={1}
            step={1}
            value={requestedCount}
            onChange={(event) => {
              setRequestedCount(event.currentTarget.value);
            }}
            className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner shadow-slate-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-describedby="download-queue-builder-count-help"
          />
        </label>

        <div
          className="flex flex-1 flex-col gap-2 text-xs text-slate-500"
          id="download-queue-builder-count-help"
        >
          <p>현재 화면에서 보이는 피드를 위에서부터 순서대로 탐색합니다.</p>
          <p>입력한 개수만큼 아이템을 다운로드 큐에 추가할 예정입니다.</p>
        </div>

        <button
          className={buttonClasses}
          type="button"
          onClick={() => {
            void handleBuildQueue();
          }}
          disabled={isLoading}
        >
          {isLoading ? "피드 읽는 중..." : "다운로드 큐 생성"}
        </button>
      </div>

      {meta ? (
        <p className="text-xs text-slate-500">
          총 {meta.totalCount}개의 피드 아이템 중 {items.length}개를
          불러왔습니다.
          {items.length < meta.requested
            ? " 요청한 개수보다 적은 아이템만 확인되었습니다."
            : null}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="text-xs font-semibold text-rose-600">{errorMessage}</p>
      ) : null}

      {isLoading ? (
        <p className="text-xs text-slate-500">
          피드에서 아이템을 읽어오는 중입니다...
        </p>
      ) : null}

      {items.length ? (
        <div className="grid gap-3">
          {items.map((item, index) => {
            const key = buildItemKey(item);
            const downloadState = downloadStates[key];
            const status = downloadState?.status ?? "idle";
            const message = downloadState?.message;
            const previewImage = extractPreviewImage(item.html);

            const isProcessing = status === "loading";

            return (
              <div
                key={`download-queue-item-${key}`}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm shadow-slate-200/60"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-600">
                    아이템 {index + 1}
                  </span>
                  <button
                    className={downloadActionButtonClasses}
                    type="button"
                    onClick={() => {
                      void handleDownloadItem(item);
                    }}
                    disabled={isProcessing}
                  >
                    {isProcessing ? "실행 중..." : "다운로드 실행"}
                  </button>
                </div>
                {message ? (
                  <p
                    className={`text-xs ${
                      status === "error" ? "text-rose-600" : "text-emerald-600"
                    }`}
                  >
                    {message}
                  </p>
                ) : null}
                {previewImage ? (
                  <div className="mt-3">
                    <img
                      src={previewImage.src}
                      alt={previewImage.alt}
                      className="h-24 w-auto rounded-lg border border-slate-200 object-cover shadow-sm"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <p className="mt-3 text-[11px] text-slate-500">
                    이미지 미리보기를 찾지 못했습니다.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
};

export default DownloadQueueBuilder;
