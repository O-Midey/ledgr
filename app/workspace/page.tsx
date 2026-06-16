import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { TxTrackerProvider } from "@/lib/txTracker";

export default function WorkspacePage() {
  return (
    <TxTrackerProvider>
      <WorkspaceShell />
    </TxTrackerProvider>
  );
}
