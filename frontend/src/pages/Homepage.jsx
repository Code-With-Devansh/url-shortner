import React, { useState } from "react";
import UrlForm from "../components/UrlForm";
import axios from "axios";
import { createShortUrl } from "../api/shortUrl.api";
import urlSchema from "../schema/url.schema";
import { useSelector } from "react-redux";

const Homepage = () => {
 const { loadingUser, user } = useSelector((state) => state.auth);
  const userId = loadingUser ? null : user?.id;
  const [shortUrl, setShortUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");

  const handleShorten = async () => {
    
    setLoading(true);
    setError("");
    setShortUrl("");

    try {
      const validationResult = urlSchema.pick({ full_url: true }).safeParse({ full_url: url });
      if (!validationResult.success) {
        throw new Error(validationResult.error.issues[0].message);
      }
      // get userid from redux store
      const short_url = await createShortUrl(url, userId);
      setShortUrl(short_url);
    } catch (err) {
      setError(err.message || "An error occurred while shortening the URL");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center font-mono">
      {/* Header */}
      <header className="text-center pt-16 pb-10 px-6">
        <h1
          className="text-6xl sm:text-7xl font-extrabold tracking-tight leading-none"
          style={{ fontFamily: "'Syne', sans-serif" }}
        >
          <span className="text-lime-400">[</span>
          snip
          <span className="text-lime-400">]</span>
        </h1>
        <p className="mt-3 text-xs tracking-widest uppercase text-zinc-400">
          paste long. get short.
        </p>
      </header>

      {/* Main */}
      <main className="w-full max-w-xl px-5 flex flex-col gap-6">
        {/* Card */}
        <div className="relative bg-zinc-900 border border-zinc-800 rounded overflow-hidden">
          {/* Accent bar */}
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-lime-400" />

          <div className="p-7 sm:p-8">
            {/* Input section */}
            <UrlForm
              handleShorten={handleShorten}
              url={url}
              setUrl={setUrl}
              error={error}
              setError={setError}
              loading={loading}
              setLoading={setLoading}
            />
            {/* Result section */}
            {shortUrl && (
              <div className="mt-7 pt-7 border-t border-zinc-800">
                <label className="block text-[10px] tracking-[0.2em] uppercase text-zinc-400 mb-2.5">
                  Your Short URL
                </label>
                <div className="flex items-center gap-2.5">
                  <a
                    href={shortUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 min-w-0 bg-zinc-950 border border-lime-400 rounded px-4 py-3.5 text-sm text-lime-400 font-medium truncate hover:bg-lime-400/5 transition-colors duration-200"
                  >
                    {shortUrl}
                  </a>
                  <button
                    onClick={handleCopy}
                    className={`shrink-0 border rounded px-4 py-3.5 text-[11px] font-bold tracking-widest uppercase transition-all duration-200 cursor-pointer ${
                      copied
                        ? "border-lime-400 text-lime-400 bg-lime-400/10"
                        : "border-zinc-700 text-zinc-400 hover:border-lime-400 hover:text-lime-400"
                    }`}
                  >
                    {copied ? "✓ Copied" : "Copy"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-center text-zinc-400 text-[11px] tracking-wide">
          <span className="flex items-center gap-1.5 px-4">
            ⚡ Instant redirect
          </span>
          <span className="w-px h-4 bg-zinc-800" />
          <span className="flex items-center gap-1.5 px-4">
            🔗 Permanent links
          </span>
          <span className="w-px h-4 bg-zinc-800" />
          <span className="flex items-center gap-1.5 px-4">
            📋 One-click copy
          </span>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-10 text-[10px] tracking-widest uppercase text-zinc-400">
        built with ♥ — link shortener
      </footer>

      {/* Google Font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap"
      />
    </div>
  );
};

export default Homepage;
