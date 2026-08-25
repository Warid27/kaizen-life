import * as React from "react"
import { cn } from "@/lib/utils"

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Stack of currently open dialogs (most recent last). Only the topmost dialog
 * reacts to Escape and Tab, so a confirmation layered over a form dialog
 * closes alone and never steals focus into the dialog underneath.
 */
const dialogStack: symbol[] = []

function Dialog({ open, onOpenChange, children }: DialogProps) {
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const restoreTargetRef = React.useRef<HTMLElement | null>(null)

  // Escape-to-close, focus trap, and focus restoration.
  React.useEffect(() => {
    if (!open) return

    const stackId = Symbol('dialog')
    dialogStack.push(stackId)
    const isTopmost = () => dialogStack[dialogStack.length - 1] === stackId

    // Capture the restore target once per open transition (the parent may
    // re-render while the dialog is open, e.g. isPending flips).
    if (!restoreTargetRef.current) {
      restoreTargetRef.current = document.activeElement as HTMLElement | null
    }

    // Focus the first focusable element inside the dialog on open.
    const focusInitial = () => {
      const container = contentRef.current
      if (!container) return
      // Prefer autofocus targets, else the first focusable, else the container.
      const autofocus = container.querySelector<HTMLElement>('[data-autofocus]')
      const first = autofocus ?? container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      ;(first ?? container).focus({ preventScroll: true })
    }
    const raf = requestAnimationFrame(focusInitial)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isTopmost()) return
      if (e.key === 'Escape') {
        e.stopPropagation()
        onOpenChange(false)
        return
      }
      if (e.key !== 'Tab') return

      // Keep Tab cycling inside the dialog (basic focus trap).
      const container = contentRef.current
      if (!container) return
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null)
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (e.shiftKey) {
        if (active === first || !container.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else if (active === last || !container.contains(active)) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    document.body.classList.add('dialog-open')

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', handleKeyDown, true)
      const idx = dialogStack.indexOf(stackId)
      if (idx !== -1) dialogStack.splice(idx, 1)
      // Only unfreeze scrolling when the LAST dialog closes.
      if (dialogStack.length === 0) {
        document.body.classList.remove('dialog-open')
      }
      // Restore focus to where the user was before opening.
      restoreTargetRef.current?.focus({ preventScroll: true })
      restoreTargetRef.current = null
    }
  }, [open, onOpenChange])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={() => onOpenChange(false)}
      />
      {/* Content container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        {children}
      </div>
    </div>
  )
}

const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { onClose?: () => void }
>(({ className, children, onClose, ...props }, forwardedRef) => {
  const innerRef = React.useRef<HTMLDivElement | null>(null)

  // Associate the dialog with its <h2> title (DialogTitle) for screen readers
  // without changing the component API.
  React.useEffect(() => {
    const node = innerRef.current
    if (!node) return
    const title = node.querySelector('h2')
    if (title) {
      if (!title.id) title.id = `dialog-title-${Math.random().toString(36).slice(2, 9)}`
      node.setAttribute('aria-labelledby', title.id)
    }
  }, [])

  React.useImperativeHandle(forwardedRef, () => innerRef.current as HTMLDivElement)

  return (
    <div
      ref={innerRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      className={cn(
        "relative z-50 w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-lg animate-in fade-in-0 zoom-in-95",
        className
      )}
      {...props}
    >
      {children}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          <span className="sr-only">Close</span>
        </button>
      )}
    </div>
  )
})
DialogContent.displayName = "DialogContent"

function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-lg font-semibold leading-none tracking-tight text-foreground", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription }
