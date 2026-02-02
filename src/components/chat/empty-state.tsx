import { Sparkles } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mb-4">
        <Sparkles className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        Welcome to Northstar
      </h2>
      <p className="text-gray-600 max-w-md">
        Your AI-powered Virtual Chief AI Officer. Ask me anything about your business,
        and I'll search through all your company data to provide accurate answers.
      </p>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
        <div className="p-4 bg-gray-50 rounded-lg text-left">
          <p className="text-sm font-medium text-gray-900 mb-1">Example question</p>
          <p className="text-xs text-gray-600">"What was our Q4 revenue?"</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg text-left">
          <p className="text-sm font-medium text-gray-900 mb-1">Example question</p>
          <p className="text-xs text-gray-600">"Draft a board report for this month"</p>
        </div>
      </div>
    </div>
  );
}
