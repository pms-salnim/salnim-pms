"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit, updateDoc, doc, Timestamp, deleteDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Star, 
  TrendingUp, 
  TrendingDown, 
  MessageSquare, 
  ThumbsUp, 
  ThumbsDown,
  Filter,
  Download,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Globe,
  Mail,
  Building2,
  AlertCircle,
  Eye,
  Reply,
  Archive,
  Trash2,
  ExternalLink,
  Sparkles,
  BarChart3,
  Users,
  Target,
  Award,
  Send
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

// Review interface
interface Review {
  id: string;
  propertyId: string;
  source: 'guest_portal' | 'google' | 'booking' | 'airbnb' | 'expedia' | 'other';
  guestName: string;
  guestEmail?: string;
  reservationId?: string;
  reservationNumber?: string;
  ratings: {
    overall: number;
    cleanliness?: number;
    service?: number;
    amenities?: number;
    location?: number;
    value?: number;
  };
  reviewText: string;
  status: 'pending' | 'approved' | 'rejected' | 'responded';
  isPublic: boolean;
  responses?: Array<{
    text: string;
    respondedBy: string;
    respondedAt: Date | Timestamp;
  }>;
  submittedAt: string | Date | Timestamp;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  externalId?: string; // For reviews from external platforms
  externalUrl?: string; // Link to review on external platform
}

type ReviewSource = 'all' | 'guest_portal' | 'google' | 'booking' | 'airbnb' | 'expedia' | 'other';
type ReviewStatus = 'all' | 'pending' | 'approved' | 'rejected' | 'responded';
type DateRange = '7days' | '30days' | 'thisMonth' | 'allTime';

export default function ReputationManagementPage() {
  const { user, isLoadingAuth } = useAuth();
  
  // State
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSource, setSelectedSource] = useState<ReviewSource>('all');
  const [selectedStatus, setSelectedStatus] = useState<ReviewStatus>('all');
  const [dateRange, setDateRange] = useState<DateRange>('30days');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isRespondModalOpen, setIsRespondModalOpen] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'reviews' | 'analytics'>('overview');
  const [selectedReviews, setSelectedReviews] = useState<Set<string>>(new Set());
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  // Check permissions
  const canManageReviews = user?.permissions?.guests || false;

  // Fetch reviews from Firestore
  useEffect(() => {
    if (!user?.propertyId) {
      setReviews([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const reviewsRef = collection(db, 'reviews');
    const q = query(
      reviewsRef,
      where('propertyId', '==', user.propertyId),
      orderBy('createdAt', 'desc'),
      limit(500)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedReviews = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            submittedAt: data.submittedAt,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          } as Review;
        });
        setReviews(fetchedReviews);
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching reviews:', error);
        toast({ 
          title: 'Error', 
          description: 'Failed to load reviews', 
          variant: 'destructive' 
        });
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.propertyId]);

  // Filter reviews
  const filteredReviews = useMemo(() => {
    let filtered = [...reviews];

    // Filter by source
    if (selectedSource !== 'all') {
      filtered = filtered.filter(r => r.source === selectedSource);
    }

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(r => r.status === selectedStatus);
    }

    // Filter by date range
    const now = new Date();
    let startDate: Date | null = null;
    
    switch (dateRange) {
      case '7days':
        startDate = subDays(now, 7);
        break;
      case '30days':
        startDate = subDays(now, 30);
        break;
      case 'thisMonth':
        startDate = startOfMonth(now);
        break;
      case 'allTime':
        startDate = null;
        break;
    }

    if (startDate) {
      filtered = filtered.filter(r => {
        const reviewDate = r.createdAt instanceof Timestamp 
          ? r.createdAt.toDate() 
          : new Date(r.createdAt);
        return reviewDate >= startDate!;
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.guestName.toLowerCase().includes(query) ||
        r.reviewText.toLowerCase().includes(query) ||
        r.reservationNumber?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [reviews, selectedSource, selectedStatus, dateRange, searchQuery]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = filteredReviews.length;
    const pending = filteredReviews.filter(r => r.status === 'pending').length;
    const approved = filteredReviews.filter(r => r.status === 'approved').length;
    const responded = filteredReviews.filter(r => r.status === 'responded').length;
    
    const totalRating = filteredReviews.reduce((sum, r) => sum + r.ratings.overall, 0);
    const averageRating = total > 0 ? totalRating / total : 0;
    
    const positive = filteredReviews.filter(r => r.ratings.overall >= 4).length;
    const negative = filteredReviews.filter(r => r.ratings.overall <= 2).length;
    
    const bySource = {
      guest_portal: filteredReviews.filter(r => r.source === 'guest_portal').length,
      google: filteredReviews.filter(r => r.source === 'google').length,
      booking: filteredReviews.filter(r => r.source === 'booking').length,
      airbnb: filteredReviews.filter(r => r.source === 'airbnb').length,
      expedia: filteredReviews.filter(r => r.source === 'expedia').length,
      other: filteredReviews.filter(r => r.source === 'other').length,
    };

    const responseRate = total > 0 ? (responded / total) * 100 : 0;
    
    return {
      total,
      pending,
      approved,
      responded,
      averageRating,
      positive,
      negative,
      bySource,
      responseRate,
    };
  }, [filteredReviews]);

  // Handlers
  const handleViewReview = (review: Review) => {
    setSelectedReview(review);
    setIsDetailModalOpen(true);
  };

  const handleRespondToReview = (review: Review) => {
    setSelectedReview(review);
    setResponseText('');
    setIsRespondModalOpen(true);
  };

  const handleUpdateStatus = async (reviewId: string, newStatus: Review['status']) => {
    if (!canManageReviews) {
      toast({ title: 'Permission Denied', description: 'You do not have permission to update reviews', variant: 'destructive' });
      return;
    }

    try {
      await updateDoc(doc(db, 'reviews', reviewId), {
        status: newStatus,
        updatedAt: Timestamp.now(),
      });
      toast({ title: 'Success', description: 'Review status updated' });
    } catch (error) {
      console.error('Error updating review status:', error);
      toast({ title: 'Error', description: 'Failed to update review status', variant: 'destructive' });
    }
  };

  const handleSubmitResponse = async () => {
    if (!selectedReview || !responseText.trim() || !canManageReviews) return;

    setIsSubmittingResponse(true);
    try {
      const newResponse = {
        text: responseText.trim(),
        respondedBy: user?.id || 'Unknown',
        respondedAt: Timestamp.now(),
      };

      await updateDoc(doc(db, 'reviews', selectedReview.id), {
        responses: [...(selectedReview.responses || []), newResponse],
        status: 'responded',
        updatedAt: Timestamp.now(),
      });
      
      toast({ title: 'Success', description: 'Response submitted successfully' });
      setIsRespondModalOpen(false);
      setResponseText('');
      setSelectedReview(null);
    } catch (error) {
      console.error('Error submitting response:', error);
      toast({ title: 'Error', description: 'Failed to submit response', variant: 'destructive' });
    } finally {
      setIsSubmittingResponse(false);
    }
  };

  const toggleReviewSelection = (reviewId: string) => {
    const newSelected = new Set(selectedReviews);
    if (newSelected.has(reviewId)) {
      newSelected.delete(reviewId);
    } else {
      newSelected.add(reviewId);
    }
    setSelectedReviews(newSelected);
  };

  const toggleAllReviews = (reviews: Review[]) => {
    if (selectedReviews.size === reviews.length && reviews.length > 0) {
      setSelectedReviews(new Set());
    } else {
      setSelectedReviews(new Set(reviews.map(r => r.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedReviews.size === 0) return;

    setIsDeletingBulk(true);
    try {
      const deletePromises = Array.from(selectedReviews).map(reviewId =>
        deleteDoc(doc(db, 'reviews', reviewId))
      );
      await Promise.all(deletePromises);
      
      toast({ 
        title: 'Success', 
        description: `Deleted ${selectedReviews.size} review${selectedReviews.size !== 1 ? 's' : ''}` 
      });
      setSelectedReviews(new Set());
      setIsBulkDeleteDialogOpen(false);
    } catch (error) {
      console.error('Error deleting reviews:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to delete reviews', 
        variant: 'destructive' 
      });
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const getSourceIcon = (source: Review['source']) => {
    switch (source) {
      case 'guest_portal':
        return <Building2 className="w-4 h-4" />;
      case 'google':
        return <Globe className="w-4 h-4" />;
      case 'booking':
        return <Mail className="w-4 h-4" />;
      default:
        return <ExternalLink className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: Review['status']) => {
    const variants = {
      pending: { variant: 'outline' as const, icon: Clock, color: 'text-amber-600' },
      approved: { variant: 'default' as const, icon: CheckCircle2, color: 'text-emerald-600' },
      rejected: { variant: 'destructive' as const, icon: XCircle, color: 'text-rose-600' },
      responded: { variant: 'secondary' as const, icon: Reply, color: 'text-blue-600' },
    };

    const config = variants[status];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              'w-4 h-4',
              star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
            )}
          />
        ))}
      </div>
    );
  };

  // Loading state
  if (isLoadingAuth || isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Icons.Spinner className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Permission check
  if (!canManageReviews) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You do not have permission to access reputation management.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Reputation Management</h1>
          <p className="text-slate-600 mt-2">
            Monitor and respond to reviews from all platforms
          </p>
        </div>
        <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Download className="w-4 h-4" />
          Export
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="p-4 flex gap-4 items-center flex-wrap">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-[250px]">
            <Icons.Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by guest name, review text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filter Controls */}
          <div className="flex gap-2 items-center flex-shrink-0">
            <Select value={selectedSource} onValueChange={(v) => setSelectedSource(v as ReviewSource)}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="guest_portal">Guest Portal</SelectItem>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="booking">Booking.com</SelectItem>
                <SelectItem value="airbnb">Airbnb</SelectItem>
                <SelectItem value="expedia">Expedia</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as ReviewStatus)}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="responded">Responded</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateRange} onValueChange={(v) => setDateRange(v as any)}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="7days">Last 7 Days</SelectItem>
                <SelectItem value="30days">Last 30 Days</SelectItem>
                <SelectItem value="90days">Last 90 Days</SelectItem>
                <SelectItem value="thisMonth">This Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3 bg-slate-100 border-b border-slate-200">
          <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-slate-900">
            <BarChart3 className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="reviews" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-slate-900">
            <MessageSquare className="w-4 h-4" />
            Reviews
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-slate-900">
            <TrendingUp className="w-4 h-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-amber-500 transition-transform hover:-translate-y-1">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Average Rating</p>
                  <h3 className="text-2xl font-bold mt-1 text-slate-800">{stats.averageRating.toFixed(1)}</h3>
                </div>
                <div className="p-2 rounded-lg bg-amber-50">
                  <Star size={18} className="text-amber-600" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-[10px] font-medium text-amber-600">Based on {stats.total} reviews</span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-blue-500 transition-transform hover:-translate-y-1">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Reviews</p>
                  <h3 className="text-2xl font-bold mt-1 text-slate-800">{stats.total}</h3>
                </div>
                <div className="p-2 rounded-lg bg-blue-50">
                  <MessageSquare size={18} className="text-blue-600" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-[10px] font-medium text-blue-600">{stats.pending} pending approval</span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-emerald-500 transition-transform hover:-translate-y-1">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Response Rate</p>
                  <h3 className="text-2xl font-bold mt-1 text-slate-800">{stats.responseRate.toFixed(0)}%</h3>
                </div>
                <div className="p-2 rounded-lg bg-emerald-50">
                  <Reply size={18} className="text-emerald-600" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-[10px] font-medium text-emerald-600">{stats.responded} of {stats.total} responded</span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-cyan-500 transition-transform hover:-translate-y-1">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending Actions</p>
                  <h3 className="text-2xl font-bold mt-1 text-slate-800">{stats.pending}</h3>
                </div>
                <div className="p-2 rounded-lg bg-cyan-50">
                  <AlertCircle size={18} className="text-cyan-600" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-[10px] font-medium text-cyan-600">Reviews awaiting review</span>
              </div>
            </div>
          </div>

          {/* Review Sources & Recent Reviews Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Review Sources */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
              <div className="p-6 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900">Review Sources</h3>
                <p className="text-sm text-slate-600 mt-1">Distribution of reviews by platform</p>
              </div>
              <div className="p-6 space-y-4">
                {Object.entries(stats.bySource).map(([source, count]) => (
                  <div key={source} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getSourceIcon(source as Review['source'])}
                      <span className="text-sm font-medium text-slate-700 capitalize">
                        {source.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-20 bg-slate-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold w-8 text-right text-slate-900">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Reviews */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
              <div className="p-6 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900">Recent Reviews</h3>
                <p className="text-sm text-slate-600 mt-1">Latest guest feedback</p>
              </div>
              <div className="p-6">
                <ScrollArea className="h-80">
                  <div className="space-y-2">
                    {filteredReviews.slice(0, 5).map((review) => (
                      <div 
                        key={review.id}
                        onClick={() => handleViewReview(review)}
                        className="flex gap-2 p-2 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all group cursor-pointer"
                      >
                        <Avatar className="h-9 w-9 flex-shrink-0">
                          <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                            {review.guestName.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="text-xs font-medium text-slate-900">{review.guestName}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                {renderStars(review.ratings.overall)}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {getStatusBadge(review.status)}
                            </div>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-1">{review.reviewText}</p>
                          <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            {review.status === 'pending' && (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="h-6 text-xs px-2"
                                  onClick={() => {
                                    handleUpdateStatus(review.id, 'rejected');
                                  }}
                                >
                                  <XCircle className="w-2.5 h-2.5 mr-1" />
                                  Reject
                                </Button>
                                <Button 
                                  size="sm"
                                  className="h-6 text-xs px-2 bg-emerald-600 hover:bg-emerald-700"
                                  onClick={() => {
                                    handleUpdateStatus(review.id, 'approved');
                                  }}
                                >
                                  <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                                  Approve
                                </Button>
                              </>
                            )}
                            <Button 
                              size="sm"
                              variant="outline"
                              className="h-6 text-xs px-2"
                              onClick={() => handleRespondToReview(review)}
                            >
                              <Reply className="w-2.5 h-2.5 mr-1" />
                              Reply
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Reviews Tab */}
        <TabsContent value="reviews" className="space-y-6">
          {/* Bulk Delete Toolbar */}
          {selectedReviews.size > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">
                  {selectedReviews.size} review{selectedReviews.size !== 1 ? 's' : ''} selected
                </span>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsBulkDeleteDialogOpen(true)}
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected
              </Button>
            </div>
          )}

          {/* Reviews List */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            {/* Reviews Container */}
            <div className="divide-y divide-slate-200">
              {filteredReviews.length === 0 ? (
                <div className="p-12 text-center">
                  <MessageSquare className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-1">No reviews found</h3>
                  <p className="text-slate-600">Adjust your filters to find reviews</p>
                </div>
              ) : (
                <>
                  {/* Select All Header */}
                  {filteredReviews.length > 0 && (
                    <div className="p-3 bg-slate-50 flex items-center gap-3">
                      <button
                        onClick={() => toggleAllReviews(filteredReviews)}
                        className="flex items-center justify-center w-5 h-5 rounded border border-slate-300 hover:border-blue-500 hover:bg-blue-50 transition-colors"
                      >
                        {selectedReviews.size === filteredReviews.length && filteredReviews.length > 0 && (
                          <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        )}
                      </button>
                      <span className="text-xs font-medium text-slate-600">Select All</span>
                    </div>
                  )}
                  
                  {filteredReviews.map((review) => (
                    <div key={review.id} className="flex items-start gap-3 p-3 hover:bg-slate-50 transition-colors group border-b border-slate-200 last:border-b-0">
                      <button
                        onClick={() => toggleReviewSelection(review.id)}
                        className="flex items-center justify-center w-5 h-5 mt-0.5 flex-shrink-0 rounded border border-slate-300 hover:border-blue-500 hover:bg-blue-50 transition-colors"
                      >
                        {selectedReviews.has(review.id) && (
                          <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        )}
                      </button>
                      
                      <div
                        onClick={() => handleViewReview(review)}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-slate-900">{review.guestName}</span>
                              <div className="flex items-center gap-0.5">
                                {renderStars(review.ratings.overall)}
                              </div>
                              <span className="text-xs font-bold text-slate-700">{review.ratings.overall}/5</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-600">
                              <span className="flex items-center gap-1 capitalize">
                                {getSourceIcon(review.source)}
                                {review.source.replace('_', ' ')}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {format(
                                  review.submittedAt instanceof Timestamp 
                                    ? review.submittedAt.toDate() 
                                    : new Date(review.submittedAt),
                                  'MMM dd, yyyy'
                                )}
                              </span>
                              {review.reservationNumber && (
                                <>
                                  <span>•</span>
                                  <span>Booking #{review.reservationNumber}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            {getStatusBadge(review.status)}
                          </div>
                        </div>

                        <p className="text-xs text-slate-700 line-clamp-1 mb-1">{review.reviewText}</p>

                        {/* Detailed Ratings */}
                        {(review.ratings.cleanliness || review.ratings.service || review.ratings.amenities) && (
                          <div className="flex flex-wrap gap-2 text-xs mb-1">
                            {review.ratings.cleanliness && (
                              <span className="text-slate-600">Cleanliness: <span className="font-semibold text-slate-900">{review.ratings.cleanliness}/5</span></span>
                            )}
                            {review.ratings.service && (
                              <span className="text-slate-600">Service: <span className="font-semibold text-slate-900">{review.ratings.service}/5</span></span>
                            )}
                            {review.ratings.amenities && (
                              <span className="text-slate-600">Amenities: <span className="font-semibold text-slate-900">{review.ratings.amenities}/5</span></span>
                            )}
                          </div>
                        )}

                        {/* Response Status */}
                        {review.responses && review.responses.length > 0 && (
                          <div className="text-xs text-emerald-700 font-medium bg-emerald-50 rounded px-2 py-1 inline-block mb-1">
                            ✓ {review.responses.length} response{review.responses.length !== 1 ? 's' : ''}
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                          {review.status === 'pending' && (
                            <>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="h-6 text-xs px-2"
                                onClick={() => {
                                  handleUpdateStatus(review.id, 'rejected');
                                }}
                              >
                                <XCircle className="w-2.5 h-2.5 mr-1" />
                                Reject
                              </Button>
                              <Button 
                                size="sm"
                                className="h-6 text-xs px-2 bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => {
                                  handleUpdateStatus(review.id, 'approved');
                                }}
                              >
                                <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                                Approve
                              </Button>
                            </>
                          )}
                          <Button 
                            size="sm"
                            variant="outline"
                            className="h-6 text-xs px-2"
                            onClick={() => handleRespondToReview(review)}
                          >
                            <Reply className="w-2.5 h-2.5 mr-1" />
                            Reply
                          </Button>
                        </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Analytics Coming Soon</h3>
            <p className="text-slate-600">Detailed analytics and insights will be available soon.</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Review Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Details</DialogTitle>
            <DialogDescription>
              Full review information and history
            </DialogDescription>
          </DialogHeader>
          {selectedReview && (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{selectedReview.guestName}</h3>
                  <p className="text-sm text-muted-foreground">{selectedReview.guestEmail}</p>
                </div>
                <div className="flex items-center gap-2">
                  {renderStars(selectedReview.ratings.overall)}
                  <span className="text-2xl font-bold">{selectedReview.ratings.overall}/5</span>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Source</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {getSourceIcon(selectedReview.source)}
                    <span className="capitalize">{selectedReview.source.replace('_', ' ')}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedReview.status)}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Submitted</Label>
                  <p className="mt-1">
                    {format(
                      selectedReview.submittedAt instanceof Timestamp 
                        ? selectedReview.submittedAt.toDate() 
                        : new Date(selectedReview.submittedAt),
                      'MMM dd, yyyy hh:mm a'
                    )}
                  </p>
                </div>
                {selectedReview.reservationNumber && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Reservation</Label>
                    <p className="mt-1">#{selectedReview.reservationNumber}</p>
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <Label>Review</Label>
                <p className="mt-2 text-sm leading-relaxed">{selectedReview.reviewText}</p>
              </div>

              {selectedReview.responses && selectedReview.responses.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <Label>Your Responses ({selectedReview.responses.length})</Label>
                    {selectedReview.responses.map((response, index) => (
                      <div key={index} className="p-3 bg-muted rounded-lg space-y-2">
                        <p className="text-sm leading-relaxed">{response.text}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {format(
                              response.respondedAt instanceof Timestamp 
                                ? response.respondedAt.toDate() 
                                : new Date(response.respondedAt),
                              'MMM dd, yyyy \u0027at\u0027 h:mm a'
                            )}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter className="flex items-center justify-between pt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsDetailModalOpen(false)}
            >
              Close
            </Button>
            <div className="flex gap-2">
              {selectedReview?.status === 'pending' && (
                <>
                  <Button 
                    variant="destructive"
                    onClick={() => {
                      handleUpdateStatus(selectedReview.id, 'rejected');
                      setIsDetailModalOpen(false);
                    }}
                    className="gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </Button>
                  <Button 
                    onClick={() => {
                      handleUpdateStatus(selectedReview.id, 'approved');
                      setIsDetailModalOpen(false);
                    }}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve
                  </Button>
                </>
              )}
              <Button 
                onClick={() => {
                  if (selectedReview) {
                    setIsDetailModalOpen(false);
                    handleRespondToReview(selectedReview);
                  }
                }}
                className="gap-2"
              >
                <Reply className="w-4 h-4" />
                Reply
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Respond Modal */}
      <Dialog open={isRespondModalOpen} onOpenChange={setIsRespondModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Respond to Review</DialogTitle>
            <DialogDescription>
              Write a thoughtful response to this guest's review
            </DialogDescription>
          </DialogHeader>
          {selectedReview && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold">{selectedReview.guestName}</span>
                  {renderStars(selectedReview.ratings.overall)}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {selectedReview.reviewText}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="response">Your Response</Label>
                <Textarea
                  id="response"
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Thank you for your feedback..."
                  rows={6}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  {responseText.length} characters
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsRespondModalOpen(false);
                setResponseText('');
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitResponse}
              disabled={!responseText.trim() || isSubmittingResponse}
              className="gap-2"
            >
              {isSubmittingResponse ? (
                <>
                  <Icons.Spinner className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Response
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Reviews</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedReviews.size} review{selectedReviews.size !== 1 ? 's' : ''}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsBulkDeleteDialogOpen(false)}
              disabled={isDeletingBulk}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isDeletingBulk}
              className="gap-2"
            >
              {isDeletingBulk ? (
                <>
                  <Icons.Spinner className="w-4 h-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
