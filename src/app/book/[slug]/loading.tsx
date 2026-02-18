export default function BookingLoading() {
  return (
    <div className="min-h-screen p-4 flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-xl">
        {/* Header skeleton */}
        <div className="mb-6">
          <div className="h-4 w-12 bg-gray-200 rounded mb-4 animate-pulse" />
          <div className="flex items-center gap-3">
            <div className="w-2 h-10 rounded-full bg-gray-200 animate-pulse" />
            <div>
              <div className="h-6 w-40 bg-gray-200 rounded mb-1 animate-pulse" />
              <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* Card skeleton */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Date picker area */}
          <div className="p-4 border-b border-gray-100">
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

        {/* Footer skeleton */}
        <div className="mt-6 text-center">
          <div className="h-3 w-32 bg-gray-100 rounded mx-auto animate-pulse" />
        </div>
      </div>
    </div>
  );
}
