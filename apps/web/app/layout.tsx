import React from "react";
import { headers } from "next/headers";
import "./globals.css";

export const metadata = {
  title: "Fold",
  description: "Encrypted Markdown projects for humans and agents",
};

const themeInitScript =
  "try{var t=localStorage.getItem('fold:theme');document.documentElement.dataset.theme=t==='light'?'light':'dark'}catch(e){document.documentElement.dataset.theme='dark'}";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get("x-nonce") || undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/brand/fold-favicon.svg" />
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: themeInitScript,
          }}
        />
      </head>
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
