import type { Metadata } from "next";
import { ClerkProvider, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { ThemeProvider } from "next-themes";
import { D20Mark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
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
          <header className="border-b">
            {/* Same container as the pages, so the wordmark lines up with
                the page headings below it. */}
            <div className="mx-auto flex w-full max-w-4xl items-center gap-6 px-6 py-3">
              <Link href="/" className="flex items-center gap-2 text-lg font-bold">
                <D20Mark size={24} />
                StatGoblin
              </Link>
              {userId && (
                <nav className="flex items-center gap-4 text-sm text-muted-foreground">
                  <Link href="/" className="hover:text-foreground">
                    Campaigns
                  </Link>
                  <Link href="/me" className="hover:text-foreground">
                    My characters
                  </Link>
                </nav>
              )}
              <span className="ml-auto flex items-center gap-2">
                <ThemeToggle />
                {userId && <UserButton />}
              </span>
            </div>
          </header>
          {children}
        </ClerkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
