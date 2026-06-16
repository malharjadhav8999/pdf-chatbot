import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF Chatbot — Chat with any PDF",
  description:
    "Upload any PDF and chat with it. Built with Next.js, LangChain, and free models.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
