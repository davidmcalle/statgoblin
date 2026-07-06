import type { Metadata } from "next";
import { ClerkProvider, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
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
          <header className="flex items-center justify-between border-b border-gray-200 px-6 py-3 dark:border-gray-800">
            <Link href="/" className="text-lg font-bold">
              🎲 Rollwatch
            </Link>
            {userId && <UserButton />}
          </header>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
