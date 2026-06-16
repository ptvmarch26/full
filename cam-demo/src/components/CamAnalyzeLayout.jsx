import { useNavigate } from "react-router-dom";
import { LayoutDashboard } from "lucide-react";

export default function CamAnalyzeLayout({ active = "setup", children }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#191c1e] font-sans">
      <nav className="fixed top-0 z-50 flex h-20 w-full items-center border-b border-[#c2c6d6] bg-[#f7f9fb] px-6">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between">
          <div className="flex items-center gap-8">
            <button
              onClick={() => navigate("/run")}
              className="text-2xl font-bold text-[#0058be]"
            >
              CAM-Analyze
            </button>

            <div className="hidden items-center gap-6 md:flex">
              <button
                onClick={() => navigate("/run")}
                className={`border-b-2 pb-1 text-xs font-semibold uppercase tracking-widest transition ${
                  active === "setup"
                    ? "border-[#0058be] text-[#0058be]"
                    : "border-transparent text-[#424754] hover:text-[#0058be]"
                }`}
              >
                Context Setup
              </button>

              <button
                onClick={() => navigate("/run/analysis")}
                className={`border-b-2 pb-1 text-xs font-semibold uppercase tracking-widest transition ${
                  active === "analysis"
                    ? "border-[#0058be] text-[#0058be]"
                    : "border-transparent text-[#424754] hover:text-[#0058be]"
                }`}
              >
                Mode Analysis
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden rounded-sm bg-[#d0e1fb] px-4 py-2 text-xs font-semibold uppercase tracking-widest text-[#505f76] sm:inline-block">
              CAMS-V Framework
            </span>
          </div>
        </div>
      </nav>

      {children}
    </div>
  );
}
