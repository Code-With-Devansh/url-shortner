import { useState } from "react";
import Homepage from "./pages/Homepage";
import LoginPage from "./pages/LoginPage";
import AuthPage from "./pages/AuthPage";
import { Outlet } from "@tanstack/react-router";
import Navbar from "./components/Navbar";

export default function App() {
  return (
    <>
    <Navbar/>
      <Outlet />
    </>
  )
}