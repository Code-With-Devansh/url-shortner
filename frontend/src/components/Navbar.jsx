import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useSelector } from "react-redux";
import Spinner from "./Spinner";
import UserMenu from "./UserMenu";

export default function Navbar({ setSideOpen }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, loading } = useSelector((state) => state.auth);
  return (
    <nav className="sticky top-0 z-50 w-full bg-zinc-900 border-b border-zinc-800 font-mono">
      <div className="h-14 px-5 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <Link
            to="/"
            className="text-xl font-extrabold tracking-tight leading-none no-underline"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            <span className="text-lime-400">[</span>
            <span className="text-zinc-100">snip</span>
            <span className="text-lime-400">]</span>
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <Link
            to="/"
            className="text-[11px] tracking-widest uppercase text-zinc-400 hover:text-zinc-100 transition-colors duration-200 px-3 py-1.5 no-underline"
          >
            Home
          </Link>

          {user && (
            <>
              <Link
                to="/dashboard"
                className="text-[11px] tracking-widest uppercase text-zinc-400 hover:text-zinc-100 transition-colors duration-200 px-3 py-1.5 no-underline"
                activeProps={{ className: "text-lime-400" }}
              >
                Dashboard
              </Link>
              <Link
                to="/analytics"
                className="text-[11px] tracking-widest uppercase text-zinc-400 hover:text-zinc-100 transition-colors duration-200 px-3 py-1.5 no-underline"
                activeProps={{ className: "text-lime-400" }}
              >
                Analytics
              </Link>
            </>
          )}

          <div className="w-px h-4 bg-zinc-700 mx-2" />

          {loading ? (
            <Spinner />
          ) : user ? (
            <UserMenu user={user} />
          ) : (
            <Link
              to="/auth"
              className="text-[11px] tracking-widest uppercase font-bold bg-lime-400 hover:bg-lime-300 text-zinc-950 rounded px-4 py-1.5 transition-all duration-200 hover:-translate-y-px no-underline"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
