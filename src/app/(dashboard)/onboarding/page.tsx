'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Loader2 } from 'lucide-react';

import { useIntegrations } from '@/hooks/use-integrations';
import { useToast } from '@/hooks/use-toast';
import { parseApiResponse } from '@/lib/utils/api-client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const TOTAL_STEPS = 9;

const stepTitles = [
  'Decision Making',
  'Communication Style',
  'Risk Tolerance',
  'Priorities',
  'Pet Peeves & Team Description',
  'Humor Style',
  'Nickname',
  'Integrations',
  'Analysis',
];

const decisionOptions = ['Data-driven', 'Gut instinct', 'Balanced'];
const communicationOptions = [
  'Direct & concise',
  'Thoughtful & diplomatic',
  'Casual & conversational',
  'Formal & professional',
];
const riskOptions = [
  'Conservative (play it safe)',
  'Moderate (calculated risks)',
  'Aggressive (big swings)',
];
const humorOptions = [
  'Dry/sarcastic',
  'Silly/playful',
  'Witty/clever',
  'Professional (keep it business)',
];
const defaultPriorities = [
  'Growth/scaling',
  'Profitability',
  'Team culture',
  'Innovation',
  'Customer satisfaction',
];

const emailPlatforms = ['GOOGLE_WORKSPACE', 'MICROSOFT_365'];

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { integrations, isLoading, connectIntegration } = useIntegrations();
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasMountedRef = useRef(false);

  const [stepIndex, setStepIndex] = useState(0);
  const [decisionMaking, setDecisionMaking] = useState('');
  const [communicationStyle, setCommunicationStyle] = useState('');
  const [riskTolerance, setRiskTolerance] = useState('');
  const [priorities, setPriorities] = useState<string[]>(defaultPriorities);
  const [petPeeve, setPetPeeve] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [humorStyle, setHumorStyle] = useState('');
  const [nickname, setNickname] = useState('Northstar');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutosaving, setIsAutosaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const connectedPlatforms = useMemo(
    () => integrations.filter((integration) => integration.status !== 'DISCONNECTED'),
    [integrations]
  );

  const emailConnected = connectedPlatforms.some((integration) =>
    emailPlatforms.includes(integration.platform)
  );
  const calendarConnected = emailConnected;
  const driveConnected = emailConnected;

  const progressValue = Math.round(((stepIndex + 1) / TOTAL_STEPS) * 100);

  const isStepValid = useMemo(() => {
    switch (stepIndex) {
      case 0:
        return Boolean(decisionMaking);
      case 1:
        return Boolean(communicationStyle);
      case 2:
        return Boolean(riskTolerance);
      case 3:
        return priorities.length === defaultPriorities.length;
      case 4:
        return true;
      case 5:
        return Boolean(humorStyle);
      case 6:
        return true;
      case 7:
        return emailConnected;
      default:
        return true;
    }
  }, [
    stepIndex,
    decisionMaking,
    communicationStyle,
    riskTolerance,
    priorities,
    humorStyle,
    emailConnected,
  ]);

  const handleNext = () => {
    if (!isStepValid) {
      setErrorMessage('Please complete this step before continuing.');
      return;
    }
    setErrorMessage(null);
    setStepIndex((prev) => Math.min(prev + 1, TOTAL_STEPS - 1));
  };

  const handleBack = () => {
    setErrorMessage(null);
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setPriorities((items) => {
      const oldIndex = items.indexOf(String(active.id));
      const newIndex = items.indexOf(String(over.id));
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const buildProfilePayload = () => ({
    decisionMaking,
    communicationStyle,
    riskTolerance,
    priorities,
    petPeeve,
    teamDescription,
    humorStyle,
    nickname: nickname.trim() || 'Northstar',
    integrations: {
      emailConnected,
      calendarConnected,
      driveConnected,
      connectedPlatforms: connectedPlatforms.map((integration) => integration.platform),
    },
    completedAt: new Date().toISOString(),
  });

  const saveProfile = async (complete: boolean) => {
    const payload = buildProfilePayload();
    const response = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalityProfile: payload,
        nickname: payload.nickname,
        complete,
      }),
    });

    return parseApiResponse<{ user: { id: string } }>(response);
  };

  const handleFinish = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const data = await saveProfile(true);
      if (!data.success) {
        setErrorMessage(data.error.message || 'Failed to save onboarding data.');
        return;
      }

      toast({
        title: 'Onboarding complete',
        description: 'Your responses have been saved.',
      });
      router.push('/chat');
    } catch (error) {
      setErrorMessage('Failed to save onboarding data.');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    if (isSaving) return;

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = setTimeout(async () => {
      try {
        setIsAutosaving(true);
        const data = await saveProfile(false);
        if (!data.success) {
          console.error('Autosave failed:', data.error.message);
        }
      } catch (error) {
        console.error('Autosave failed:', error);
      } finally {
        setIsAutosaving(false);
      }
    }, 800);

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [
    decisionMaking,
    communicationStyle,
    riskTolerance,
    priorities,
    petPeeve,
    teamDescription,
    humorStyle,
    nickname,
    emailConnected,
    calendarConnected,
    driveConnected,
    connectedPlatforms,
    isSaving,
  ]);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Onboarding Questionnaire</h1>
          <span className="text-sm text-gray-500">
            Step {stepIndex + 1} of {TOTAL_STEPS}
          </span>
        </div>
        <Progress value={progressValue} />
      </div>

      <Card className="p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold">{stepTitles[stepIndex]}</h2>
          {stepIndex === 8 && (
            <p className="text-sm text-gray-600 mt-1">
              Northstar is getting everything ready for you.
            </p>
          )}
        </div>

        {stepIndex === 0 && (
          <QuestionBlock
            question="How do you make big decisions?"
            value={decisionMaking}
            options={decisionOptions}
            onChange={setDecisionMaking}
          />
        )}

        {stepIndex === 1 && (
          <QuestionBlock
            question="How would you describe your communication style?"
            value={communicationStyle}
            options={communicationOptions}
            onChange={setCommunicationStyle}
          />
        )}

        {stepIndex === 2 && (
          <QuestionBlock
            question="What's your risk tolerance?"
            value={riskTolerance}
            options={riskOptions}
            onChange={setRiskTolerance}
          />
        )}

        {stepIndex === 3 && (
          <div className="space-y-4">
            <p className="font-medium">What matters most to you? (Rank 1-5)</p>
            <p className="text-sm text-gray-600">
              Drag to reorder. Top item is your highest priority.
            </p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={priorities} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {priorities.map((priority, index) => (
                    <SortablePriorityItem key={priority} id={priority} index={index} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}

        {stepIndex === 4 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="font-medium">What's your biggest pet peeve in business?</p>
              <Textarea
                value={petPeeve}
                onChange={(event) => setPetPeeve(event.target.value)}
                placeholder="Tell us what drives you crazy..."
              />
            </div>
            <div className="space-y-2">
              <p className="font-medium">How would your team describe you?</p>
              <Textarea
                value={teamDescription}
                onChange={(event) => setTeamDescription(event.target.value)}
                placeholder="Thoughtful, decisive, empathetic..."
              />
            </div>
          </div>
        )}

        {stepIndex === 5 && (
          <QuestionBlock
            question="What's your sense of humor like?"
            value={humorStyle}
            options={humorOptions}
            onChange={setHumorStyle}
          />
        )}

        {stepIndex === 6 && (
          <div className="space-y-3">
            <p className="font-medium">Want to give your AI clone a name?</p>
            <Input
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="Northstar"
            />
            <p className="text-sm text-gray-600">
              This is what you&apos;ll call it. It will call you by your name.
            </p>
          </div>
        )}

        {stepIndex === 7 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="font-medium">Email (required)</p>
              <p className="text-sm text-gray-600">
                Connect your email so Northstar can learn your communication style.
              </p>
              <IntegrationStatus
                connected={emailConnected}
                label={emailConnected ? 'Connected' : 'Not connected'}
                tone={emailConnected ? 'success' : 'warning'}
              />
              {!emailConnected && (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => connectIntegration('GOOGLE_WORKSPACE')}>
                    Connect Google Workspace
                  </Button>
                  <Button variant="outline" onClick={() => connectIntegration('MICROSOFT_365')}>
                    Connect Microsoft 365
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="font-medium">Calendar (recommended)</p>
              <IntegrationStatus
                connected={calendarConnected}
                label={calendarConnected ? 'Connected via email integration' : 'Not connected'}
              />
            </div>

            <div className="space-y-2">
              <p className="font-medium">Drive/Docs (recommended)</p>
              <IntegrationStatus
                connected={driveConnected}
                label={driveConnected ? 'Connected via email integration' : 'Not connected'}
              />
            </div>

            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Checking integrations...
              </div>
            )}
          </div>
        )}

        {stepIndex === 8 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-lg font-medium">
                Northstar is analyzing your data. This takes about 24 hours.
              </p>
              <p className="text-sm text-gray-600">
                In the meantime, you can start chatting!
              </p>
            </div>
            <Progress value={65} className="animate-pulse" />
          </div>
        )}

        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
        {isAutosaving && !errorMessage && (
          <p className="text-xs text-gray-500">Autosaving...</p>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleBack} disabled={stepIndex === 0 || isSaving}>
          Back
        </Button>
        {stepIndex < TOTAL_STEPS - 1 ? (
          <Button onClick={handleNext} disabled={!isStepValid}>
            Next
          </Button>
        ) : (
          <Button onClick={handleFinish} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Go to Chat'}
          </Button>
        )}
      </div>
    </div>
  );
}

type QuestionBlockProps = {
  question: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
};

function QuestionBlock({ question, options, value, onChange }: QuestionBlockProps) {
  return (
    <div className="space-y-4">
      <p className="font-medium">{question}</p>
      <RadioGroup value={value} onValueChange={onChange} className="gap-4">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-3 text-sm cursor-pointer">
            <RadioGroupItem value={option} />
            <span>{option}</span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}

type SortablePriorityItemProps = {
  id: string;
  index: number;
};

function SortablePriorityItem({ id, index }: SortablePriorityItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center justify-between rounded-lg border bg-white px-4 py-3 shadow-sm',
        isDragging && 'opacity-80'
      )}
    >
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-500">{index + 1}</span>
        <span className="font-medium">{id}</span>
      </div>
      <button
        type="button"
        className="flex items-center text-gray-400 hover:text-gray-600"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${id}`}
      >
        <GripVertical className="w-4 h-4" />
      </button>
    </div>
  );
}

type IntegrationStatusProps = {
  connected: boolean;
  label: string;
  tone?: 'success' | 'warning';
};

function IntegrationStatus({ connected, label, tone = 'success' }: IntegrationStatusProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
        connected
          ? 'bg-green-100 text-green-700'
          : tone === 'warning'
          ? 'bg-amber-100 text-amber-700'
          : 'bg-gray-100 text-gray-600'
      )}
    >
      {label}
    </div>
  );
}
