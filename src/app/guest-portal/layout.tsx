export default function GuestPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Guest Portal</title>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}