"use client";

import React from 'react';
import { Icons } from '@/components/icons';
import { format } from 'date-fns';

interface ServiceVariation {
  label: string;
  adultPrice: number;
  childPrice: number;
}

interface ItineraryStep {
  time: string;
  activity: string;
  location: string;
}

interface Service {
  id: string;
  name: string;
  description?: string;
  longDescription?: string;
  price?: number;
  currency?: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  status?: 'Active' | 'Draft' | 'Archived';
  bookingEngine?: boolean;
  guestPortal?: boolean;
  staffOnly?: boolean;
  featuredImage?: string;
  images?: string[];
  tags?: string[];
  variations?: ServiceVariation[];
  circuitItinerary?: ItineraryStep[];
  dailyCapacity?: number | null;
  unlimitedMode?: boolean;
  cutoffTime?: number;
  createdAt?: any;
  updatedAt?: any;
}

interface ServiceDetailsModalProps {
  service: Service;
  categoryName?: string;
  subcategoryName?: string;
  onClose: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

export default function ServiceDetailsModal({
  service,
  categoryName,
  subcategoryName,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
}: ServiceDetailsModalProps) {
  const allImages = service.images || [];
  const heroImage = service.featuredImage || allImages[0] || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Hero Banner */}
        <div className="relative h-72 bg-gradient-to-br from-primary/20 to-primary/5 overflow-hidden">
          {heroImage ? (
            <>
              <img 
                src={heroImage} 
                alt={service.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Icons.Package className="w-24 h-24 text-primary/30" />
            </div>
          )}
          
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-colors shadow-lg"
          >
            <Icons.Close className="w-5 h-5 text-slate-700" />
          </button>

          {/* Service Title & Status */}
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">
                  {service.name}
                </h1>
                <p className="text-white/90 text-sm drop-shadow-md">
                  {service.description || 'No description available'}
                </p>
              </div>
              <div className={`px-4 py-2 rounded-full text-sm font-semibold shadow-lg ${
                service.status === 'Active'
                  ? 'bg-green-500 text-white'
                  : service.status === 'Archived'
                  ? 'bg-slate-500 text-white'
                  : 'bg-amber-500 text-white'
              }`}>
                {service.status || 'Draft'}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-18rem)] p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content - 2 columns */}
            <div className="lg:col-span-2 space-y-6">
              {/* Classification */}
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Icons.Tag className="w-5 h-5 text-primary" />
                  Classification
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Category</div>
                    <div className="text-sm font-medium text-slate-900">{categoryName || '—'}</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Sub-Category</div>
                    <div className="text-sm font-medium text-slate-900">{subcategoryName || '—'}</div>
                  </div>
                </div>
              </div>

              {/* Channel Distribution */}
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Icons.Globe className="w-5 h-5 text-primary" />
                  Distribution Channels
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className={`p-4 rounded-xl border-2 ${service.bookingEngine ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icons.Globe className={`w-4 h-4 ${service.bookingEngine ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span className={`text-xs font-semibold ${service.bookingEngine ? 'text-blue-900' : 'text-slate-500'}`}>
                        Booking Engine
                      </span>
                    </div>
                    <div className={`text-xs ${service.bookingEngine ? 'text-blue-700' : 'text-slate-500'}`}>
                      {service.bookingEngine ? 'Enabled' : 'Disabled'}
                    </div>
                  </div>
                  <div className={`p-4 rounded-xl border-2 ${service.guestPortal ? 'border-purple-200 bg-purple-50' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icons.Smartphone className={`w-4 h-4 ${service.guestPortal ? 'text-purple-600' : 'text-slate-400'}`} />
                      <span className={`text-xs font-semibold ${service.guestPortal ? 'text-purple-900' : 'text-slate-500'}`}>
                        Guest Portal
                      </span>
                    </div>
                    <div className={`text-xs ${service.guestPortal ? 'text-purple-700' : 'text-slate-500'}`}>
                      {service.guestPortal ? 'Enabled' : 'Disabled'}
                    </div>
                  </div>
                  <div className={`p-4 rounded-xl border-2 ${service.staffOnly ? 'border-slate-300 bg-slate-100' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icons.Lock className={`w-4 h-4 ${service.staffOnly ? 'text-slate-700' : 'text-slate-400'}`} />
                      <span className={`text-xs font-semibold ${service.staffOnly ? 'text-slate-900' : 'text-slate-500'}`}>
                        Staff Only
                      </span>
                    </div>
                    <div className={`text-xs ${service.staffOnly ? 'text-slate-700' : 'text-slate-500'}`}>
                      {service.staffOnly ? 'Yes' : 'No'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Long Description */}
              {service.longDescription && (
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <Icons.FileText className="w-5 h-5 text-primary" />
                    Description
                  </h3>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {service.longDescription}
                    </p>
                  </div>
                </div>
              )}

              {/* Tags */}
              {service.tags && service.tags.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <Icons.Tag className="w-5 h-5 text-primary" />
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {service.tags.map((tag, idx) => (
                      <span 
                        key={idx}
                        className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Circuit Itinerary */}
              {service.circuitItinerary && service.circuitItinerary.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <Icons.Map className="w-5 h-5 text-primary" />
                    Circuit Itinerary
                  </h3>
                  <div className="space-y-3">
                    {service.circuitItinerary.map((step, idx) => (
                      <div key={idx} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-primary">{idx + 1}</span>
                          </div>
                          <div className="flex-1 grid grid-cols-3 gap-4">
                            <div>
                              <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Time</div>
                              <div className="text-sm font-medium text-slate-900">{step.time || '—'}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Activity</div>
                              <div className="text-sm font-medium text-slate-900">{step.activity || '—'}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Location</div>
                              <div className="text-sm font-medium text-slate-900">{step.location || '—'}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Gallery */}
              {allImages.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <Icons.ImageIcon className="w-5 h-5 text-primary" />
                    Gallery ({allImages.length} images)
                  </h3>
                  <div className="grid grid-cols-4 gap-3">
                    {allImages.map((img, idx) => (
                      <div 
                        key={idx}
                        className="relative aspect-square rounded-xl overflow-hidden border-2 border-slate-200 hover:border-primary transition-colors group cursor-pointer"
                      >
                        <img src={img} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" />
                        {img === service.featuredImage && (
                          <div className="absolute top-2 right-2 bg-primary text-white text-xs px-2 py-1 rounded-full font-semibold shadow-lg">
                            Featured
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Icons.Eye className="w-6 h-6 text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar - 1 column */}
            <div className="space-y-6">
              {/* Pricing */}
              <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-5 border border-primary/20">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Icons.DollarSign className="w-5 h-5 text-primary" />
                  Pricing
                </h3>
                
                {service.variations && service.variations.length > 0 ? (
                  <div className="space-y-3">
                    {service.variations.map((variation, idx) => (
                      <div key={idx} className="bg-white rounded-xl p-4 border border-slate-200">
                        <div className="font-semibold text-slate-900 mb-3">{variation.label}</div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Adult:</span>
                            <span className="font-semibold text-slate-900">${(variation.adultPrice ?? 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Child:</span>
                            <span className="font-semibold text-slate-900">${(variation.childPrice ?? 0).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-xl p-4 border border-slate-200">
                    <div className="text-2xl font-bold text-slate-900 mb-1">
                      {service.currency || '$'}{service.price?.toFixed(2) || '0.00'}
                    </div>
                    <div className="text-xs text-slate-500">Base Price</div>
                  </div>
                )}
              </div>

              {/* Logistics */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Icons.Clock className="w-5 h-5 text-primary" />
                  Logistics
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Daily Capacity</div>
                    <div className="text-sm font-medium text-slate-900">
                      {service.unlimitedMode ? 'Unlimited' : `${service.dailyCapacity || 0} guests/day`}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Booking Cut-off</div>
                    <div className="text-sm font-medium text-slate-900">
                      {service.cutoffTime || 0} hours before
                    </div>
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Icons.FileText className="w-5 h-5 text-primary" />
                  Metadata
                </h3>
                <div className="space-y-3 text-xs">
                  {service.createdAt && (
                    <div>
                      <div className="text-slate-500 uppercase font-semibold mb-1">Created</div>
                      <div className="text-slate-900">
                        {service.createdAt.toDate ? format(service.createdAt.toDate(), 'MMM dd, yyyy HH:mm') : '—'}
                      </div>
                    </div>
                  )}
                  {service.updatedAt && (
                    <div>
                      <div className="text-slate-500 uppercase font-semibold mb-1">Last Updated</div>
                      <div className="text-slate-900">
                        {service.updatedAt.toDate ? format(service.updatedAt.toDate(), 'MMM dd, yyyy HH:mm') : '—'}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="text-slate-500 uppercase font-semibold mb-1">Service ID</div>
                    <div className="text-slate-900 font-mono">{service.id}</div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                {onEdit && (
                  <button
                    onClick={onEdit}
                    className="w-full px-4 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                  >
                    <Icons.Edit className="w-4 h-4" />
                    Edit Service
                  </button>
                )}
                {onDuplicate && (
                  <button
                    onClick={onDuplicate}
                    className="w-full px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <Icons.Copy className="w-4 h-4" />
                    Duplicate
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={onDelete}
                    className="w-full px-4 py-3 bg-red-50 text-red-600 rounded-xl font-semibold hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <Icons.Trash className="w-4 h-4" />
                    Delete Service
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
