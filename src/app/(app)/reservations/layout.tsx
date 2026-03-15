
"use client";

export default function ReservationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full gap-6">
      
      <div className="flex-1 flex flex-col">
        {children}
      </div>
    </div>
  );
}
