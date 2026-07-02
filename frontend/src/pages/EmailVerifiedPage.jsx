import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

export default function EmailVerifiedPage() {
  const [count, setCount] = useState(5);

  useEffect(() => {
    if (count <= 0) {
        window.close();
        return;
    };
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () =>{
        clearTimeout(t);
    } 
  }, [count]);
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 font-mono">
      {/* Glow */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-lime-400/5 rounded-full blur-3xl" />

      <div className="w-full max-w-sm relative z-10 text-center">

        {/* Logo */}
        <div className="mb-8">
          <h1 className="text-5xl font-extrabold tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
            <span className="text-lime-400">[</span>
            <span className="text-zinc-100">snip</span>
            <span className="text-lime-400">]</span>
          </h1>
        </div>

        {/* Card */}
        <div className="relative bg-zinc-900 border border-zinc-800 rounded overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-lime-400" />

          <div className="px-8 py-10 flex flex-col items-center gap-5">

            {/* Animated checkmark */}
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-full bg-lime-400/10 border border-lime-400/20 animate-ping opacity-30" />
              <div className="relative w-20 h-20 rounded-full bg-lime-400/10 border border-lime-400/25 flex items-center justify-center">
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                  <path
                    d="M8 18l7 7 13-14"
                    stroke="#aaff00"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="40"
                    strokeDashoffset="0"
                  />
                </svg>
              </div>
            </div>

            {/* Text */}
            <div>
              <h2 className="text-xl font-extrabold text-zinc-100 tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
                Email verified!
              </h2>
              <p className="mt-2 text-xs text-zinc-400 tracking-wide leading-relaxed">
                Go to the Authentication Page.
              </p>
            </div>

            {/* Divider */}
            <div className="w-full h-px bg-zinc-800" />


            {/* Countdown */}
            {count > 0 && (
              <p className="text-[10px] tracking-widest uppercase text-zinc-500">
                closing in <span className="text-lime-400/70">{count}s</span>
              </p>
            )}

          </div>
        </div>

      </div>

      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap" />
    </div>
  );
}