"use client";

import React, { useState } from 'react';
import { Icons } from '@/components/icons';
import ExtrasDetailsModal from './extras-details-modal';

interface Service {
  id: string;
  name: string;
  description?: string;
  longDescription?: string;
  featuredImage?: string;
  images?: string[];
  price?: number;
  currency?: string;
  pricingType?: string;
  variations?: Array<{
    label: string;
    adultPrice: number;
    childPrice: number;
  }>;
  tags?: string[];
  circuitItinerary?: Array<{
    time: string;
    activity: string;
    location: string;
  }>;
  maxPeople?: number;
  cutoffTime?: number;
}

interface GuestExtrasGridProps {
  extras?: Service[];
  propertySlug?: string;
  property?: any;
  onOpenDetails?: (service: Service) => void;
  onAdd?: (service: Service) => void;
}

export default function GuestExtrasGrid({ extras, propertySlug, property, onOpenDetails, onAdd }: GuestExtrasGridProps) {
  const [list, setList] = useState<Service[]>(extras || []);
  const [loading, setLoading] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [showModal, setShowModal] = useState(false);

  React.useEffect(() => {
    if (extras && extras.length > 0) {
      setList(extras);
      return;
    }

    if (!propertySlug) return;

    const fetchExtras = async () => {
      setLoading(true);
      try {
        const res = await fetch('https://europe-west1-protrack-hub.cloudfunctions.net/guestPortalData', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ propertySlug })
        });
        const json = await res.json();
        if (json && json.success && json.data) {
          setList(json.data.services || []);
        }
      } catch (err) {
        console.error('Failed to fetch extras:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchExtras();
  }, [extras, propertySlug]);

  const handleOpen = (s: Service) => {
    if (onOpenDetails) {
      onOpenDetails(s);
    } else {
      setSelectedService(s);
      setShowModal(true);
    }
  };

  const handleAdd = (s: Service) => {
    if (onAdd) return onAdd(s);
    console.log('Add to stay:', s.id);
    alert(`${s.name} added to your stay`);
  };

  const currency = property?.currency || '$';

  const getLowestPrice = (service: Service) => {
    if (service.variations && service.variations.length > 0) {
      const prices = service.variations.flatMap(v => [v.adultPrice, v.childPrice]);
      return Math.min(...prices);
    }
    return service.price ?? 0;
  };

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="inline-block w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
        <p className="text-slate-500 mt-4">Loading extras...</p>
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-100 mb-4">
          <Icons.Package className="w-10 h-10 text-slate-400" />
        </div>
        <p className="text-lg text-slate-500">No extras available at the moment.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-8">
        {list.map((service) => {
          const displayImage = service.featuredImage || service.images?.[0];
          const isHovered = hoveredId === service.id;
          const lowestPrice = getLowestPrice(service);
          
          return (
            <div 
              key={service.id} 
              className="group relative cursor-pointer"
              onMouseEnter={() => setHoveredId(service.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => handleOpen(service)}
            >
              {/* Image Container */}
              <div className="relative h-60 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500">
                {displayImage ? (
                  <>
                    <img 
                      src={displayImage} 
                      alt={service.name}
                      className={`w-full h-full object-cover transition-transform duration-700 ${
                        isHovered ? 'scale-110' : 'scale-100'
                      }`}
                    />
                    <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-opacity duration-500 ${
                      isHovered ? 'opacity-100' : 'opacity-80'
                    }`}></div>
                  </>
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 via-primary/10 to-slate-100 flex items-center justify-center">
                    <div className="w-32 h-32 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-5xl font-bold text-primary">{service.name[0]?.toUpperCase()}</span>
                    </div>
                  </div>
                )}

                {/* Content Overlay */}
                <div className="absolute inset-0 p-6 flex flex-col justify-end">
                  {/* Tags */}
                  {service.tags && service.tags.length > 0 && (
                    <div className="flex gap-2 flex-wrap mb-3">
                      {service.tags.slice(0, 2).map((tag, idx) => (
                        <span 
                          key={idx} 
                          className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-medium text-white border border-white/30"
                        >
                          {tag}
                        </span>
                      ))}
                      {service.tags.length > 2 && (
                        <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-medium text-white border border-white/30">
                          +{service.tags.length - 2}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Title */}
                  <h3 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">
                    {service.name}
                  </h3>

                  {/* Description */}
                  {service.description && (
                    <p className={`text-sm text-white/90 mb-4 line-clamp-2 transition-all duration-500 ${
                      isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                    }`}>
                      {service.description}
                    </p>
                  )}

                  {/* Price & Actions */}
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <div className="text-xs text-white/70 mb-1">From</div>
                      <div className="text-3xl font-bold text-white drop-shadow-lg">
                        {currency}{lowestPrice.toFixed(2)}
                      </div>
                      {service.pricingType && (
                        <div className="text-xs text-white/80 mt-1">
                          {service.pricingType.replace(/-/g, ' ')}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons - Text Links */}
                    <div className={`flex flex-col gap-2 transition-all duration-500 ${
                      isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
                    }`}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpen(service);
                        }}
                        className="text-white text-sm font-medium underline underline-offset-4 decoration-white/50 hover:decoration-white transition-all hover:scale-105 text-right"
                      >
                        More Details →
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAdd(service);
                        }}
                        className="px-4 py-2 bg-white text-primary rounded-xl text-sm font-semibold hover:bg-white/90 transition-all hover:scale-105 shadow-lg whitespace-nowrap"
                      >
                        Add To My Stay
                      </button>
                    </div>
                  </div>
                </div>

                {/* Hover Indicator */}
                <div className={`absolute top-4 right-4 w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center transition-all duration-500 ${
                  isHovered ? 'opacity-100 scale-100 rotate-90' : 'opacity-0 scale-75 rotate-0'
                }`}>
                  <Icons.ArrowRight className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Details Modal */}
      <ExtrasDetailsModal 
        service={selectedService}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onAddToStay={handleAdd}
        property={property}
      />
    </>
  );
}
