import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button.tsx";
import { 
  ErrorState, 
  ErrorStateHeader, 
  ErrorStateMedia, 
  ErrorStateTitle, 
  ErrorStateDescription, 
  ErrorStateContent 
} from "@/components/ui/error-state.tsx";
import { RefreshCwIcon, ChevronLeftIcon } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-[50vh] p-6">
          <ErrorState>
            <ErrorStateHeader>
              <ErrorStateMedia variant="icon" />
              <ErrorStateTitle>Something went wrong</ErrorStateTitle>
              <ErrorStateDescription>
                {this.state.error?.message || "An unexpected error occurred while loading this page."}
              </ErrorStateDescription>
            </ErrorStateHeader>
            <ErrorStateContent>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => window.history.back()}
                >
                  <ChevronLeftIcon className="size-4 mr-2" />
                  Go Back
                </Button>
                <Button 
                  onClick={() => window.location.reload()}
                >
                  <RefreshCwIcon className="size-4 mr-2" />
                  Reload Page
                </Button>
              </div>
            </ErrorStateContent>
          </ErrorState>
        </div>
      );
    }

    return this.props.children;
  }
}
