import './globals.css';

export const metadata = { title: 'Question Paper Generator', description: 'Confidential exam paper builder' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
