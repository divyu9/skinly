import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App.tsx";
import "./index.css";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Render based on whether Clerk key is available
const root = document.getElementById("root")!;

if (clerkPubKey) {
  // With Clerk auth - optimized for faster initial render
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ClerkProvider
        publishableKey={clerkPubKey}
        appearance={{
          // Reduce initial CSS bundle by using minimal base theme
          layout: {
            socialButtonsVariant: "iconButton",
            socialButtonsPlacement: "bottom",
          },
        }}
        // Defer non-critical Clerk operations
        afterSignInUrl="/"
        afterSignUpUrl="/"
      >
        {/* Render app immediately, don't block on Clerk loading */}
        <App />
      </ClerkProvider>
    </React.StrictMode>
  );
} else {
  // Without Clerk (graceful fallback)
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
