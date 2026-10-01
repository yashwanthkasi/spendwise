import { useId, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
export function SheetBody({
  open,
  onOpenChange,
  children,
  className,
  title = "Details",
  description,
  hideClose,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  description?: ReactNode;
  hideClose?: boolean;
}) {
  const descriptionId = useId();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/30" />
        <Dialog.Content
          aria-describedby={description ? descriptionId : undefined}
          className={cn(
            "fixed inset-x-0 bottom-0 z-[70] flex h-[100dvh] flex-col bg-background md:inset-auto md:left-1/2 md:top-1/2 md:h-auto md:max-h-[90dvh] md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:border md:shadow-xl",
            className,
          )}
        >
          <header className="relative shrink-0 border-b p-5 pr-16">
            <Dialog.Title className="text-lg font-semibold">
              {title}
            </Dialog.Title>
            {description && (
              <Dialog.Description
                id={descriptionId}
                className="mt-1 text-sm text-muted-foreground"
              >
                {description}
              </Dialog.Description>
            )}
            {!hideClose && (
              <Dialog.Close
                aria-label="Close"
                className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted"
              >
                <X size={20} />
              </Dialog.Close>
            )}
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
