import type { Metadata } from "next";
import "../src/style.css";
export const metadata: Metadata = {
  title: "Carehouse | Hospital Management",
  description:
    "Carehouse Hospital Management: a fictional-data healthcare operations demonstration.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
