import { http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";
const publicSepoliaRpcUrl = "https://ethereum-sepolia-rpc.publicnode.com";

export const wagmiConfig = getDefaultConfig({
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Ledgr",
  projectId,
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(publicSepoliaRpcUrl),
  },
  ssr: true,
});
