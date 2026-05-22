import { Providers } from "@/components/Providers";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ height: "100dvh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <Providers>{children}</Providers>
    </div>
  );
}
