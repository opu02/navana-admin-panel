import { Construction } from "lucide-react";

// Placeholder for System pages that are not built yet
export default function ComingSoon() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center rounded-xl border bg-background p-12 text-center shadow-sm">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Construction className="h-7 w-7" />
      </div>
      <h2 className="text-lg font-semibold">Coming soon</h2>
      <p className="mt-1 text-sm text-muted-foreground">This page will be built in the next steps.</p>
    </div>
  );
}
