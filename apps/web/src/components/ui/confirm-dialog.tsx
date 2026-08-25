import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** e.g. "Delete task?" */
  title: string;
  /** e.g. "This will permanently remove "Task name"." */
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Adds destructive styling to the confirm button. Default true. */
  destructive?: boolean;
  /** Shows a spinner and disables buttons while the action runs. */
  loading?: boolean;
  onConfirm: () => void;
}

/**
 * In-app replacement for native confirm() — themed, keyboard accessible
 * (Enter confirms, Escape cancels), and consistent with the design system.
 * Focus starts on Cancel so accidental Enter can't confirm a destructive act.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  destructive = true,
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus Cancel first — the safe choice for destructive confirmations.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => cancelRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!loading) onOpenChange(next); }}>
      <DialogContent className="max-w-md" onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription className="mt-1.5">{description}</DialogDescription>}
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!loading) onConfirm();
          }}
          className="mt-5 flex justify-end gap-2"
        >
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button type="submit" variant={destructive ? 'destructive' : 'default'} disabled={loading}>
            {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
