import type { Metadata } from "next";
import { ClerkProvider, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { D20Icon } from "@/components/d20-icon";
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
  title: "Rollwatch",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Follow the OS theme: shadcn's dark tokens hang off a .dark class,
            so mirror prefers-color-scheme onto <html> before paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var m=window.matchMedia('(prefers-color-scheme: dark)');function a(){document.documentElement.classList.toggle('dark',m.matches)}a();m.addEventListener('change',a)})()`,
          }}
        />
        <ClerkProvider>
          <header className="flex items-center gap-6 border-b px-6 py-3">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold">
              <D20Icon size={22} />
              Rollwatch
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
