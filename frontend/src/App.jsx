import { useEffect, useState } from "react";
import { Outlet } from "@tanstack/react-router";
import Navbar from "./components/Navbar";
import { useDispatch, useSelector } from "react-redux";
import { getCurrentUser } from "./api/user.api";
import { initializeAuth } from "./store/slice/authSlice";

export default function App() {
  const dispatch = useDispatch();
  const loading = useSelector((state) => state.auth.loading);
  
  useEffect(()=>{
    dispatch(initializeAuth());
  }, [dispatch])
  return (
    <>
      <Navbar/>
      <Outlet />
    </>
  )
}