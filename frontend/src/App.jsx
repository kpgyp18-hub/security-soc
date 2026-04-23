import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import Sidebar from "./components/Sidebar/Sidebar";
import MonitoringPage     from "./pages/MonitoringPage";
import AttackPatternsPage from "./pages/AttackPatternsPage";
import ReportPage         from "./pages/ReportPage";
import IncidentsPage      from "./pages/IncidentsPage";
import RetrainPage        from "./pages/RetrainPage";

function Layout() {
  const { tokens } = useTheme();
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: tokens.bgBase, color: tokens.textPrimary, fontFamily: "sans-serif", transition: "background 0.2s, color 0.2s" }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: "auto" }}>
        <Routes>
          <Route path="/"           element={<MonitoringPage />} />
          <Route path="/attacks"    element={<AttackPatternsPage />} />
          <Route path="/report"     element={<ReportPage />} />
          <Route path="/incidents"  element={<IncidentsPage />} />
          <Route path="/retrain"    element={<RetrainPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Layout />
      </BrowserRouter>
    </ThemeProvider>
  );
}
