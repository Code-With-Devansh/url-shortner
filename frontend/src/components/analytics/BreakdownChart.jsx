import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

// Lime-forward palette that stays legible on zinc-950/900 panels.
const COLORS = [
  "#a3e635", // lime-400
  "#65a30d", // lime-600
  "#facc15", // yellow-400
  "#38bdf8", // sky-400
  "#f472b6", // pink-400
  "#fb923c", // orange-400
  "#a78bfa", // violet-400
  "#5eead4", // teal-300
];

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

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-[11px]">
      <p className="text-zinc-300 mb-0.5">{p.name}</p>
      <p className="text-lime-400 font-bold">{p.value} clicks</p>
    </div>
  );
};

const LoadingState = () => (
  <div className="space-y-2.5">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="h-6 bg-zinc-800/50 rounded animate-pulse" />
    ))}
  </div>
);

const EmptyState = ({ by }) => (
  <p className="text-[10px] tracking-widest uppercase text-zinc-500 py-10 text-center">
    No {LABELS[by]?.toLowerCase() || "data"} recorded yet
  </p>
);
const toLocalHourRows = (data) => {
  const offsetHours = Math.floor(-new Date().getTimezoneOffset() / 60);

  const counts = new Array(24).fill(0);
  (data || []).forEach(({ name, count }) => {
    const utcHour = parseInt(name, 10);
    if (Number.isNaN(utcHour)) return;
    const localHour = (((utcHour + offsetHours) % 24) + 24) % 24;
    counts[localHour] += count;
  });

  return counts.map((count, hour) => ({
    name: hour.toString().padStart(2, "0"),
    count,
  }));
};
const BreakdownChart = ({ by, data = [], loading, height = 240 }) => {
  const rows = useMemo(() => {
    if (by === "hours") {
      // Chronological order, not ranked by count - it's a cycle, not a leaderboard.
      return toLocalHourRows(data).map((d) => ({
        name: formatName(by, d.name),
        count: d.count,
      }));
    }
    return (data || [])
      .map((d) => ({ name: formatName(by, d.name), count: d.count }))
      .sort((a, b) => b.count - a.count);
  }, [data, by]);

  const hasData =
    by === "hours" ? rows.some((r) => r.count > 0) : rows.length > 0;

  if (loading) return <LoadingState />;
  if (!rows.length) return <EmptyState by={by} />;

  // Hour-of-day is a sequence across a cycle, not parts of one whole —
  // a bar chart tells that story better than a pie.
  if (by === "hours") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={rows}
          margin={{ top: 8, right: 4, left: -20, bottom: 0 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="#27272a"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="name"
            tick={{ fill: "#a1a1aa", fontSize: 9, fontFamily: "monospace" }}
            axisLine={{ stroke: "#27272a" }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            tick={{ fill: "#a1a1aa", fontSize: 9, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={32}
          />
          <Tooltip cursor={{ fill: "#a3e63512" }} content={<CustomTooltip />} />
          <Bar
            dataKey="count"
            fill="#a3e635"
            radius={[2, 2, 0, 0]}
            maxBarSize={20}
          />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Collapse a long tail into "Other" so the pie stays readable.
  const MAX_SLICES = 6;
  const top = rows.slice(0, MAX_SLICES);
  const rest = rows.slice(MAX_SLICES);
  const restTotal = rest.reduce((sum, r) => sum + r.count, 0);
  const sliceData =
    restTotal > 0 ? [...top, { name: "Other", count: restTotal }] : top;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <ResponsiveContainer width="100%" height={height} className="sm:flex-1">
        <PieChart>
          <Pie
            data={sliceData}
            dataKey="count"
            nameKey="name"
            innerRadius="52%"
            outerRadius="80%"
            paddingAngle={2}
            stroke="#18181b"
            strokeWidth={2}
          >
            {sliceData.map((entry, i) => (
              <Cell
                key={entry.name}
                fill={
                  entry.name === "Other" ? "#3f3f46" : COLORS[i % COLORS.length]
                }
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend / ranked list */}
      <div className="w-full sm:w-52 shrink-0 space-y-2">
        {sliceData.map((entry, i) => (
          <div key={entry.name} className="flex items-center gap-2 text-[11px]">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{
                background:
                  entry.name === "Other"
                    ? "#3f3f46"
                    : COLORS[i % COLORS.length],
              }}
            />
            <span className="text-zinc-400 truncate flex-1">{entry.name}</span>
            <span className="text-zinc-400 tabular-nums">{entry.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BreakdownChart;
