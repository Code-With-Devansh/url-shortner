import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { deleteUrl } from "../api/shortUrl.api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUrls } from "../api/user.api";

const UserUrls = () => {
  const [copied, setCopied] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const {
    data: urls = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["urls"],
    queryFn: getUrls,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const BASE = import.meta.env.VITE_API_URL;
  const handleCopy = (slug) => {
    navigator.clipboard.writeText(BASE + slug);
    setCopied(slug);
    setTimeout(() => setCopied(null), 2000);
  };
  const dispatch = useDispatch();
  const handleDelete = async (id) => {
    const prev = queryClient.getQueryData(["urls"]);
    queryClient.setQueryData(["urls"], (old) =>
      old.filter((u) => u._id !== id),
    );
    setDeleteId(null);
    try {
      await deleteUrl(id);
    } catch {
      queryClient.setQueryData(["urls"], prev); // rollback on error
    }
  };

  const filtered = urls?.filter(
    (u) =>
      u.short_url.toLowerCase().includes(search.toLowerCase()) ||
      u.full_url.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="relative bg-zinc-900 border border-zinc-800 rounded overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-zinc-700" />
      {/* Table header */}
      <div className="px-7 py-4 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500">
          Your Links <span className="text-zinc-700">({filtered.length})</span>
        </p>
        <input
          type="text"
          placeholder="Search links..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 outline-none focus:border-lime-400/50 transition-all duration-200 w-full sm:w-48"
        />
      </div>
      {!filtered || filtered?.length === 0 ? (
        <div className="px-7 py-16 text-center">
          <p className="text-2xl mb-2">🔍</p>
          <p className="text-xs tracking-widest uppercase text-zinc-600">
            No links found
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800/60">
          {filtered?.map((url) => (
            <div
              key={url._id}
              className="px-7 py-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-zinc-800/30 transition-colors duration-150"
            >
              {/* Short URL + original */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lime-400 text-sm font-medium tracking-wide">
                    {BASE}
                    {url.short_url}
                  </span>
                  <span className="text-[9px] tracking-widest uppercase text-zinc-600 border border-zinc-800 rounded px-1.5 py-0.5">
                    {url.clicks} visits
                  </span>
                </div>
                <p className="text-xs text-zinc-600 truncate">{url.full_url}</p>
              </div>

              {/* Created */}
              <span className="hidden sm:block text-[10px] tracking-wider text-zinc-700 shrink-0">
                {url.created}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleCopy(url.short_url)}
                  className={`text-[10px] tracking-widest uppercase border rounded px-3 py-1.5 transition-all duration-200 cursor-pointer ${copied === url.short_url ? "border-lime-400 text-lime-400 bg-lime-400/10" : "border-zinc-700 text-zinc-500 hover:border-lime-400 hover:text-lime-400"}`}
                >
                  {copied === url.short_url ? "✓ Copied" : "Copy"}
                </button>
                <a
                  href={BASE + url.short_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] tracking-widest uppercase border border-zinc-700 text-zinc-500 hover:border-zinc-400 hover:text-zinc-300 rounded px-3 py-1.5 transition-all duration-200"
                >
                  Visit
                </a>
                <button
                  onClick={() => setDeleteId(url._id)}
                  className="text-[10px] tracking-widest uppercase border border-zinc-800 text-zinc-700 hover:border-red-500/50 hover:text-red-500 rounded px-3 py-1.5 transition-all duration-200 cursor-pointer"
                >
                  Del
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {deleteId && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="relative bg-zinc-900 border border-zinc-800 rounded overflow-hidden w-full max-w-sm">
            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-red-500" />
            <div className="px-7 py-7">
              <p className="text-sm font-bold text-zinc-100 mb-1">
                Delete this link?
              </p>
              <p className="text-xs text-zinc-500 mb-6">
                This action cannot be undone. The short link will stop working
                immediately.
              </p>
              <div className="flex gap-2.5">
                <button
                  onClick={() => handleDelete(deleteId)}
                  className="flex-1 bg-red-500 hover:bg-red-400 text-white font-bold text-xs tracking-widest uppercase rounded py-3 transition-colors duration-200 cursor-pointer"
                >
                  Delete
                </button>
                <button
                  onClick={() => setDeleteId(null)}
                  className="flex-1 border border-zinc-700 text-zinc-400 hover:text-zinc-100 font-bold text-xs tracking-widest uppercase rounded py-3 transition-colors duration-200 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserUrls;
