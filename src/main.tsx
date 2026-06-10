import React from "react";
import ReactGA from "react-ga4";
import ReactDOM from "react-dom/client";
import App from "./App";

const GA_ID = import.meta.env.VITE_GA_ID;

console.log("GA_ID =", GA_ID);

if (GA_ID) {
  ReactGA.initialize(GA_ID);
  console.log("GA Initialized");
} else {
  console.warn("GA_ID is missing");
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
