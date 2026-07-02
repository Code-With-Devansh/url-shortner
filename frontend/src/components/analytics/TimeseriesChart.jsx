import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const pickDate = (d) => d.date ?? d.day ?? d._id ?? d.timestamp;
const pickValue = (d) => d.clicks ?? d.count ?? d.total ?? 0;

const formatDay = (raw) => {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw).slice(0, 10);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-[11px]">
      <p className="text-zinc-400 mb-1 tracking-wide">{label}</p>
      <p className="text-lime-400 font-bold">{payload[0].value} clicks</p>
    </div>
  );
};

const TimeseriesChart = ({ data = [], height = 220 }) => {
  const points = useMemo(
    () =>
      (data || []).map((d) => ({
        label: formatDay(pickDate(d)),
        clicks: pickValue(d),
      })),
    [data],
  );

  if (points.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-[10px] tracking-widest uppercase text-zinc-500"
        style={{ height }}
      >
        No data for this range
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={points} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#27272a" strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tick={{ fill: "#a1a1aa", fontSize: 9, fontFamily: "monospace" }}
          axisLine={{ stroke: "#27272a" }}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={20}
        />
        <YAxis
          tick={{ fill: "#a1a1aa", fontSize: 9, fontFamily: "monospace" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={32}
        />
        <Tooltip cursor={{ fill: "#a3e63512" }} content={<CustomTooltip />} />
        <Bar dataKey="clicks" fill="#a3e635" radius={[2, 2, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default TimeseriesChart;
