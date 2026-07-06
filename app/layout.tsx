import type { Metadata } from "next";
import { ClerkProvider, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { ThemeProvider } from "next-themes";
import { D20Mark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Geist, Geist_Mono, Roboto } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const roboto = Roboto({subsets:['latin'],variable:'--font-sans'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StatGoblin",
  description: "Your table's rolls, collected and charted.",
  manifest: "/favicon_io/site.webmanifest",
  icons: {
    // Black glyph for light tabs, white variant for dark ones.
    icon: [
      { url: "/favicon_io/favicon-32x32.png", sizes: "32x32", media: "(prefers-color-scheme: light)" },
      { url: "/favicon_io/favicon-16x16.png", sizes: "16x16", media: "(prefers-color-scheme: light)" },
      { url: "/favicon_io/favicon-32x32-dark.png", sizes: "32x32", media: "(prefers-color-scheme: dark)" },
      { url: "/favicon_io/favicon-16x16-dark.png", sizes: "16x16", media: "(prefers-color-scheme: dark)" },
    ],
    apple: "/favicon_io/apple-touch-icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { userId } = await auth();
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-sans", roboto.variable)}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <ClerkProvider>
          {/* Sidebar is the phone nav (offcanvas drawer); desktop keeps the
              inline header nav and never shows the sidebar. */}
          <SidebarProvider defaultOpen={false}>
            {userId && <AppSidebar />}
            <SidebarInset>
              <header className="border-b">
                {/* Same container as the pages, so the wordmark lines up with
                    the page headings below it. */}
                <div className="mx-auto flex w-full max-w-4xl items-center gap-2.5 px-3 py-3 md:gap-6 md:px-6">
                  {/* Phones: hamburger left, wordmark right. Desktop: wordmark
                      left, inline nav, controls right — trigger hidden. */}
                  {userId && <SidebarTrigger className="md:hidden" />}
                  <Link
                    href="/"
                    className={cn(
                      "flex items-center gap-2 text-lg font-bold",
                      userId && "ml-auto md:ml-0",
                    )}
                  >
                    <D20Mark size={24} />
                    StatGoblin
                  </Link>
                  {userId && (
                    <nav className="hidden items-center gap-4 text-sm text-muted-foreground md:flex">
                      <Link href="/" className="hover:text-foreground">
                        Campaigns
                      </Link>
                      <Link href="/me" className="whitespace-nowrap hover:text-foreground">
                        My characters
                      </Link>
                    </nav>
                  )}
                  <span
                    className={cn(
                      "items-center gap-2",
                      userId ? "ml-auto hidden md:flex" : "ml-auto flex",
                    )}
                  >
                    <ThemeToggle />
                    {userId && <UserButton />}
                  </span>
                </div>
              </header>
              {children}
            </SidebarInset>
          </SidebarProvider>
        </ClerkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
