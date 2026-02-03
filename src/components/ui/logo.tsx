export function Logo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
        <span className="text-white font-bold text-xl">N</span>
      </div>
      <span className="text-xl font-bold text-gray-900">Northstar</span>
    </div>
  );
}
