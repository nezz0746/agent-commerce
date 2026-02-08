import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { AppSidebar } from "@/components/AppSidebar";
import { Header } from "@/components/Header";
import { SidebarInset } from "@/components/ui/sidebar";
import { Toaster } from "sonner";

const font = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Onchain Commerce",
  description: "Fully onchain multi-tenant e-commerce on Optimism",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${font.className} min-h-screen antialiased`}>
        <Providers>
          <AppSidebar />
          <SidebarInset>
            <Header />
            <main className="flex-1 p-6">{children}</main>
          </SidebarInset>
        </Providers>
        <Toaster theme="light" richColors position="bottom-right" />
      </body>
    </html>
  );
}
