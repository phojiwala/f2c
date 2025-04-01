"use client"

import {
  Toast as ShadToast,
  ToastClose as ShadToastClose,
  ToastDescription as ShadToastDescription,
  ToastProvider as ShadToastProvider,
  ToastTitle as ShadToastTitle,
  ToastViewport as ShadToastViewport,
} from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ShadToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <ShadToast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ShadToastTitle>{title}</ShadToastTitle>}
              {description && (
                <ShadToastDescription>{description}</ShadToastDescription>
              )}
            </div>
            {action}
            <ShadToastClose />
          </ShadToast>
        )
      })}
      <ShadToastViewport />
    </ShadToastProvider>
  )
}