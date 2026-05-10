import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useSelector } from "react-redux";

export default function Navbar({ setSideOpen }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isAuthenticated } = useSelector((state) => state.auth);

  return (
    <nav className="sticky top-0 z-50 w-full bg-zinc-900 border-b border-zinc-800 font-mono">
      <div className="h-14 px-5 flex items-center justify-between">

        {/* Left — hamburger + logo */}
        <div className="flex items-center gap-5">
          {/* <button
            onClick={() => setSideOpen((o) => !o)}
            className="text-zinc-500 hover:text-zinc-200 transition-colors duration-200 cursor-pointer p-1 -ml-1"
            aria-label="Toggle sidebar"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect y="2"  width="18" height="1.5" rx="1" fill="currentColor"/>
              <rect y="8"  width="18" height="1.5" rx="1" fill="currentColor"/>
              <rect y="14" width="18" height="1.5" rx="1" fill="currentColor"/>
            </svg>
          </button> */}

          <Link to="/" className="text-xl font-extrabold tracking-tight leading-none no-underline" style={{ fontFamily: "'Syne', sans-serif" }}>
            <span className="text-lime-400">[</span>
            <span className="text-zinc-100">snip</span>
            <span className="text-lime-400">]</span>
          </Link>
        </div>

        {/* Right — nav links + avatar */}
        <div className="flex items-center gap-1">
          <Link to="/" className="text-[11px] tracking-widest uppercase text-zinc-500 hover:text-zinc-100 transition-colors duration-200 px-3 py-1.5 no-underline">
            Home
          </Link>


          <div className="w-px h-4 bg-zinc-700 mx-2" />

          {isAuthenticated ? (
            <div className="w-8 h-8 rounded-full bg-lime-400 flex items-center justify-center text-zinc-950 text-xs font-bold cursor-pointer hover:bg-lime-300 transition-colors duration-200 select-none">
              U
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Link to="/auth" className="text-[11px] tracking-widest uppercase font-bold bg-lime-400 hover:bg-lime-300 text-zinc-950 rounded px-4 py-1.5 transition-all duration-200 hover:-translate-y-px no-underline">
                Sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}