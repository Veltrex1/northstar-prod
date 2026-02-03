import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Database } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SecondBrainToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

export function SecondBrainToggle({ enabled, onToggle }: SecondBrainToggleProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <Database className={`w-4 h-4 ${enabled ? 'text-primary' : 'text-gray-400'}`} />
              <Label htmlFor="second-brain" className="text-sm cursor-pointer">
                Second Brain
              </Label>
              <Switch
                id="second-brain"
                checked={enabled}
                onCheckedChange={onToggle}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs">
              When enabled, Northstar searches your company's knowledge bank to answer questions
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
