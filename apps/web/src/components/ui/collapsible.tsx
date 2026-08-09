import * as React from "react"
import { cn } from "@/lib/utils"

interface CollapsibleProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const Collapsible = React.forwardRef<HTMLDivElement, CollapsibleProps>(
  ({ open, onOpenChange, children, ...props }, ref) => (
    <div ref={ref} data-state={open ? "open" : "closed"} {...props}>
      {children}
    </div>
  )
)
Collapsible.displayName = "Collapsible"

const CollapsibleTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ asChild, children, ...props }, ref) => {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      ref,
      "data-state": undefined,
      ...props,
    })
  }
  return (
    <button ref={ref} type="button" {...props}>
      {children}
    </button>
  )
})
CollapsibleTrigger.displayName = "CollapsibleTrigger"

const CollapsibleContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const parent = React.useContext(CollapsibleStateContext)
  const isOpen = parent?.open ?? true

  return (
    <div
      ref={ref}
      data-state={isOpen ? "open" : "closed"}
      className={cn(
        "overflow-hidden transition-all duration-200",
        isOpen ? "block" : "hidden",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})
CollapsibleContent.displayName = "CollapsibleContent"

// Internal context for open state
interface CollapsibleStateContextValue {
  open: boolean
}

const CollapsibleStateContext = React.createContext<CollapsibleStateContextValue | null>(null)

// Override Collapsible to provide context
const CollapsibleWithProvider = React.forwardRef<HTMLDivElement, CollapsibleProps>(
  ({ open = true, onOpenChange, children, ...props }, ref) => (
    <CollapsibleStateContext.Provider value={{ open }}>
      <Collapsible ref={ref} open={open} onOpenChange={onOpenChange} {...props}>
        {children}
      </Collapsible>
    </CollapsibleStateContext.Provider>
  )
)
CollapsibleWithProvider.displayName = "Collapsible"

export { CollapsibleWithProvider as Collapsible, CollapsibleTrigger, CollapsibleContent }
