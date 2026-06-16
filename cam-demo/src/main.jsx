import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import RunSimulationPage from "./pages/RunSimulationPage.jsx";
import ModeAnalysisPage from "./pages/ModeAnalysisPage.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/run" element={<RunSimulationPage />} />
        <Route path="/run/analysis" element={<ModeAnalysisPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
