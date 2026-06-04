import { useEffect, useState } from "react";
import { Outlet } from "@tanstack/react-router";
import Navbar from "./components/Navbar";
import { useDispatch, useSelector } from "react-redux";
import { getCurrentUser } from "./api/user.api";
import { initializeAuth, setAuthInitPromise } from "./store/slice/authSlice";

export default function App() {
  
  return (
    <>
      <Navbar/>
      <Outlet />
    </>
  )
}