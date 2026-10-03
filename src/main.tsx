import { installImageFallback } from "./lib/image-fallback.ts";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { reportWebVitals } from "./lib/web-vitals";

const root = document.getElementById("root")!;


installImageFallback();

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();

// The build's plain-HTML copy of the page (for readers without JavaScript) has
// done its job once the app is running; drop it so the page holds one copy.
document.querySelectorAll(".prerender-summary").forEach((el) => el.remove());
