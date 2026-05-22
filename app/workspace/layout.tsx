import { Providers } from "@/components/Providers";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Providers>{children}</Providers>;
}
