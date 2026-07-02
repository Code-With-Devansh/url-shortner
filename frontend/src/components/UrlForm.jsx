import React, { useState } from 'react'

const UrlForm = ({handleShorten, url, setUrl, error, setError, loading, setLoading}) => {
    
      
  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleShorten();
  };

  return (
                <form onSubmit={(e) => { e.preventDefault(); handleShorten(); }}>
              <label className="block text-[10px] tracking-[0.2em] uppercase text-zinc-400 mb-2.5">
                Your Long URL
              </label>

              <div className="flex gap-2.5 flex-col sm:flex-row">
                <input
                  type="text"
                  placeholder="https://your-very-long-url.com/goes/here"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setError(""); }}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-4 py-3.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-lime-400 focus:ring-2 focus:ring-lime-400/10 transition-all duration-200"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center gap-2 bg-lime-400 hover:bg-lime-300 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-bold text-xs tracking-widest uppercase rounded px-5 py-3.5 transition-all duration-200 hover:-translate-y-px active:translate-y-0 cursor-pointer"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
                  ) : (
                    "Shorten →"
                  )}
                </button>
              </div>

              {error && (
                <p className="mt-2.5 text-xs text-red-400 tracking-wide">
                  ⚠ {error}
                </p>
              )}
            </form>

  )
}

export default UrlForm