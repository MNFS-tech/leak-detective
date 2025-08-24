import "./globals.css";

export const metadata = {
  title: "Leak Detective",
  description: "Training Simulator for Water Leak Detection (SDG 6)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-100 min-h-dvh">{children}</body>
    </html>
  );
}
