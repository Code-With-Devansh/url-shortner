import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getUrls } from "../api/user.api";
import react, { usestate } from "react";
import StatCard from "../components/StatCard";
import { addUrl, setUrl } from "../store/slice/allUrlsSlice";
import { useDispatch, useSelector } from "react-redux";
import UserUrls from "../components/UserUrls";
import { createShortUrl } from "../api/shortUrl.api";
import { useNavigate } from "@tanstack/react-router";
import urlSchema from "../schema/url.schema.js";

export default function DashboardPage() {
  const BASE_URL = import.meta.env.VITE_API_URL;
  const [form, setForm] = useState({ full_url: "", short_url: "" });
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const Navigate = useNavigate();
  const {
    data: url,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["urls"],
    queryFn: getUrls,
    refetchInterval: 30000,
    staleTime: 0,
  });
  const dispatch = useDispatch();
  const auth = useSelector((state) => state.auth);
  if (!isLoading && url) {
    dispatch(setUrl(url));
  }
  const handleCreate = () => {
    if(!auth.isAuthenticated) {
      Navigate({
        to: "/auth",
      })
    }
    try{
      if(form.short_url == ""){
        form.short_url = undefined;
        const validationResult = urlSchema.pick({ full_url: true }).parse(form);
      }else{
        const validationResult = urlSchema.parse(form);
      }
      const newShortUrl = createShortUrl(form.full_url, auth.user._id, form.short_url);
      if(newShortUrl){
        dispatch(addUrl(newShortUrl));
        setForm({ full_url: "", short_url: "" });
      }
    }catch(err){
      setFormError(err.message)
    }
    
  };

  return (
      <div className="min-h-screen  bg-zinc-950 text-zinc-100 font-mono">
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
            <p className="mt-1 text-xs text-zinc-500 tracking-wider">
              Manage and track all your shortened links.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <StatCard label="Total Links" value={url?.length || 0} icon="🔗" />
            <StatCard
              label="Total Visits"
              value={url?.reduce((a, u) => a + u.clicks, 0) || 0}
              icon="👁"
            />
            <StatCard
              label="Top Link"
              value={
                (BASE_URL + [...(url || [])].sort((a, b) => b.clicks - a.clicks)[0]?.short_url) ?? "—"
              }
              icon="🏆"
              link={true}
              mono
            />
            <StatCard
              link={true}
              label="Newest"
              value={(BASE_URL+url?.[0]?.short_url) ?? "—"}
              icon="✨"
              mono
            />
          </div>

          {/* Create section */}
          <div className="relative bg-zinc-900 border border-zinc-800 rounded overflow-hidden mb-6">
            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-lime-400" />
            <div className="px-7 py-6">
              <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 mb-4">
                Create a New Short Link
              </p>

              <div className="flex flex-col sm:flex-row gap-2.5">
                {/* Long URL */}
                <div className="flex-[2]">
                  <label className="block text-[9px] tracking-[0.15em] uppercase text-zinc-600 mb-1.5">
                    Destination URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://your-long-url.com/..."
                    value={form.full_url}
                    onChange={(e) => {
                      setForm({ ...form, full_url: e.target.value });
                      setFormError("");
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-lime-400 focus:ring-2 focus:ring-lime-400/10 transition-all duration-200"
                  />
                </div>

                {/* Slug */}
                <div className="flex-1">
                  <label className="block text-[9px] tracking-[0.15em] uppercase text-zinc-600 mb-1.5">
                    Custom Slug
                  </label>
                  <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded focus-within:border-lime-400 focus-within:ring-2 focus-within:ring-lime-400/10 transition-all duration-200 overflow-hidden">
                    <span className="pl-4 pr-1 text-xs text-zinc-600 whitespace-nowrap shrink-0">
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
            <UserUrls/>
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap"
          />
        </div>
      </div>
  );
}
