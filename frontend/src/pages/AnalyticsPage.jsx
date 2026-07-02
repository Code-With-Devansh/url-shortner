import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useSelector } from "react-redux";
import {
  getOverallSummary,
  getOverallTimeseries,
  getOverallBreakdown,
  getLeaderboard,
} from "../api/analytics.api";
import RangeTabs from "../components/analytics/RangeTabs";
import TimeseriesChart from "../components/analytics/TimeseriesChart";
import BreakdownChart from "../components/analytics/BreakdownChart";
import StatCard from "../components/StatCard";
import { Link2, Eye, TrendingUp, Trophy, Search } from "lucide-react";
import { useEffect } from "react";

const RANGE_DAYS = { "7d": 7, "30d": 30, "90d": 90 };

const BREAKDOWN_TABS = [
  { label: "Countries", value: "countries" },
  { label: "Devices", value: "devices" },
  { label: "Browsers", value: "browsers" },
  { label: "OS", value: "os" },
  { label: "Referrers", value: "referers" },
  { label: "Hour of Day", value: "hours" },
];

export default function AnalyticsPage() {
  const auth = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const [range, setRange] = useState("30d");
  const [breakdownBy, setBreakdownBy] = useState("countries");

  useEffect(() => {
    if (!auth.user || !auth.user.isVerified) {
      navigate({ to: "/auth" });
    }
  }, [auth.user]);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["analytics", "summary", range],
    queryFn: () => getOverallSummary(range),
    enabled: !!auth.user,
    staleTime: 30_000,
  });

  const { data: timeseries, isLoading: timeseriesLoading } = useQuery({
    queryKey: ["analytics", "timeseries", range],
    queryFn: () => getOverallTimeseries(range),
    enabled: !!auth.user,
    staleTime: 30_000,
  });

  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery({
    queryKey: ["analytics", "leaderboard", range],
    queryFn: () => getLeaderboard(range, 10),
    enabled: !!auth.user,
    staleTime: 30_000,
  });

  const { data: breakdown, isLoading: breakdownLoading } = useQuery({
    queryKey: ["analytics", "breakdown", breakdownBy, range],
    queryFn: () => getOverallBreakdown(breakdownBy, range),
    enabled: !!auth.user,
    staleTime: 30_000,
  });

  const topLink = leaderboard?.[0];
  const avgDaily = summary
    ? Math.round((summary.total / (RANGE_DAYS[range] || 30)) * 10) / 10
    : 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-lime-400/5 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-5xl mx-auto px-5 py-10">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h2
              className="text-2xl font-extrabold tracking-tight text-zinc-100"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              Analytics
            </h2>
            <p className="mt-1 text-xs text-zinc-400 tracking-wider">
              Performance across every link in your account.
            </p>
          </div>
          <RangeTabs value={range} onChange={setRange} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard
            label="Total Clicks"
            value={summaryLoading ? "—" : (summary?.total ?? 0)}
            icon={Link2}
          />
          <StatCard
            label="Unique Visitors"
            value={summaryLoading ? "—" : (summary?.uniqueVisitors ?? 0)}
            icon={Eye}
          />
          <StatCard
            label="Avg. Clicks / Day"
            value={summaryLoading ? "—" : avgDaily}
            icon={TrendingUp}
          />
          <div className="bg-zinc-900 border border-zinc-800 rounded px-5 py-4">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[9px] tracking-[0.2em] uppercase text-zinc-400">
                Top Link
              </span>
              <Trophy size={14} strokeWidth={2} className="text-lime-400/80 shrink-0" />
            </div>
            {leaderboardLoading ? (
              <p className="font-mono text-2xl font-bold text-zinc-100">—</p>
            ) : topLink ? (
              <Link
                to="/dashboard/urls/$id"
                params={{ id: topLink.urlId }}
                className="block font-mono text-sm text-lime-400 mt-1 truncate hover:underline no-underline"
              >
                {topLink.shortUrl}
              </Link>
            ) : (
              <p className="font-mono text-2xl font-bold text-zinc-100">—</p>
            )}
          </div>
        </div>

        {/* Clicks over time */}
        <div className="relative bg-zinc-900 border border-zinc-800 rounded overflow-hidden mb-6">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-zinc-700" />
          <div className="px-7 py-6">
            <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-400 mb-4">
              Clicks over time
            </p>
            {timeseriesLoading ? (
              <div className="h-56 bg-zinc-800/30 rounded animate-pulse" />
            ) : (
              <TimeseriesChart data={timeseries ?? []} />
            )}
          </div>
        </div>

        {/* Breakdown */}
        <div className="relative bg-zinc-900 border border-zinc-800 rounded overflow-hidden mb-6">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-lime-400" />
          <div className="px-7 py-6">
            <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-400 mb-4">
              Breakdown
            </p>
            <div className="flex flex-wrap gap-1.5 mb-5">
              {BREAKDOWN_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setBreakdownBy(tab.value)}
                  className={`text-[9px] tracking-widest uppercase rounded px-2.5 py-1 border transition-all duration-150 cursor-pointer ${
                    breakdownBy === tab.value
                      ? "border-lime-400/60 text-lime-400 bg-lime-400/10"
                      : "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <BreakdownChart
              by={breakdownBy}
              data={breakdown ?? []}
              loading={breakdownLoading}
            />
          </div>
        </div>

        {/* Leaderboard */}
        <div className="relative bg-zinc-900 border border-zinc-800 rounded overflow-hidden mb-6">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-zinc-700" />
          <div className="px-7 py-5">
            <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-400 mb-4">
              Top Performing Links
            </p>
            {leaderboardLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-8 bg-zinc-800/40 rounded animate-pulse"
                  />
                ))}
              </div>
            ) : leaderboard && leaderboard.length > 0 ? (
              <div className="divide-y divide-zinc-800/60">
                {leaderboard.map((l, i) => (
                  <Link
                    key={l.urlId}
                    to="/dashboard/urls/$id"
                    params={{ id: l.urlId }}
                    className="flex items-center gap-3 py-3 no-underline group"
                  >
                    <span className="text-[10px] text-zinc-500 tabular-nums w-4 shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-lime-400 truncate group-hover:underline">
                        {l.shortUrl}
                      </p>
                      <p className="text-[11px] text-zinc-400 truncate">
                        {l.fullUrl}
                      </p>
                    </div>
                    <span className="text-[10px] tracking-widest uppercase text-zinc-400 border border-zinc-800 rounded px-2 py-1 shrink-0">
                      {l.clicks} clicks
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-[10px] tracking-widest uppercase text-zinc-500 py-8 text-center">
                No links yet — create one from the Dashboard
              </p>
            )}
          </div>
        </div>
      </div>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap"
      />
    </div>
  );
}
