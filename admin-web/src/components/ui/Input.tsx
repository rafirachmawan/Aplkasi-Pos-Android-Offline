import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  icon?: ReactNode
  containerClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, icon, className, containerClassName, id, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div className={cn('flex flex-col gap-1.5', containerClassName)}>
      {label ? (
        <label htmlFor={inputId} className="text-[13px] font-medium text-slate-700">
          {label}
        </label>
      ) : null}

      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </span>
        ) : null}

        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          className={cn(
            'focus-ring h-10 w-full rounded-lg border bg-white px-3 text-sm text-ink placeholder:text-slate-400',
            'transition-colors disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
            icon && 'pl-9',
            error ? 'border-red-400 focus-visible:ring-red-500/30' : 'border-line hover:border-slate-300',
            className,
          )}
          {...props}
        />
      </div>

      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  )
})
