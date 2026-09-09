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
