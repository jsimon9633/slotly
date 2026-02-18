export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-8 bg-gray-50">
      <div className="w-full max-w-5xl">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-6 sm:mb-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-200 animate-pulse" />
            <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="h-8 w-20 bg-gray-100 rounded-lg animate-pulse" />
        </div>

        {/* Desktop layout */}
        <div className="hidden sm:flex gap-6">
          {/* Event type list */}
          <div className="w-72 space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-white border border-gray-200 animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                  <div>
                    <div className="h-4 w-32 bg-gray-200 rounded mb-1" />
                    <div className="h-3 w-16 bg-gray-100 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Booking preview */}
          <div className="flex-1 bg-white rounded-2xl border border-gray-200 p-6">
            <div className="h-6 w-48 bg-gray-200 rounded mb-2 animate-pulse" />
            <div className="h-4 w-32 bg-gray-100 rounded mb-6 animate-pulse" />
            <div className="h-4 w-24 bg-gray-200 rounded mb-3 animate-pulse" />
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div
                  key={i}
                  className="flex-1 h-20 bg-gray-100 rounded-xl animate-pulse"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Mobile layout */}
        <div className="sm:hidden space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-white border border-gray-200 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                <div>
                  <div className="h-4 w-32 bg-gray-200 rounded mb-1" />
                  <div className="h-3 w-16 bg-gray-100 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer skeleton */}
        <div className="mt-6 text-center">
          <div className="h-3 w-32 bg-gray-100 rounded mx-auto animate-pulse" />
        </div>
      </div>
    </div>
  );
}
