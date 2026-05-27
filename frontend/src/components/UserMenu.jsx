import React, { useRef, useState, useEffect } from 'react'
import { logout } from '../store/slice/authSlice';
import { useDispatch } from 'react-redux';
import { Link } from '@tanstack/react-router';
import { logoutUser } from '../api/user.api';
const UserMenu = ({ user }) =>{
  const dispatch = useDispatch();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async() => {
    setOpen(false);
    await logoutUser()
    dispatch(logout());
  };

  return (
    <div ref={ref} className="relative">
      {/* Avatar button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="w-8 h-8 rounded-full bg-lime-400 hover:bg-lime-300 flex items-center justify-center text-zinc-950 text-xs font-bold transition-colors duration-200 select-none cursor-pointer border-none outline-none focus-visible:ring-2 focus-visible:ring-lime-400"
      >
        {user.name?.[0]?.toUpperCase() ?? "U"}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-10 w-44 bg-zinc-900 border border-zinc-700 rounded-md overflow-hidden shadow-lg z-50">
          {/* User info header */}
          <div className="px-3 py-2 border-b border-zinc-800">
            <p className="text-xs text-zinc-400 truncate font-mono">{user.email}</p>
          </div>

          {/* Options */}
          <Link
            to="/dashboard"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 w-full px-3 py-2 text-[11px] tracking-widest uppercase text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors duration-150 no-underline"
          >
            {/* grid icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
            </svg>
            Dashboard
          </Link>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-[11px] tracking-widest uppercase text-red-400 hover:bg-zinc-800 hover:text-red-300 transition-colors duration-150 cursor-pointer border-none bg-transparent"
          >
            {/* logout icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

export default UserMenu;