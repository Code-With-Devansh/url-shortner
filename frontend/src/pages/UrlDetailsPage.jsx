import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  getUrlSummary,
  getUrlTimeseries,
  getUrlBreakdown,
} from "../api/analytics.api";
import { deleteUrl } from "../api/shortUrl.api";
import RangeTabs from "../components/analytics/RangeTabs";
import TimeseriesChart from "../components/analytics/TimeseriesChart";
import BreakdownChart from "../components/analytics/BreakdownChart";
import StatCard from "../components/StatCard";
import { Link2, Eye, Search, Check, TriangleAlert } from "lucide-react";

const BREAKDOWN_TABS = [
  { label: "Countries", value: "countries" },
  { label: "Devices", value: "devices" },
  { label: "Browsers", value: "browsers" },
  { label: "OS", value: "os" },
  { label: "Referrers", value: "referers" },
  { label: "Hour of Day", value: "hours" },
];

export default function UrlDetailsPage() {
  const { id } = useParams({ strict: false });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [range, setRange] = useState("30d");
  const [breakdownBy, setBreakdownBy] = useState("countries");
  const [copied, setCopied] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
    error: summaryErrorObj,
  } = useQuery({
    queryKey: ["analytics", "url-summary", id, range],
    queryFn: () => getUrlSummary(id, range),
    enabled: !!id,
    retry: false,
  });

  const { data: timeseries, isLoading: timeseriesLoading } = useQuery({
    queryKey: ["analytics", "url-timeseries", id, range],
    queryFn: () => getUrlTimeseries(id, range),
    enabled: !!id && !summaryError,
  });

  const { data: breakdown, isLoading: breakdownLoading } = useQuery({
    queryKey: ["analytics", "url-breakdown", id, breakdownBy, range],
    queryFn: () => getUrlBreakdown(id, breakdownBy, range),
    enabled: !!id && !summaryError,
  });

  const { mutate: removeUrl, isPending: deleting } = useMutation({
    mutationFn: () => deleteUrl(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["urls"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      navigate({ to: "/dashboard" });
    },
  });

  const handleCopy = () => {
    if (!summary?.shortUrl) return;
    const value = summary.shortUrl.startsWith("http")
      ? summary.shortUrl
      : summary.shortUrl;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const notFound =
    summaryError &&
    (summaryErrorObj?.response?.status === 404 ||
      summaryErrorObj?.response?.data?.code === "URL_NOT_FOUND");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-lime-400/5 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-5xl mx-auto px-5 py-10">
        {/* Back link */}
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-[10px] tracking-widest uppercase text-zinc-400 hover:text-lime-400 transition-colors duration-200 no-underline mb-6"
        >
          ← Back to Dashboard
        </Link>

        {notFound ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded px-7 py-16 text-center">
            <Search size={22} strokeWidth={1.75} className="mx-auto mb-3 text-zinc-500" />
            <p className="text-xs tracking-widest uppercase text-zinc-400 mb-1">
              Link not found
            </p>
            <p className="text-[11px] text-zinc-500">
              It may have been deleted, or it doesn't belong to your account.
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div className="min-w-0">
                {summaryLoading ? (
                  <div className="h-7 w-64 bg-zinc-800/60 rounded animate-pulse" />
                ) : (
                  <h2
                    className="text-2xl font-extrabold tracking-tight text-lime-400 truncate"
                    style={{ fontFamily: "'Syne', sans-serif" }}
                  >
                    {summary?.shortUrl}
                  </h2>
                )}
                <p className="mt-1 text-xs text-zinc-400 tracking-wider truncate max-w-md">
                  {summaryLoading ? "Loading…" : summary?.fullUrl}
                </p>
              </div>
              <RangeTabs value={range} onChange={setRange} />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <button
                onClick={handleCopy}
                className={`text-[10px] tracking-widest uppercase border rounded px-3 py-1.5 transition-all duration-200 cursor-pointer ${
                  copied
                    ? "border-lime-400 text-lime-400 bg-lime-400/10"
                    : "border-zinc-700 text-zinc-400 hover:border-lime-400 hover:text-lime-400"
                }`}
              >
                {copied ? "✓ Copied" : "Copy Link"}
              </button>
              <a
                href={summary?.shortUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] tracking-widest uppercase border border-zinc-700 text-zinc-400 hover:border-zinc-400 hover:text-zinc-100 rounded px-3 py-1.5 transition-all duration-200 no-underline"
              >
                Visit
              </a>
              <button
                onClick={() => setConfirmingDelete(true)}
                className="text-[10px] tracking-widest uppercase border border-zinc-800 text-zinc-500 hover:border-red-500/50 hover:text-red-500 rounded px-3 py-1.5 transition-all duration-200 cursor-pointer"
              >
                Delete
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-6">
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
            </div>

            {/* Timeseries */}
            <div className="relative bg-zinc-900 border border-zinc-800 rounded overflow-hidden mb-6">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-zinc-700" />
              <div className="px-7 py-6">
                <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-400 mb-4">
                  Clicks over time
                </p>
                {timeseriesLoading ? (
                  <div className="h-40 bg-zinc-800/30 rounded animate-pulse" />
                ) : (
                  <TimeseriesChart data={timeseries ?? []} />
                )}
              </div>
            </div>

            {/* Breakdown */}
            <div className="relative bg-zinc-900 border border-zinc-800 rounded overflow-hidden mb-6">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-lime-400" />
              <div className="px-7 py-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-400">
                    Breakdown
                  </p>
                </div>
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
          </>
        )}
      </div>

      {/* Delete confirmation modal */}
      {confirmingDelete && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="relative bg-zinc-900 border border-zinc-800 rounded overflow-hidden w-full max-w-sm">
            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-red-500" />
            <div className="px-7 py-7">
              <p className="text-sm font-bold text-zinc-100 mb-1">
                Delete this link?
              </p>
              <p className="text-xs text-zinc-400 mb-6">
                This action cannot be undone. The short link will stop
                working immediately.
              </p>
              <div className="flex gap-2.5">
                <button
                  onClick={() => removeUrl()}
                  disabled={deleting}
                  className="flex-1 bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white font-bold text-xs tracking-widest uppercase rounded py-3 transition-colors duration-200 cursor-pointer"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="flex-1 border border-zinc-700 text-zinc-400 hover:text-zinc-100 font-bold text-xs tracking-widest uppercase rounded py-3 transition-colors duration-200 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap"
      />
    </div>
  );
}
