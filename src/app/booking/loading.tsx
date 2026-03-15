
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <Skeleton className="h-10 w-64" />
        </div>
        
        {/* Search Bar Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end p-4 border rounded-lg">
            <Skeleton className="h-10 w-full col-span-1 md:col-span-2" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
        </div>
        
        {/* Main Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
             {/* Tabs Skeleton */}
            <Skeleton className="h-10 w-72" />
            {/* Room Card Skeleton */}
            <div className="space-y-4">
                <Skeleton className="h-48 w-full rounded-lg" />
                <Skeleton className="h-48 w-full rounded-lg" />
                <Skeleton className="h-48 w-full rounded-lg" />
            </div>
          </div>
          <div className="lg:col-span-1 space-y-4">
             {/* Summary Panel Skeleton */}
            <Skeleton className="h-64 w-full rounded-lg" />
            {/* Property Info Skeleton */}
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
