import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import "./index.css";
import { StatusProvider } from "./store/statusStore";
import { AgentProvider } from "./store/agentStore";
import { SourceProvider } from "./store/sourceStore";
import { ThemeProvider } from "./theme/ThemeContext";
import { Check, LoaderCircle, X } from "lucide-react";
import hotToast, { resolveValue, Toaster } from "react-hot-toast";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <StatusProvider>
            <AgentProvider>
              <SourceProvider>
              <Toaster
                position="top-center"
                reverseOrder={false}
                gutter={12}
                containerClassName="center-modal-toaster"
                containerStyle={{
                  inset: 0,
                }}
                toastOptions={{
                  duration: 3000,
                  removeDelay: 0,
                  style: {
                    background: "transparent",
                    boxShadow: "none",
                    padding: 0,
                  },
                  success: { duration: 2500 },
                  error: { duration: 4000 },
                }}
              >
                {(toastItem) => {
                  const isSuccess = toastItem.type === "success";
                  const isError = toastItem.type === "error";
                  const title =
                    isSuccess
                      ? "Success"
                      : isError
                        ? "Error"
                        : toastItem.type === "loading"
                          ? "Please wait"
                          : "Notification";
                  const cardClass = isError
                    ? "border-red-200 shadow-red-950/20"
                    : isSuccess
                      ? "border-emerald-200 shadow-emerald-950/20"
                      : "border-sky-200 shadow-sky-950/20";
                  const iconWrapClass = isError
                    ? "bg-red-100 text-red-600 ring-red-50"
                    : isSuccess
                      ? "bg-emerald-100 text-emerald-600 ring-emerald-50"
                      : "bg-sky-100 text-sky-600 ring-sky-50";
                  const buttonClass = isError
                    ? "bg-red-600 text-white shadow-red-200 hover:bg-red-700"
                    : isSuccess
                      ? "bg-emerald-600 text-white shadow-emerald-200 hover:bg-emerald-700"
                      : "bg-sky-600 text-white shadow-sky-200 hover:bg-sky-700";
                  const message = resolveValue(toastItem.message, toastItem);
                  const icon = isError ? (
                    <X size={34} strokeWidth={3} />
                  ) : isSuccess ? (
                    <Check size={34} strokeWidth={3} />
                  ) : (
                    <LoaderCircle size={34} strokeWidth={3} className="animate-spin" />
                  );

                  return (
                    <div className="pointer-events-auto fixed inset-0 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[3px]">
                      <div
                        className={[
                          "flex min-h-[200px] w-full max-w-[360px] flex-col items-center justify-center rounded-md border bg-white px-6 py-6 text-center shadow-[0_26px_80px_rgba(15,23,42,0.35)] transition-all duration-200",
                          cardClass,
                          toastItem.visible ? "scale-100 opacity-100" : "scale-95 opacity-0",
                        ].join(" ")}
                      >
                        <div className="flex flex-col items-center justify-center">
                          <div
                            className={[
                              "flex h-16 w-16 shrink-0 items-center justify-center rounded-full ring-[10px]",
                              iconWrapClass,
                            ].join(" ")}
                          >
                            {icon}
                          </div>
                          <div className="mt-7 min-w-0">
                            <div className="break-words text-lg font-bold leading-7 text-slate-950">
                              {message || title}
                            </div>
                          </div>
                        </div>
                        <div className="mt-7 flex justify-center">
                          <button
                            type="button"
                            onClick={() => hotToast.remove(toastItem.id)}
                            className={[
                              "min-w-[108px] rounded-md px-6 py-3 text-base font-bold shadow-lg transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-slate-200",
                              buttonClass,
                            ].join(" ")}
                          >
                            OK
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }}
              </Toaster>
              <App />
            </SourceProvider>
          </AgentProvider>
        </StatusProvider>
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
</React.StrictMode>
);
