import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import StatCard from "../components/StatCard";
import { useSelector } from "react-redux";
import UserUrls from "../components/UserUrls";
import { createShortUrl } from "../api/shortUrl.api";
import { useNavigate, Link } from "@tanstack/react-router";
import urlSchema from "../schema/url.schema.js";
import { getOverallSummary, getOverallTimeseries } from "../api/analytics.api";
import TimeseriesChart from "../components/analytics/TimeseriesChart";
import { Link2, Eye, TrendingUp } from "lucide-react";
import { ErrorCodes, parseApiError } from "../utils/errorCodes";

// Backend validation errors are keyed by request-body field name (`url`,
// `slug`), but the form/schema use different names (`full_url`,
// `short_url`) - this bridges the two so highlighting always lands on the
// right input regardless of which side named the field.
const BACKEND_TO_FORM_FIELD = {
  url: "full_url",
  slug: "short_url",
};

const FIELD_HIGHLIGHT_MS = 2000;

export default function DashboardPage() {
  const BASE_URL = import.meta.env.VITE_API_URL;
  const [form, setForm] = useState({ full_url: "", short_url: "" });
  const [formError, setFormError] = useState("");
  // Which form field to briefly highlight as the source of a validation
  // error (e.g. "full_url" or "short_url"), cleared automatically after
  // FIELD_HIGHLIGHT_MS.
  const [errorField, setErrorField] = useState(null);
  const errorFieldTimeoutRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const auth = useSelector((state) => state.auth);

  const flashFieldError = (field) => {
    if (errorFieldTimeoutRef.current) clearTimeout(errorFieldTimeoutRef.current);
    setErrorField(field);
    errorFieldTimeoutRef.current = setTimeout(() => {
      setErrorField(null);
    }, FIELD_HIGHLIGHT_MS);
  };

  useEffect(() => {
    return () => {
      if (errorFieldTimeoutRef.current) clearTimeout(errorFieldTimeoutRef.current);
    };
  }, []);

  // Quick analytics — fixed 7-day window, full detail lives on /analytics
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["analytics", "summary", "7d"],
    queryFn: () => getOverallSummary("7d"),
    enabled: !!auth.user,
    staleTime: 30_000,
  });

  const { data: timeseries, isLoading: timeseriesLoading } = useQuery({
    queryKey: ["analytics", "timeseries", "7d"],
    queryFn: () => getOverallTimeseries("7d"),
    enabled: !!auth.user,
    staleTime: 30_000,
  });

  const handleCreate = async () => {
    if (!auth.user) {
      navigate({ to: "/auth" });
      return;
    }

    setFormError("");

    // Client-side validation first, using safeParse so we can pinpoint
    // exactly which field to highlight instead of just throwing.
    const schema =
      form.short_url === ""
        ? urlSchema.pick({ full_url: true })
        : urlSchema;
    const validationResult = schema.safeParse(form);
    if (!validationResult.success) {
      const issue = validationResult.error.issues[0];
      setFormError(issue.message);
      flashFieldError(issue.path[0]);
      return;
    }

    try {
      setLoading(true);
      const newShortUrl = await createShortUrl(
        form.full_url,
        auth.user.id,
        form.short_url,
      );
      if (newShortUrl) {
        await queryClient.invalidateQueries({ queryKey: ["urls"] });
        await queryClient.invalidateQueries({ queryKey: ["analytics"] });
        setForm({ full_url: "", short_url: "" });
      }
    } catch (err) {
      const { code, fieldErrors, message } = parseApiError(err);

      if (code === ErrorCodes.CONFLICT) {
        setFormError("That custom slug is already taken. Try a different one.");
        flashFieldError("short_url");
      } else if (code === ErrorCodes.URL_INVALID_TARGET) {
        setFormError("That doesn't look like a valid http(s) URL.");
        flashFieldError("full_url");
      } else if (fieldErrors && Object.keys(fieldErrors).length > 0) {
        // VALIDATION_FAILED - backend names fields `url`/`slug`; map back to
        // the form's `full_url`/`short_url` for highlighting purposes.
        const [backendField, fieldMessage] = Object.entries(fieldErrors)[0];
        setFormError(fieldMessage);
        flashFieldError(BACKEND_TO_FORM_FIELD[backendField] ?? backendField);
      } else {
        setFormError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-lime-400/5 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-5xl mx-auto px-5 py-10">
        {/* Page header */}
        <div className="mb-8">
          <h2
            className="text-2xl font-extrabold tracking-tight text-zinc-100"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            Dashboard
          </h2>
          <p className="mt-1 text-xs text-zinc-400 tracking-wider">
            Manage and track all your shortened links.
          </p>
        </div>

        {/* Quick analytics strip */}
        <div className="relative bg-zinc-900 border border-zinc-800 rounded overflow-hidden mb-6">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-zinc-700" />
          <div className="px-7 py-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-400">
                Last 7 Days
              </p>
              <Link
                to="/analytics"
                className="text-[9px] tracking-widest uppercase text-lime-400 hover:underline no-underline"
              >
                View Full Analytics →
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
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
                value={
                  summaryLoading
                    ? "—"
                    : Math.round(((summary?.total ?? 0) / 7) * 10) / 10
                }
                icon={TrendingUp}
              />
            </div>

            {timeseriesLoading ? (
              <div className="h-32 bg-zinc-800/30 rounded animate-pulse" />
            ) : (
              <TimeseriesChart data={timeseries ?? []} height={140} />
            )}
          </div>
        </div>

        {/* Create section */}
        <div className="relative bg-zinc-900 border border-zinc-800 rounded overflow-hidden mb-6">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-lime-400" />
          <div className="px-7 py-6">
            <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-400 mb-4">
              Create a New Short Link
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5">
              {/* Long URL */}
              <div className="flex-[2]">
                <label className="block text-[9px] tracking-[0.15em] uppercase text-zinc-400 mb-1.5">
                  Destination URL
                </label>
                <input
                  type="text"
                  placeholder="https://your-long-url.com/..."
                  value={form.full_url}
                  onChange={(e) => {
                    setForm({ ...form, full_url: e.target.value });
                    setFormError("");
                    setErrorField(null);
                  }}
                  className={`w-full bg-zinc-950 border rounded px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:ring-2 transition-all duration-200 ${
                    errorField === "full_url"
                      ? "border-red-500 ring-2 ring-red-500/20 animate-pulse"
                      : "border-zinc-800 focus:border-lime-400 focus:ring-lime-400/10"
                  }`}
                />
              </div>

              {/* Slug */}
              <div className="flex-1">
                <label className="block text-[9px] tracking-[0.15em] uppercase text-zinc-400 mb-1.5">
                  Custom Slug
                </label>
                <div className={`flex items-center bg-zinc-950 border rounded transition-all duration-200 overflow-hidden ${
                  errorField === "short_url"
                    ? "border-red-500 ring-2 ring-red-500/20 animate-pulse"
                    : "border-zinc-800 focus-within:border-lime-400 focus-within:ring-2 focus-within:ring-lime-400/10"
                }`}>
                  <span className="pl-4 pr-1 text-xs text-zinc-400 whitespace-nowrap shrink-0">
                    {BASE_URL}
                  </span>
                  <input
                    type="text"
                    placeholder="my-slug"
                    value={form.short_url}
                    onChange={(e) => {
                      setForm({
                        ...form,
                        short_url: e.target.value.replace(/\s/g, "-"),
                      });
                      setFormError("");
                      setErrorField(null);
                    }}
                    className="flex-1 bg-transparent py-3 pr-4 text-sm text-lime-400 placeholder-zinc-600 outline-none min-w-0"
                  />
                </div>
              </div>

              {/* Button */}
              <div className="flex items-end">
                <button
                  onClick={handleCreate}
                  disabled={loading}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-lime-400 hover:bg-lime-300 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-bold text-xs tracking-widest uppercase rounded px-6 py-3 transition-all duration-200 hover:-translate-y-px active:translate-y-0 cursor-pointer whitespace-nowrap"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
                  ) : (
                    "+ Create"
                  )}
                </button>
              </div>
            </div>

            {formError && (
              <p className="mt-2.5 text-xs text-red-400 tracking-wide">
                ⚠ {formError}
              </p>
            )}
          </div>
        </div>

        {/* Links table */}
        <UserUrls />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap"
        />
      </div>
    </div>
  );
}