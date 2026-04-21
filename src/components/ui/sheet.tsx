import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Mobile-first bottom sheet that becomes a centered modal on md+ screens.
 * Sticky header keeps the title + close button always visible while the
 * body scrolls. Respects iOS safe-area at the bottom.
 */
export function SheetBody({
  open,
  onOpenChange,
  children,
  className,
  title,
  description,
  hideClose,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  hideClose?: boolean;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount>
              <motion.div
                className={cn(
                  // Mobile: full-width sheet docked to the bottom.
                  'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl border-t bg-background shadow-2xl',
                  // md+: recentered as a card modal.
                  'md:inset-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-lg md:max-h-[85vh] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:border',
                  className,
                )}
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              >
                {/* ── sticky header ─────────────────────────────────── */}
                <div className="relative shrink-0 px-5 pb-3 pt-3 md:pt-5">
                  <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted md:hidden" />
                  {(title || description) && (
                    <div className="pr-8">
                      {title && (
                        <DialogPrimitive.Title className="text-base font-semibold leading-none">
                          {title}
                        </DialogPrimitive.Title>
                      )}
                      {description && (
                        <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                          {description}
                        </DialogPrimitive.Description>
                      )}
                    </div>
                  )}
                  {!hideClose && (
                    <DialogPrimitive.Close
                      className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted md:top-5"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </DialogPrimitive.Close>
                  )}
                </div>

                {/* ── scrollable body ───────────────────────────────── */}
                <div
                  className="flex-1 overflow-y-auto overscroll-contain px-5"
                  style={{
                    paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))',
                  }}
                >
                  {children}
                </div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
