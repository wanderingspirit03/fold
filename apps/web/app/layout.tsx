import React from "react";
import "./globals.css";

export const metadata = {
  title: "Agent MD Rooms",
  description: "Encrypted Markdown rooms for humans and agents",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22><rect width=%2232%22 height=%2232%22 rx=%226%22 fill=%22%230f172a%22/><path d=%22M10 8h9l3 3v13H10z%22 fill=%22white%22/><path d=%22M19 8v4h4%22 fill=%22%23cbd5e1%22/><path d=%22M13 15h8M13 18h8M13 21h5%22 stroke=%22%230f172a%22 stroke-width=%221.4%22 stroke-linecap=%22round%22/></svg>"
        />
      </head>
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
