import React, { useState, useRef, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { deleteUrl } from "../api/shortUrl.api";
import { getUrls } from "../api/user.api";


const BASE = import.meta.env.VITE_API_URL;

const SORT_OPTIONS = [
  { label: "Newest", sortBy: "createdAt", order: "desc" },
  { label: "Oldest", sortBy: "createdAt", order: "asc" },
  { label: "Most Clicks", sortBy: "clicks", order: "desc" },
  { label: "A → Z", sortBy: "title", order: "asc" },
];

const FILTER_OPTIONS = [
  { label: "All", value: undefined },
  { label: "Active", value: "true" },
  { label: "Inactive", value: "false" },
];


const useDebounce = (value, delay = 400) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};


const UrlRow = React.memo(({ url, onCopy, onDelete, copied }) => {
  const isCopied = copied === url.short_url;

  return (
    <div className="px-7 py-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-zinc-800/30 transition-colors duration-150 group">
      {/* Short URL + original */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-lime-400 text-sm font-medium tracking-wide font-mono">
            {url.short_url}
          </span>
          <span className="text-[9px] tracking-widest uppercase text-zinc-600 border border-zinc-800 rounded px-1.5 py-0.5">
            {url.clicks} visits
          </span>
          {!url.isActive && (
            <span className="text-[9px] tracking-widest uppercase text-red-500/70 border border-red-500/20 rounded px-1.5 py-0.5">
              inactive
            </span>
          )}
          
        </div>
        <p className="text-xs text-zinc-600 truncate">{url.full_url}</p>
      </div>

      {/* Created */}
      <span className="hidden sm:block text-[10px] tracking-wider text-zinc-700 shrink-0 tabular-nums">
        {new Date(url.createdAt).toLocaleDateString("en-US", {
          month: "short", day: "numeric", year: "numeric"
        })}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onCopy(url.short_url)}
          className={`text-[10px] tracking-widest uppercase border rounded px-3 py-1.5 transition-all duration-200 cursor-pointer ${
            isCopied
              ? "border-lime-400 text-lime-400 bg-lime-400/10"
              : "border-zinc-700 text-zinc-500 hover:border-lime-400 hover:text-lime-400"
          }`}
        >
          {isCopied ? "✓ Copied" : "Copy"}
        </button>
        <a
          href={`${url.short_url}`}
          target="_blank"
          rel="noreferrer"
          className="text-[10px] tracking-widest uppercase border border-zinc-700 text-zinc-500 hover:border-zinc-400 hover:text-zinc-300 rounded px-3 py-1.5 transition-all duration-200"
        >
          Visit
        </a>
        <button
          onClick={() => onDelete(url.id)}
          className="text-[10px] tracking-widests uppercase border border-zinc-800 text-zinc-700 hover:border-red-500/50 hover:text-red-500 rounded px-3 py-1.5 transition-all duration-200 cursor-pointer"
        >
          Del
        </button>
      </div>
    </div>
  );
});


const SkeletonRow = () => (
  <div className="px-7 py-4 flex flex-col sm:flex-row sm:items-center gap-3 animate-pulse">
    <div className="flex-1 min-w-0 space-y-2">
      <div className="h-3.5 w-48 bg-zinc-800 rounded" />
      <div className="h-3 w-72 bg-zinc-800/60 rounded" />
    </div>
    <div className="h-3 w-20 bg-zinc-800/40 rounded hidden sm:block" />
    <div className="flex gap-2">
      <div className="h-7 w-14 bg-zinc-800 rounded" />
      <div className="h-7 w-14 bg-zinc-800 rounded" />
      <div className="h-7 w-10 bg-zinc-800 rounded" />
    </div>
  </div>
);


const DeleteModal = ({ onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center z-50 px-4">
    <div className="relative bg-zinc-900 border border-zinc-800 rounded overflow-hidden w-full max-w-sm">
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-red-500" />
      <div className="px-7 py-7">
        <p className="text-sm font-bold text-zinc-100 mb-1">Delete this link?</p>
        <p className="text-xs text-zinc-500 mb-6">
          This action cannot be undone. The short link will stop working immediately.
        </p>
        <div className="flex gap-2.5">
          <button
            onClick={onConfirm}
            className="flex-1 bg-red-500 hover:bg-red-400 text-white font-bold text-xs tracking-widest uppercase rounded py-3 transition-colors duration-200 cursor-pointer"
          >
            Delete
          </button>
          <button
            onClick={onCancel}
            className="flex-1 border border-zinc-700 text-zinc-400 hover:text-zinc-100 font-bold text-xs tracking-widests uppercase rounded py-3 transition-colors duration-200 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
);


const UserUrls = () => {
  const [copied, setCopied] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [search, setSearch] = useState("");
  const [sortIndex, setSortIndex] = useState(0);
  const [isActiveFilter, setIsActiveFilter] = useState(undefined);

  const debouncedSearch = useDebounce(search, 400);
  const queryClient = useQueryClient();
  const sentinelRef = useRef(null);

  const { sortBy, order } = SORT_OPTIONS[sortIndex];

  // ── Infinite Query ──
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useInfiniteQuery({
    queryKey: ["urls", debouncedSearch, sortBy, order, isActiveFilter],
    queryFn: ({ pageParam }) =>
      getUrls({
        cursor: pageParam,
        search: debouncedSearch || undefined,
        sortBy,
        order,
        isActive: isActiveFilter,
        limit: 20,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.nextCursor : undefined,
    staleTime: 60_000,
  });

  const urls = data?.pages.flatMap((p) => p.data) ?? [];
  const totalLoaded = urls.length;

  // ── Intersection Observer for infinite scroll ──
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleCopy = useCallback((slug) => {
    navigator.clipboard.writeText(`${slug}`);
    setCopied(slug);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const { mutate: handleDelete } = useMutation({
    mutationFn: deleteUrl,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["urls"] });
      const snapshot = queryClient.getQueryData(["urls", debouncedSearch, sortBy, order, isActiveFilter]);
      queryClient.setQueryData(
        ["urls", debouncedSearch, sortBy, order, isActiveFilter],
        (old) => ({
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            data: page.data.filter((u) => u.id !== id),
          })),
        })
      );
      setDeleteId(null);
      return { snapshot };
    },
    onError: (_err, _id, ctx) => {
      queryClient.setQueryData(
        ["urls", debouncedSearch, sortBy, order, isActiveFilter],
        ctx.snapshot
      );
    },
  });

  const handleSortChange = (idx) => setSortIndex(idx);

  // ── Render ──
  return (
    <div className="relative bg-zinc-900 border border-zinc-800 rounded overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-zinc-700" />

      {/* ── Header ── */}
      <div className="px-7 py-4 border-b border-zinc-800 flex flex-col gap-3">
        {/* Row 1: title + search */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500">
            Your Links{" "}
            <span className="text-zinc-700">({totalLoaded}{hasNextPage ? "+" : ""})</span>
          </p>
          <input
            type="text"
            placeholder="Search links..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 outline-none focus:border-lime-400/50 transition-all duration-200 w-full sm:w-48"
          />
        </div>

        {/* Row 2: sort + filter pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sort */}
          <div className="flex items-center gap-1 flex-wrap">
            {SORT_OPTIONS.map((opt, i) => (
              <button
                key={opt.label}
                onClick={() => handleSortChange(i)}
                className={`text-[9px] tracking-widest uppercase rounded px-2.5 py-1 border transition-all duration-150 cursor-pointer ${
                  sortIndex === i
                    ? "border-lime-400/60 text-lime-400 bg-lime-400/10"
                    : "border-zinc-800 text-zinc-600 hover:border-zinc-600 hover:text-zinc-400"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="w-px h-4 bg-zinc-800 mx-1 hidden sm:block" />

          {/* Active filter */}
          <div className="flex items-center gap-1">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                onClick={() => setIsActiveFilter(opt.value)}
                className={`text-[9px] tracking-widest uppercase rounded px-2.5 py-1 border transition-all duration-150 cursor-pointer ${
                  isActiveFilter === opt.value
                    ? "border-zinc-400/60 text-zinc-300 bg-zinc-700/30"
                    : "border-zinc-800 text-zinc-600 hover:border-zinc-600 hover:text-zinc-400"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      {isError ? (
        <div className="px-7 py-16 text-center">
          <p className="text-2xl mb-2">⚠️</p>
          <p className="text-xs tracking-widest uppercase text-red-500/70">
            {error?.message ?? "Failed to load links"}
          </p>
        </div>
      ) : isLoading ? (
        <div className="divide-y divide-zinc-800/60">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : urls.length === 0 ? (
        <div className="px-7 py-16 text-center">
          <p className="text-2xl mb-2">🔍</p>
          <p className="text-xs tracking-widests uppercase text-zinc-600">
            No links found
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800/60">
          {urls.map((url) => (
            <UrlRow
              key={url.id}
              url={url}
              copied={copied}
              onCopy={handleCopy}
              onDelete={setDeleteId}
            />
          ))}
        </div>
      )}

      {/* ── Infinite scroll sentinel ── */}
      <div ref={sentinelRef} className="py-2">
        {isFetchingNextPage && (
          <div className="divide-y divide-zinc-800/60">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        )}
        {!hasNextPage && urls.length > 0 && (
          <p className="text-center text-[9px] tracking-widest uppercase text-zinc-800 py-4">
            — end of list —
          </p>
        )}
      </div>

      {/* ── Delete modal ── */}
      {deleteId && (
        <DeleteModal
          onConfirm={() => handleDelete(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
};

export default UserUrls;