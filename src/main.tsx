import "./mobile.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { previewEntryRedirect } from "./lib/previewOrigin";

const testRedirect = previewEntryRedirect(location.href, import.meta.env.VITE_TEST_APP_ORIGIN,
  import.meta.env.PROD && import.meta.env.VITE_LAUNCH_ENABLED === "1");

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
}

if (testRedirect) location.replace(testRedirect);
else ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
