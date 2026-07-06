import type { Metadata } from "next";
import { ClerkProvider, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { D20Mark } from "@/components/logo";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Dark by design — the goblin lives in a cave. */}
        <ClerkProvider>
          <header className="flex items-center gap-6 border-b px-6 py-3">
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
            <span className="ml-auto">{userId && <UserButton />}</span>
          </header>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
