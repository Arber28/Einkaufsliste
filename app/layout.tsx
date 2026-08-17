import "./globals.css";

export const metadata = {
  title: "Einkaufsliste",
  description: "Meine Einkaufsliste",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
