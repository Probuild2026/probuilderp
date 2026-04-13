import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border border-transparent px-3 py-1.5 text-xs font-medium tracking-[-0.01em] w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden shadow-[0_10px_18px_-16px_rgba(91,124,191,0.18)]",
  {
    variants: {
      variant: {
        default: "bg-primary/8 text-primary ring-1 ring-primary/12 [a&]:hover:bg-primary/12",
        secondary: "bg-white/88 text-secondary-foreground ring-1 ring-border/50 [a&]:hover:bg-secondary/90",
        destructive:
          "bg-destructive/12 text-destructive ring-1 ring-destructive/20 [a&]:hover:bg-destructive/18 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline: "border-border/70 bg-white/88 text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
