import { extractHighlightFromText } from "./formData";

type HighlightBadgesProps = {
  figures: string[];
  datasetValues: Record<string, string>;
};

export const HighlightBadges = ({
  figures,
  datasetValues,
}: HighlightBadgesProps) => (
  <div className="space-y-3">
    <h2 className="text-sm font-semibold text-slate-700">표시 정보</h2>
    <div className="flex flex-wrap gap-2">
      {figures.map((text) => {
        const info = extractHighlightFromText(text);

        return (
          <span
            key={text}
            className={
              info
                ? "inline-flex items-center rounded-full border border-amber-400 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm"
                : "inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
            }
          >
            {info?.display ?? text}
          </span>
        );
      })}

      {Object.entries(datasetValues).map(([label, value]) => (
        <span
          key={`${label}-${value}`}
          className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700"
        >
          {`${label}: ${value}`}
        </span>
      ))}

      {!figures.length && !Object.keys(datasetValues).length ? (
        <span className="text-xs text-slate-500">
          표시할 정보를 찾지 못했습니다.
        </span>
      ) : null}
    </div>
  </div>
);
