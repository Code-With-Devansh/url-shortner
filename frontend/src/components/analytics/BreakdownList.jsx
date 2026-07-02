import React from "react";

const LABELS = {
  countries: "Country",
  devices: "Device",
  browsers: "Browser",
  os: "OS",
  referers: "Referrer",
  hours: "Hour",
};

const formatName = (by, name) => {
  if (!name) return "Unknown";
  if (by === "hours") return `${name}:00`;
  if (by === "referers" && name === "direct") return "Direct / none";
  return name;
};

const BreakdownList = ({ by, data = [], loading }) => {
  const max = Math.max(1, ...data.map((d) => d.count));

  if (loading) {
    return (
      <div className="space-y-2.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-6 bg-zinc-800/50 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <p className="text-[10px] tracking-widest uppercase text-zinc-700 py-6 text-center">
        No {LABELS[by]?.toLowerCase() || "data"} recorded yet
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={`${d.name}-${i}`} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-[11px] text-zinc-400 truncate">
            {formatName(by, d.name)}
          </span>
          <div className="flex-1 h-2 bg-zinc-800/60 rounded overflow-hidden">
            <div
              className="h-full bg-lime-400/70 rounded"
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-zinc-500">
            {d.count}
          </span>
        </div>
      ))}
    </div>
  );
};

export default BreakdownList;
