/**
 * GulfHive ERP - Button Component
 * Spatial math: horizontal padding approx 2x vertical. Single-line truncation escape hatch.
 */

import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = '',
      variant = 'secondary',
      size = 'md',
      isLoading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      type = 'button',
      ...props
    },
    ref
  ) => {
    // Variants
    const variantStyles: Record<ButtonVariant, string> = {
      primary: 'bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 border border-slate-900 shadow-2xs',
      secondary: 'bg-white text-slate-800 hover:bg-slate-50 active:bg-slate-100 border border-slate-300 shadow-2xs',
      outline: 'bg-transparent text-slate-700 hover:bg-slate-100 active:bg-slate-200 border border-slate-300',
      ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent',
      danger: 'bg-rose-50 text-rose-700 hover:bg-rose-100 active:bg-rose-200 border border-rose-200',
      success: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-200',
    };

    // Sizes
    const sizeStyles: Record<ButtonSize, string> = {
      sm: 'py-1 px-2.5 text-xs',
      md: 'py-1.5 px-3.5 text-xs font-medium',
      lg: 'py-2 px-4 text-sm font-medium',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`inline-flex items-center justify-center space-x-1.5 rtl:space-x-reverse rounded transition-colors duration-150 select-none whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {!isLoading && leftIcon && <span className="shrink-0">{leftIcon}</span>}
        <span className="truncate">{children}</span>
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
