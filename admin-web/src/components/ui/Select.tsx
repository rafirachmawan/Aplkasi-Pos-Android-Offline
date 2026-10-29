import { ChevronDown } from 'lucide-react'
import { forwardRef, useId, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string
  options: SelectOption[]
  error?: string
  containerClassName?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, error, className, containerClassName, id, ...props },
  ref,
) {
  const generatedId = useId()
  const selectId = id ?? generatedId

  return (
    <div className={cn('flex flex-col gap-1.5', containerClassName)}>
      {label ? (
        <label htmlFor={selectId} className="text-[13px] font-medium text-slate-700">
          {label}
        </label>
      ) : null}

      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'focus-ring h-10 w-full appearance-none rounded-lg border border-line bg-white pl-3 pr-9 text-sm text-ink',
            'transition-colors hover:border-slate-300 disabled:cursor-not-allowed disabled:bg-slate-50',
            error && 'border-red-400',
            className,
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
})
