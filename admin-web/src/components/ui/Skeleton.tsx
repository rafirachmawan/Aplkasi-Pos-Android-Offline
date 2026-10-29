import type { CSSProperties } from 'react'
import { cn } from '@/lib/cn'

interface SkeletonProps {
  className?: string
  style?: CSSProperties
}

export function Skeleton({ className, style }: SkeletonProps) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200/80', className)} style={style} />
}
