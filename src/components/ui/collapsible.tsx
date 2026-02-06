'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

type CollapsibleContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  disabled?: boolean;
};

const CollapsibleContext = React.createContext<CollapsibleContextValue | null>(null);

function useCollapsibleContext() {
  const context = React.useContext(CollapsibleContext);
  if (!context) {
    throw new Error('Collapsible components must be used within <Collapsible>.');
  }
  return context;
}

type CollapsibleProps = React.HTMLAttributes<HTMLDivElement> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
};

const Collapsible = React.forwardRef<HTMLDivElement, CollapsibleProps>(
  (
    { open, defaultOpen = false, onOpenChange, disabled, className, ...props },
    ref
  ) => {
    const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
    const isControlled = typeof open === 'boolean';
    const currentOpen = isControlled ? open : uncontrolledOpen;

    const setOpen = React.useCallback(
      (nextOpen: boolean) => {
        if (!isControlled) {
          setUncontrolledOpen(nextOpen);
        }
        onOpenChange?.(nextOpen);
      },
      [isControlled, onOpenChange]
    );

    const contextValue = React.useMemo(
      () => ({ open: currentOpen, setOpen, disabled }),
      [currentOpen, setOpen, disabled]
    );

    return (
      <CollapsibleContext.Provider value={contextValue}>
        <div ref={ref} className={cn(className)} {...props} />
      </CollapsibleContext.Provider>
    );
  }
);
Collapsible.displayName = 'Collapsible';

type CollapsibleTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
};

const CollapsibleTrigger = React.forwardRef<HTMLButtonElement, CollapsibleTriggerProps>(
  ({ className, onClick, disabled, children, asChild, ...props }, ref) => {
    const { open, setOpen, disabled: contextDisabled } = useCollapsibleContext();
    const isDisabled = disabled || contextDisabled;
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        ref={ref}
        type="button"
        aria-expanded={open}
        aria-controls={props['aria-controls']}
        className={cn(className)}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented && !isDisabled) {
            setOpen(!open);
          }
        }}
        disabled={isDisabled}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);
CollapsibleTrigger.displayName = 'CollapsibleTrigger';

type CollapsibleContentProps = React.HTMLAttributes<HTMLDivElement>;

const CollapsibleContent = React.forwardRef<HTMLDivElement, CollapsibleContentProps>(
  ({ className, children, ...props }, ref) => {
    const { open } = useCollapsibleContext();
    if (!open) {
      return null;
    }
    return (
      <div ref={ref} className={cn(className)} {...props}>
        {children}
      </div>
    );
  }
);
CollapsibleContent.displayName = 'CollapsibleContent';

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
