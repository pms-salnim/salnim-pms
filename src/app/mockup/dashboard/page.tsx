
"use client";

import React, { Fragment } from 'react';
import { Icons } from "@/components/icons";

// --- START: Self-contained utility and component definitions ---
const cn = (...inputs: (string | undefined | null | boolean)[]) => inputs.filter(Boolean).join(' ');
// --- END: Self-contained utility and component definitions ---

const propertyName = "Salnim Pms";
const propertyAddress = "Dakhla, Morocco";

const metricCards = [
    { title: "Total Reservations", value: "125", icon: Icons.CalendarCheck, dataAiHint: "calendar checkmark", description: "in the last 30 days" },
    { title: "Check-ins Today", value: "8", icon: Icons.LogIn, dataAiHint: "door enter", description: "arrivals scheduled" },
    { title: "Check-outs Today", value: "12", icon: Icons.LogOut, dataAiHint: "door exit", description: "departures scheduled" },
    { title: "In-House Guests", value: "45", icon: Icons.Users, dataAiHint: "group people", description: "currently staying" },
    { title: "Occupancy Rate", value: "75%", icon: Icons.TrendingUp, dataAiHint: "graph statistics", description: "based on available rooms" },
    { title: "Stay Revenue", value: "$8,520.00", icon: Icons.DollarSign, dataAiHint: "money revenue", description: "in the selected period" },
    { title: "Available Rooms", value: "15", icon: Icons.BedDouble, dataAiHint: "hotel bed available", description: "ready for check-in" },
    { title: "Occupied Rooms", value: "35", icon: Icons.BedDouble, dataAiHint: "hotel bed occupied", description: "currently in-house" },
];


export default function DashboardMockupPage() {
    const pageTitle = "Salnim Pms - Dashboard Mockup";

    const cssStyles = `
        body { font-family: 'Inter', sans-serif; background-color: #F7F7F8; }
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@700&display=swap');
        .font-body { font-family: 'Inter', sans-serif; }
        .font-headline { font-family: 'Space Grotesk', sans-serif; }
        .bg-background { background-color: #F7F7F8; }
        .text-foreground { color: #0A1E3C; }
        .text-muted-foreground { color: #6B7280; }
        .border-border { border-color: #E5E7EB; }
        .bg-card { background-color: #FFFFFF; }
        .shadow-sm { box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); }
        .rounded-lg { border-radius: 0.5rem; }
    `;

    return (
        <Fragment>
            <style dangerouslySetInnerHTML={{ __html: cssStyles }} />
            <div className="flex min-h-screen w-full font-body text-foreground bg-background">
                <main className="flex-1 p-4 sm:p-6 lg:p-8">
                    <header className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-6">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-foreground font-headline">Dashboard</h1>
                            <p className="text-muted-foreground">A high-level overview of your property's performance.</p>
                        </div>
                    </header>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {metricCards.map((metric) => {
                            const IconComponent = metric.icon;
                            return (
                                <div key={metric.title} className="rounded-lg border bg-card text-card-foreground shadow-sm">
                                    <div className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
                                        <h3 className="text-sm font-medium text-muted-foreground tracking-tight">{metric.title}</h3>
                                        <IconComponent className="h-4 w-4 text-muted-foreground" data-ai-hint={metric.dataAiHint} />
                                    </div>
                                    <div className="p-6 pt-0">
                                        <div className="text-2xl font-bold text-foreground">{metric.value}</div>
                                        {metric.description && <p className="text-xs text-muted-foreground pt-1">{metric.description}</p>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </main>
            </div>
        </Fragment>
    );
}
