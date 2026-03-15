"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getFirestore, collection, query, where, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { app } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import GuestPortal from '@/components/guest-portal/guest-portal';
import { Waves, ArrowRight } from 'lucide-react';

interface GuestPortalData {
    property: any;
    reservation: any;
    rooms: any[];
    roomTypes: any[];
    ratePlans: any[];
    services: any[];
    mealPlans: any[];
    packages?: any[];
    menus?: any[];
    payments: any[];
    summary: {
        totalAmount: number;
        totalPaid: number;
        remainingBalance: number;
        paymentStatus: string;
    };
    propertyInfo?: any;
}

interface PortalSettings {
    general: {
        portalName: string;
        welcomeTitle?: string;
        welcomeMessage?: string;
        primaryColor: string;
        accentColor: string;
    };
    branding: {
        welcomeTitle?: string;
        welcomeMessage?: string;
        primaryColor: string;
        accentColor: string;
        backgroundColor: string;
        footerText?: string;
        copyrightText?: string;
    };
}

export default function GuestPortalPage() {
    const params = useParams();
    const propertySlug = params.propertySlug as string;

    const [isLoading, setIsLoading] = useState(false);
    const [guestData, setGuestData] = useState<GuestPortalData | null>(null);
    const [reservationNumber, setReservationNumber] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [propertyExists, setPropertyExists] = useState<boolean | null>(null);
    const [checkingProperty, setCheckingProperty] = useState(true);
    const [propertyLogo, setPropertyLogo] = useState<string | null>(null);
    const [propertyName, setPropertyName] = useState<string>('');
    const [extrasData, setExtrasData] = useState<any>(null);
    const [portalSettings, setPortalSettings] = useState<PortalSettings | null>(null);
    const [propertyId, setPropertyId] = useState<string | null>(null);

    // Check if property exists on component mount
    useEffect(() => {
        const checkPropertyExists = async () => {
            if (!propertySlug) {
                setPropertyExists(false);
                setCheckingProperty(false);
                return;
            }

            try {
                const db = getFirestore(app);
                const propertyQuery = query(
                    collection(db, "properties"),
                    where("slug", "==", propertySlug.trim()),
                    limit(1)
                );

                const propertySnapshot = await getDocs(propertyQuery);
                if (!propertySnapshot.empty) {
                    const propertyData = propertySnapshot.docs[0].data();
                    const propId = propertySnapshot.docs[0].id;
                    setPropertyExists(true);
                    setPropertyLogo(propertyData.logo || null);
                    setPropertyName(propertyData.name || '');
                    setPropertyId(propId);

                    // Load default portal settings
                    try {
                        const portalsPath = collection(db, 'properties', propId, 'guestPortals');
                        const portalsSnapshot = await getDocs(portalsPath);
                        
                        if (!portalsSnapshot.empty) {
                            // Find the default portal or use the first one
                            let defaultPortal = null;
                            for (const doc of portalsSnapshot.docs) {
                                const portal = doc.data() as any;
                                if (portal.general?.defaultPortal) {
                                    defaultPortal = portal;
                                    break;
                                }
                            }
                            
                            // If no default found, use the first portal
                            if (!defaultPortal) {
                                defaultPortal = portalsSnapshot.docs[0].data();
                            }

                            if (defaultPortal) {
                                setPortalSettings(defaultPortal);
                            }
                        }
                    } catch (err) {
                        console.error('Error loading portal settings:', err);
                        // Portal settings are optional, continue without them
                    }
                } else {
                    setPropertyExists(false);
                    setPropertyLogo(null);
                }
            } catch (error) {
                console.error('Error checking property existence:', error);
                setPropertyExists(false);
                setPropertyLogo(null);
            } finally {
                setCheckingProperty(false);
            }
        };

        checkPropertyExists();
    }, [propertySlug]);

    const handleLogin = async () => {
        // Sanitize input
        const cleanReservationNumber = reservationNumber.trim();
        const cleanPropertySlug = propertySlug?.trim();

        if (!cleanReservationNumber) {
            toast({
                title: "Error",
                description: "Please enter your reservation number",
                variant: "destructive"
            });
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch('https://guestportalcheck-jnv36dwygq-ew.a.run.app', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    propertySlug: cleanPropertySlug,
                    reservationNumber: cleanReservationNumber
                })
            });

            const data = await response.json();

            if (data.success && data.data) {
                console.log('Full API Response:', data);
                console.log('Guest Portal Data:', data.data);
                console.log('Reservation Object:', data.data.reservation);
                console.log('Reservation Keys:', Object.keys(data.data.reservation || {}));
                console.log('Adults value:', data.data.reservation?.adults);
                console.log('Children value:', data.data.reservation?.children);
                console.log('AdditionalGuests value:', data.data.reservation?.additionalGuests);
                setGuestData(data.data);
                setIsAuthenticated(true);
                
                // Fetch extras data (services, meal plans, packages)
                try {
                    const extrasResponse = await fetch('https://europe-west1-protrack-hub.cloudfunctions.net/guestPortalData', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            propertySlug: cleanPropertySlug
                        })
                    });
                    const extrasInfo = await extrasResponse.json();
                    if (extrasInfo.success && extrasInfo.data) {
                        setExtrasData(extrasInfo.data);
                        // Merge extras data with guest data
                        setGuestData(prev => {
                            if (!prev) return prev;
                            return {
                                ...prev,
                                services: extrasInfo.data.services || [],
                                mealPlans: extrasInfo.data.mealPlans || [],
                                packages: extrasInfo.data.packages || [],
                                menus: extrasInfo.data.menus || [],
                                propertyInfo: extrasInfo.data.property
                            };
                        });
                    }
                } catch (extrasError) {
                    // Silent fail - extras are optional
                }
                
                toast({
                    title: "Welcome!",
                    description: "Access granted to your guest portal"
                });
            } else {
                toast({
                    title: "Access Denied",
                    description: data.error || "Invalid reservation number",
                    variant: "destructive"
                });
            }
        } catch (error: any) {
            // Error handled by toast
            toast({
                title: "Error",
                description: "Failed to verify reservation. Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        setGuestData(null);
        setReservationNumber('');
    };

    if (isAuthenticated && guestData) {
        return <GuestPortal data={guestData} onLogout={handleLogout} />;
    }

    // Show loading while checking property existence
    if (checkingProperty) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
                <div className="w-full max-w-md space-y-8 animate-in fade-in duration-700">
                    <div className="text-center space-y-4">
                        <div className="flex justify-center">
                            <div className="p-3 bg-blue-900 rounded-full">
                                <svg className="w-8 h-8 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            </div>
                        </div>
                        <h1 className="text-2xl font-semibold text-slate-900">Loading...</h1>
                        <p className="text-slate-600 text-sm font-medium">Checking property...</p>
                    </div>
                </div>
            </div>
        );
    }

    // Show error if property doesn't exist
    if (propertyExists === false) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
                <div className="w-full max-w-md space-y-8 animate-in fade-in duration-700">
                    <div className="text-center space-y-4">
                        <div className="flex justify-center">
                            <div className="p-3 bg-red-100 rounded-full">
                                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                            </div>
                        </div>
                        <h1 className="text-2xl font-semibold text-slate-900">Property Not Found</h1>
                        <p className="text-slate-600 text-sm font-medium">The property's guest portal you're trying to reach doesn't exist.</p>
                    </div>
                </div>
            </div>
        );
    }

    // Determine primary color - use portal branding color or fallback to default
    const primaryColor = portalSettings?.branding?.primaryColor || '#003366';
    const accentColor = portalSettings?.branding?.accentColor || '#0066cc';
    const backgroundColor = portalSettings?.branding?.backgroundColor || '#f8fafc';
    const welcomeTitle = portalSettings?.general?.portalName || portalSettings?.branding?.welcomeTitle || 'Guest Portal';
    const welcomeMessage = portalSettings?.branding?.welcomeMessage || 'Access your reservation details';

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ backgroundColor }}>
            <div className="w-full max-w-md space-y-8 animate-in fade-in duration-700">
                <div className="text-center space-y-2">
                    <div className="flex justify-center mb-4">
                        {propertyLogo ? (
                            <div className="p-2 rounded-lg" style={{ backgroundColor: primaryColor }}>
                                <img
                                    src={propertyLogo}
                                    alt={propertyName || 'Property Logo'}
                                    className="w-10 h-10 object-contain"
                                />
                            </div>
                        ) : (
                            <div className="p-3 rounded-full" style={{ backgroundColor: primaryColor }}>
                                <Waves className="w-8 h-8 text-white" />
                            </div>
                        )}
                    </div>
                    <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{welcomeTitle}</h1>
                    <p className="text-slate-600 font-light text-sm">{welcomeMessage}</p>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4 bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                    <div className="space-y-1">
                        <label htmlFor="reservationNumber" className="text-xs uppercase tracking-widest text-slate-400 font-semibold ml-1">
                            Reservation Number
                        </label>
                        <input
                            id="reservationNumber"
                            type="text"
                            value={reservationNumber}
                            onChange={(e) => setReservationNumber(e.target.value)}
                            placeholder="e.g. SH-458921"
                            className="w-full p-4 bg-slate-50 border-none rounded-xl focus:ring-2 transition-all outline-none font-medium text-center text-base tracking-wide"
                            style={{ focusRingColor: accentColor }}
                            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full text-white p-4 rounded-xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        style={{ 
                            backgroundColor: primaryColor,
                            '--tw-ring-color': accentColor
                        } as React.CSSProperties}
                    >
                        {isLoading ? (
                            <>
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                VERIFYING...
                            </>
                        ) : (
                            <>
                                Access Portal
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </form>

                <p className="text-center text-xs text-slate-400 font-light">Need help? Please contact the front desk.</p>
            </div>
        </div>
    );
}