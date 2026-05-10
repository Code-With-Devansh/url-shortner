import { useNavigate } from "@tanstack/react-router";
import React from "react";

const StatCard = ({ label, value, icon, mono, link }) => {
  const navigate = useNavigate();
  return (
    <div className="bg-zinc-900  border border-zinc-800 rounded px-5 py-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] tracking-[0.2em] uppercase text-zinc-600">
          {label}
        </span>
        <span className="text-base">{icon}</span>
      </div>
      <p
        className={`font-bold text-zinc-100 truncate ${link ? "cursor-pointer hover:underline" : ""} ${mono ? "font-mono text-lime-400 text-sm mt-1" : "text-xl"}`}
        style={!mono ? { fontFamily: "'Syne', sans-serif" } : {}}
        onClick={() => {

          if(link){
            window.open(value, "_blank")
          }
        }
      }
      >
        {value}
      </p>
    </div>
  );
};

export default StatCard;
