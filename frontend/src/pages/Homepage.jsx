import React, { useEffect, useRef, useState } from "react";
import UrlForm from "../components/UrlForm";
import axios from "axios";
import { createShortUrl } from "../api/shortUrl.api";
import urlSchema from "../schema/url.schema";
import { useSelector } from "react-redux";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorCodes, parseApiError } from "../utils/errorCodes";

const FIELD_HIGHLIGHT_MS = 2000;

const Homepage = () => {
 const { loadingUser, user } = useSelector((state) => state.auth);
  const userId = loadingUser ? null : user?.id;
  const queryClient = useQueryClient();
  const [shortUrl, setShortUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");
  // Only one field here, but kept as a boolean flash flag (rather than
  // "always show" styling) so it's consistent with the dashboard's
  // multi-field highlight behavior: briefly draw the eye, then fade.
  const [hasFieldError, setHasFieldError] = useState(false);
  const fieldErrorTimeoutRef = useRef(null);

  const flashFieldError = () => {
    if (fieldErrorTimeoutRef.current) clearTimeout(fieldErrorTimeoutRef.current);
    setHasFieldError(true);
    fieldErrorTimeoutRef.current = setTimeout(() => {
      setHasFieldError(false);
    }, FIELD_HIGHLIGHT_MS);
  };

  useEffect(() => {
    return () => {
      if (fieldErrorTimeoutRef.current) clearTimeout(fieldErrorTimeoutRef.current);
    };
  }, []);

  const handleShorten = async () => {
    
    setLoading(true);
    setError("");
    setShortUrl("");

    try {
      const validationResult = urlSchema.pick({ full_url: true }).safeParse({ full_url: url });
      if (!validationResult.success) {
        setError(validationResult.error.issues[0].message);
        flashFieldError();
        return;
      }
      // get userid from redux store
      const short_url = await createShortUrl(url, userId);
      setShortUrl(short_url);
      // Invalidates every ["urls", ...] query (UserUrls' list, whatever the
      // current search/sort/filter params are) so the new link shows up
      // without the person needing to manually refresh.
      queryClient.invalidateQueries({ queryKey: ["urls"] });
    } catch (err) {
      if (!err.apiCode) {
        // Shouldn't normally happen here (validation is handled above and
        // returns early), but keep a safe fallback just in case.
        setError(err.message || "An error occurred while shortening the URL");
        flashFieldError();
        return;
      }

      const { code, fieldErrors, message } = parseApiError(err);

      if (code === ErrorCodes.CONFLICT) {
        // Slug conflicts can't actually come from this form (no custom slug
        // field here), but handle it defensively without flashing the URL
        // input - that's not what's wrong.
        setError("That custom slug is already taken. Try a different one.");
      } else if (code === ErrorCodes.URL_INVALID_TARGET) {
        setError("That doesn't look like a valid http(s) URL.");
        flashFieldError();
      } else if (fieldErrors?.url) {
        setError(fieldErrors.url);
        flashFieldError();
      } else {
        // Non-field errors (rate limiting, server errors) get the message
        // without highlighting the input - it's not the field's fault.
        setError(message);
      }
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
              hasFieldError={hasFieldError}
              clearFieldError={() => setHasFieldError(false)}
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