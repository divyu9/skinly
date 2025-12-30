interface CoverageSelectorProps {
  selectedCoverage: "only_back" | "full_body_wrap";
  onCoverageChange: (coverage: "only_back" | "full_body_wrap") => void;
}

export function CoverageSelector({
  selectedCoverage,
  onCoverageChange,
}: CoverageSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold">Select Coverage</label>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onCoverageChange("only_back")}
          className={`p-4 rounded-lg border-2 transition-all text-left ${
            selectedCoverage === "only_back"
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/50"
          }`}
        >
          <div className="font-medium text-sm">Only Back</div>
          <div className="text-xs text-muted-foreground mt-1">
            Back coverage only
          </div>
        </button>
        <button
          onClick={() => onCoverageChange("full_body_wrap")}
          className={`p-4 rounded-lg border-2 transition-all text-left ${
            selectedCoverage === "full_body_wrap"
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/50"
          }`}
        >
          <div className="font-medium text-sm">Full Body Wrap</div>
          <div className="text-xs text-muted-foreground mt-1">
            Complete protection
          </div>
        </button>
      </div>
    </div>
  );
}
