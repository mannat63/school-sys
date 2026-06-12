import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata = {
  title: "Alpha School | Academic Excellence",
  description: "A modern management platform for schools. Track students, fees, attendance, and results with ease.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body suppressHydrationWarning>
        <ClerkProvider>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
