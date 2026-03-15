"use client";

import React, { useState } from 'react';
import { Icons } from '@/components/icons';
import { 
  X, 
  Sparkles, 
  DollarSign, 
  FileText, 
  MapPin, 
  Clock, 
  Users, 
  ImageIcon, 
  PlusCircle,
  ArrowRight,
  Calendar,
  Star,
  Tag,
  Info,
  ChevronRight
} from 'lucide-react';

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
  circuitItinerary?: Array<{
    time: string;
    activity: string;
    location: string;
  }>;
  tags?: string[];
  maxPeople?: number;
  cutoffTime?: number;
}

interface ExtrasDetailsModalProps {
  service: Service | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToStay: (service: Service) => void;
  property?: {
    currency?: string;
    name?: string;
  };
}

export default function ExtrasDetailsModal({ service, isOpen, onClose, onAddToStay, property }: ExtrasDetailsModalProps) {
  const [selectedImage, setSelectedImage] = useState(0);
  
  if (!isOpen || !service) return null;

  const heroImage = service.featuredImage || service.images?.[0];
  const currency = service.currency || property?.currency || 'MAD';
  const allImages = service.images || (service.featuredImage ? [service.featuredImage] : []);

  const getPricingTypeLabel = (type?: string) => {
    switch (type) {
      case 'one-time-per-guest': return 'One-time / Per Guest';
      case 'per-guest-per-night': return 'Per Guest / Per Night';
      case 'per-reservation': return 'Per Reservation';
      case 'per-night': return 'Per Night';
      case 'per-guest': return 'Per Guest';
      default: return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative bg-gradient-to-br from-white via-white to-slate-50/50 rounded-3xl w-full max-w-5xl max-h-[92vh] overflow-hidden shadow-2xl border border-white/20 animate-in zoom-in-95 duration-300">
        
        {/* Premium Hero Section */}
        <div className="relative h-64 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-cyan-500 to-emerald-500 rounded-full blur-3xl"></div>
          </div>
          
          {heroImage ? (
            <>
              <img 
                src={allImages[selectedImage] || heroImage} 
                alt={service.name}
                className="w-full h-full object-cover transition-opacity duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-slate-900/20"></div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center relative z-10">
              <div className="w-40 h-40 rounded-3xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-2xl">
                <span className="text-7xl font-bold bg-gradient-to-br from-white to-slate-300 bg-clip-text text-transparent">
                  {service.name[0]?.toUpperCase()}
                </span>
              </div>
            </div>
          )}
          
          {/* Floating Close Button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-3 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl hover:bg-white/20 transition-all hover:scale-110 active:scale-95 shadow-xl z-20"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          
          {/* Image Navigation Dots */}
          {allImages.length > 1 && (
            <div className="absolute bottom-24 left-0 right-0 flex justify-center gap-2 z-10">
              {allImages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(idx)}
                  className={`h-2 rounded-full transition-all ${
                    idx === selectedImage 
                      ? 'w-8 bg-white' 
                      : 'w-2 bg-white/40 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>
          )}
          
          {/* Title Overlay with Glass-morphism */}
          <div className="absolute bottom-0 left-0 right-0 p-8 z-10">
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">
                    {service.name}
                  </h2>
                  {service.tags && service.tags.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {service.tags.map((tag, idx) => (
                        <span 
                          key={idx} 
                          className="px-2.5 py-1 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full text-xs font-medium text-white flex items-center gap-1.5 shadow-lg"
                        >
                          <Tag className="w-3.5 h-3.5" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Premium Badge */}
                <div className="p-3 bg-gradient-to-br from-amber-500/20 to-orange-500/20 backdrop-blur-sm border border-amber-400/30 rounded-2xl shadow-xl">
                  <Star className="w-8 h-8 text-amber-300 fill-amber-300" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Premium Scrollable Content */}
        <div className="overflow-y-auto max-h-[calc(92vh-256px-88px)] bg-gradient-to-b from-white to-slate-50/30">
          <div className="p-6 space-y-6">
            
            {/* Premium Pricing Section */}
            {service.variations && service.variations.length > 0 ? (
              <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-blue-50 rounded-3xl p-6 border border-emerald-200/50 shadow-xl">
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-blue-500/10 to-transparent rounded-full blur-3xl"></div>
                
                <div className="relative z-10">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl shadow-lg shadow-emerald-500/30">
                      <DollarSign className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                        Pricing Options
                      </h3>
                      {service.pricingType && (
                        <p className="text-sm text-slate-600 flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5" />
                          {getPricingTypeLabel(service.pricingType)}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid gap-4">
                    {service.variations.map((variation, idx) => (
                      <div 
                        key={idx} 
                        className="group bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-200 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-500/10 transition-all hover:-translate-y-1"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="font-bold text-base text-slate-900 flex items-center gap-2">
                            <ChevronRight className="w-4 h-4 text-emerald-600 group-hover:translate-x-1 transition-transform" />
                            {variation.label}
                          </div>
                          <div className="px-2.5 py-1 bg-emerald-100 rounded-full">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600 inline" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-3 border border-blue-200">
                            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Adult Price</span>
                            <div className="text-lg font-bold text-blue-700 mt-1">
                              {currency} {variation.adultPrice.toFixed(2)}
                            </div>
                          </div>
                          <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl p-3 border border-purple-200">
                            <span className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Child Price</span>
                            <div className="text-lg font-bold text-purple-700 mt-1">
                              {currency} {variation.childPrice.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 shadow-2xl">
                {/* Decorative Background */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-blue-500/20 to-purple-500/20 rounded-full blur-3xl"></div>
                
                <div className="relative z-10 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-slate-400 mb-3">
                      <Tag className="w-4 h-4" />
                      <span className="text-sm font-medium uppercase tracking-wide">Starting from</span>
                    </div>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-4xl font-bold bg-gradient-to-r from-white via-emerald-100 to-white bg-clip-text text-transparent">
                        {currency} {(service.price ?? 0).toFixed(2)}
                      </span>
                    </div>
                    {service.pricingType && (
                      <div className="px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full inline-flex items-center gap-2">
                        <Info className="w-4 h-4 text-emerald-300" />
                        <span className="text-sm text-slate-300">{getPricingTypeLabel(service.pricingType)}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-5 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 backdrop-blur-sm border border-white/20 rounded-3xl">
                    <Sparkles className="w-12 h-12 text-emerald-300" />
                  </div>
                </div>
              </div>
            )}

            {/* Premium Description Section */}
            {(service.description || service.longDescription) && (
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 border border-slate-200 shadow-lg">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg shadow-blue-500/30">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                    About This Extra
                  </h3>
                </div>
                <div className="prose prose-slate max-w-none">
                  <p className="text-slate-700 leading-relaxed text-sm">
                    {service.longDescription || service.description}
                  </p>
                </div>
              </div>
            )}

            {/* Premium Itinerary Section */}
            {service.circuitItinerary && service.circuitItinerary.length > 0 && (
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 border border-slate-200 shadow-lg">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="p-2.5 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg shadow-purple-500/30">
                    <MapPin className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                    Your Journey
                  </h3>
                </div>
                <div className="space-y-4">
                  {service.circuitItinerary.map((step, idx) => (
                    <div key={idx} className="group relative">
                      {/* Timeline Line */}
                      {idx < service.circuitItinerary!.length - 1 && (
                        <div className="absolute left-8 top-20 bottom-0 w-0.5 bg-gradient-to-b from-purple-300 to-transparent"></div>
                      )}
                      
                      <div className="flex gap-4 bg-gradient-to-br from-purple-50 to-white rounded-2xl p-4 border border-purple-200/50 hover:border-purple-300 hover:shadow-xl hover:shadow-purple-500/10 transition-all hover:-translate-y-1">
                        {/* Step Number Badge */}
                        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform">
                          <span className="text-lg font-bold text-white">{idx + 1}</span>
                        </div>
                        
                        <div className="flex-1">
                          {/* Time and Location Pills */}
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            {step.time && (
                              <span className="px-3 py-1.5 bg-purple-100 border border-purple-200 rounded-full text-sm font-semibold text-purple-700 flex items-center gap-1.5">
                                <Clock className="w-4 h-4" />
                                {step.time}
                              </span>
                            )}
                            {step.location && (
                              <span className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-full text-sm text-slate-700 flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5" />
                                {step.location}
                              </span>
                            )}
                          </div>
                          
                          {/* Activity Description */}
                          <p className="text-base font-medium text-slate-900 leading-relaxed">
                            {step.activity}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Premium Gallery Section */}
            {allImages.length > 1 && (
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 border border-slate-200 shadow-lg">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl shadow-lg shadow-cyan-500/30">
                    <ImageIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 flex items-center justify-between">
                    <h3 className="text-lg font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                      Photo Gallery
                    </h3>
                    <span className="px-3 py-1 bg-slate-100 rounded-full text-sm font-semibold text-slate-600">
                      {allImages.length} photos
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {allImages.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImage(idx)}
                      className={`group relative aspect-video rounded-2xl overflow-hidden border-2 transition-all hover:scale-105 ${
                        idx === selectedImage 
                          ? 'border-cyan-500 shadow-xl shadow-cyan-500/30' 
                          : 'border-slate-200 hover:border-cyan-300'
                      }`}
                    >
                      <img 
                        src={img} 
                        alt={`${service.name} ${idx + 1}`} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      {idx === selectedImage && (
                        <div className="absolute top-2 right-2 p-1.5 bg-cyan-500 rounded-full shadow-lg">
                          <Star className="w-4 h-4 text-white fill-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Premium Info Cards Grid */}
            {(service.maxPeople || service.cutoffTime) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {service.maxPeople && (
                  <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-white rounded-2xl p-6 border border-blue-200 shadow-lg hover:shadow-xl hover:shadow-blue-500/10 transition-all hover:-translate-y-1 group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-2xl"></div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-blue-500 rounded-xl shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                          <Users className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Max Capacity</span>
                      </div>
                      <div className="text-2xl font-bold text-blue-700">
                        {service.maxPeople} <span className="text-sm font-medium text-blue-600">people</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {service.cutoffTime && (
                  <div className="relative overflow-hidden bg-gradient-to-br from-amber-50 to-white rounded-2xl p-6 border border-amber-200 shadow-lg hover:shadow-xl hover:shadow-amber-500/10 transition-all hover:-translate-y-1 group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-500/10 to-transparent rounded-full blur-2xl"></div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-amber-500 rounded-xl shadow-lg shadow-amber-500/30 group-hover:scale-110 transition-transform">
                          <Calendar className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Booking Cutoff</span>
                      </div>
                      <div className="text-2xl font-bold text-amber-700">
                        {service.cutoffTime}<span className="text-sm font-medium text-amber-600">h before</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Premium Sticky Footer */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-xl border-t border-slate-200/50 p-6 shadow-2xl">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="px-8 py-4 bg-white border-2 border-slate-300 rounded-2xl text-slate-700 font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all hover:scale-105 active:scale-95 shadow-lg"
            >
              Close
            </button>
            <button
              onClick={() => {
                onAddToStay(service);
                onClose();
              }}
              className="group flex-1 px-8 py-4 bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 text-white rounded-2xl font-bold text-lg hover:from-emerald-700 hover:via-emerald-600 hover:to-emerald-700 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3 shadow-2xl shadow-emerald-600/40 hover:shadow-emerald-600/60"
            >
              <PlusCircle className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
              Add to My Stay
              <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
