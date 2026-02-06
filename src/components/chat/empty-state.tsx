import { useEffect, useRef } from 'react';
import { Sparkles, TrendingUp, FileText, Users, Mail, Send } from 'lucide-react';

interface EmptyStateProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  isSubmitting: boolean;
}

const exampleQuestions = [
  { text: 'What was our Q4 revenue?', Icon: TrendingUp },
  { text: 'Draft a board report for this month', Icon: FileText },
  { text: 'How many new customers this month?', Icon: Users },
  { text: 'Draft an email to the team', Icon: Mail },
];

const connectedTools = [
  { name: 'Google', src: '/logos/google.svg' },
  { name: 'Microsoft', src: '/logos/microsoft.svg' },
  { name: 'Slack', src: '/logos/slack.svg' },
];

export function EmptyState({
  value,
  onChange,
  onSubmit,
  isSubmitting,
}: EmptyStateProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleQuestionClick = (question: string) => {
    onChange(question);
    textareaRef.current?.focus();
  };

  const handleSubmit = () => {
    if (!value.trim() || isSubmitting) return;
    onSubmit(value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);
  return (
    <div className="flex h-full flex-col items-center justify-center p-8">
      <div className="w-full max-w-3xl">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-500">
          <Sparkles className="h-8 w-8 text-white" />
        </div>

        <h1 className="text-center text-4xl font-semibold text-gray-900">
          What can I do for you?
        </h1>

        <p className="mt-4 text-center text-lg text-gray-600">
          I'm your Second Brain. I have access to all your company data and can help
          with analysis, reports, emails, and more.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {exampleQuestions.map((question) => (
            <div
              key={question.text}
              className="group border border-gray-200 rounded-xl p-4 bg-white cursor-pointer transition-all duration-200 hover:border-blue-300 hover:shadow-md hover:-translate-y-1"
              onClick={() => handleQuestionClick(question.text)}
            >
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-blue-50 p-2 text-blue-600 transition-colors group-hover:bg-blue-100">
                  <question.Icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  {question.text}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12">
          <div className="relative rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Assign a task or ask anything"
              rows={1}
              className="w-full min-h-[52px] max-h-[200px] resize-none border-none p-0 pr-10 focus:outline-none"
            />
            <button
              onClick={handleSubmit}
              disabled={!value.trim() || isSubmitting}
              className="absolute right-2 top-2 rounded-md bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:opacity-50"
              aria-label="Send message"
              type="button"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-gray-500">
            Press{' '}
            <kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">
              Enter
            </kbd>{' '}
            to send
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xs text-gray-500">
            <span className="rounded-full border border-gray-200 bg-white px-3 py-1">
              Connect your tools
            </span>
            <div className="flex items-center gap-2">
              {connectedTools.map((tool) => (
                <span
                  key={tool.name}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white"
                >
                  <img src={tool.src} alt={tool.name} className="h-4 w-4" />
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
