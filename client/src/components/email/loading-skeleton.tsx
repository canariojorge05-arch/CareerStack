import React from 'react';

export const EmailListSkeleton = React.memo(() => {
  return (
    <div className="space-y-2 p-4">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg animate-pulse"
        >
          <div className="flex-shrink-0">
            <div className="h-4 w-4 bg-gray-200 rounded" />
          </div>
          <div className="flex-shrink-0">
            <div className="h-4 w-4 bg-gray-200 rounded" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-3 w-32 bg-gray-200 rounded" />
              <div className="h-3 w-48 bg-gray-200 rounded" />
              <div className="ml-auto h-3 w-16 bg-gray-200 rounded" />
            </div>
            <div className="h-2 w-full bg-gray-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
});
EmailListSkeleton.displayName = 'EmailListSkeleton';

export const EmailDetailSkeleton = React.memo(() => {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="space-y-2">
        <div className="h-6 w-3/4 bg-gray-200 rounded" />
        <div className="h-4 w-1/4 bg-gray-200 rounded" />
      </div>
      <div className="flex items-start gap-3 pt-4">
        <div className="h-10 w-10 bg-gray-200 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/3 bg-gray-200 rounded" />
          <div className="h-3 w-1/4 bg-gray-100 rounded" />
        </div>
      </div>
      <div className="space-y-2 pt-4">
        <div className="h-3 w-full bg-gray-100 rounded" />
        <div className="h-3 w-full bg-gray-100 rounded" />
        <div className="h-3 w-3/4 bg-gray-100 rounded" />
        <div className="h-3 w-full bg-gray-100 rounded" />
        <div className="h-3 w-2/3 bg-gray-100 rounded" />
      </div>
    </div>
  );
});
EmailDetailSkeleton.displayName = 'EmailDetailSkeleton';

export const ComposeSkeleton = React.memo(() => {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-10 w-full bg-gray-200 rounded" />
      <div className="h-10 w-full bg-gray-200 rounded" />
      <div className="h-64 w-full bg-gray-100 rounded" />
    </div>
  );
});
ComposeSkeleton.displayName = 'ComposeSkeleton';
