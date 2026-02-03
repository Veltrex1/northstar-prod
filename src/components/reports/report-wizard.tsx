'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';

interface ReportWizardProps {
  onGenerate: (params: {
    format: string;
    structure: string;
    focusAreas: string[];
  }) => void;
  isLoading: boolean;
}

export function ReportWizard({ onGenerate, isLoading }: ReportWizardProps) {
  const [step, setStep] = useState(1);
  const [format, setFormat] = useState('pdf');
  const [structure, setStructure] = useState('standard');
  const [focusAreas, setFocusAreas] = useState<string[]>(['financial', 'operational']);

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      onGenerate({ format, structure, focusAreas });
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const toggleFocusArea = (area: string) => {
    setFocusAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Step {step} of 3</h3>
          <div className="flex gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`w-2 h-2 rounded-full ${
                  s <= step ? 'bg-primary' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <Label>Choose report format:</Label>
            <RadioGroup value={format} onValueChange={setFormat}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pdf" id="pdf" />
                <Label htmlFor="pdf">PDF</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="powerpoint" id="powerpoint" />
                <Label htmlFor="powerpoint">PowerPoint</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="word" id="word" />
                <Label htmlFor="word">Word</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="google_slides" id="google_slides" />
                <Label htmlFor="google_slides">Google Slides</Label>
              </div>
            </RadioGroup>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Label>Report structure:</Label>
            <RadioGroup value={structure} onValueChange={setStructure}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="standard" id="standard" />
                <Label htmlFor="standard">Standard template</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom">Custom (describe what you want)</Label>
              </div>
            </RadioGroup>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <Label>What should the report cover?</Label>
            <div className="space-y-2">
              {['financial', 'operational', 'strategic', 'market'].map((area) => (
                <div key={area} className="flex items-center space-x-2">
                  <Checkbox
                    id={area}
                    checked={focusAreas.includes(area)}
                    onCheckedChange={() => toggleFocusArea(area)}
                  />
                  <Label htmlFor={area} className="capitalize">
                    {area === 'market' ? 'Market position' : area} performance
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
          )}
          <Button onClick={handleNext} disabled={isLoading} className="flex-1">
            {step === 3 ? (isLoading ? 'Generating...' : 'Generate Report') : 'Next'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
