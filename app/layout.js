import "./globals.css";

export const metadata = {
    title: "Taskforge — Work, without the busywork",
    description: "A calm, powerful workspace for teams that ship meaningful work.",
};

export default function RootLayout({ children }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body>{children}</body>
        </html>
    );
}