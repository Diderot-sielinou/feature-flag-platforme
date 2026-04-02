import { Sparkles } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="relative inline-block">
          {/* Outer ring */}
          <div className="absolute inset-0 h-20 w-20 rounded-full border-4 border-muted animate-pulse" />
          
          {/* Spinning ring */}
          <div className="h-20 w-20 rounded-full border-4 border-tangerine border-t-transparent animate-spin" />
          
          {/* Center icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-tangerine animate-pulse" />
          </div>
        </div>
        
        <p className="mt-6 text-muted-foreground font-medium">Loading...</p>
      </div>
    </div>
  );
}
