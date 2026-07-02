import React from "react";

const RANGES = [
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
  { label: "90D", value: "90d" },
];

const RangeTabs = ({ value, onChange }) => (
  <div className="flex items-center gap-1 border border-zinc-800 rounded p-0.5 bg-zinc-950/60">
    {RANGES.map((r) => (
      <button
        key={r.value}
        onClick={() => onChange(r.value)}
        className={`text-[9px] tracking-widest uppercase rounded px-2.5 py-1 transition-all duration-150 cursor-pointer ${
          value === r.value
            ? "bg-lime-400 text-zinc-950 font-bold"
            : "text-zinc-500 hover:text-zinc-200"
        }`}
      >
        {r.label}
      </button>
    ))}
  </div>
);

export default RangeTabs;
