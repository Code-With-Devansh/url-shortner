import { useNavigate } from "@tanstack/react-router";
import React from "react";

const StatCard = ({ label, value, icon: Icon, mono, link }) => {
  const navigate = useNavigate();
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded px-5 py-4">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[9px] tracking-[0.2em] uppercase text-zinc-400">
          {label}
        </span>
        {Icon && <Icon size={14} strokeWidth={2} className="text-lime-400/80 shrink-0" />}
      </div>
      <p
        className={`font-mono font-bold text-zinc-100 truncate ${link ? "cursor-pointer hover:underline" : ""} ${mono ? "text-lime-400 text-sm mt-1" : "text-2xl"}`}
        onClick={() => {
          if (link) {
            window.open(value, "_blank");
          }
        }}
      >
        {value}
      </p>
    </div>
  );
};

export default StatCard;
