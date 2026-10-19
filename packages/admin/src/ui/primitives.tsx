import * as RDialog from '@radix-ui/react-dialog';
import * as RSelect from '@radix-ui/react-select';
import * as RSlider from '@radix-ui/react-slider';
import * as RSwitch from '@radix-ui/react-switch';
import * as RTabs from '@radix-ui/react-tabs';
import * as RTooltip from '@radix-ui/react-tooltip';
import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

/* Button ------------------------------------------------------------------------------------ */

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-900/40 border border-blue-500/50',
  secondary: 'bg-[#f8fafc] text-[#0f172a] border border-[#e2e8f0] hover:border-blue-500 hover:bg-[#f1f5f9]',
  danger: 'bg-red-600 text-white hover:bg-red-500 shadow-md shadow-red-900/40 border border-red-500/50',
  ghost: 'bg-transparent text-[#0f172a] hover:bg-[#f8fafc]',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** `lg` is the big on-air size used for show/hide actions. */
  size?: Size;
}

export const Button = ({
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: ButtonProps) => (
  <button
    type={type}
    className={clsx(
      'inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
      size === 'lg' ? 'min-h-14 px-6 text-lg' : 'min-h-10 px-4 text-sm',
      VARIANTS[variant],
      className,
    )}
    {...rest}
  />
);

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only buttons need an accessible name. */
  label: string;
  children: ReactNode;
}

export const IconButton = ({
  label,
  className,
  children,
  type = 'button',
  ...rest
}: IconButtonProps) => (
  <button
    type={type}
    aria-label={label}
    title={label}
    className={clsx(
      'inline-grid size-10 place-items-center rounded-[10px] text-text transition hover:bg-surface-2',
      className,
    )}
    {...rest}
  >
    {children}
  </button>
);

/* Card -------------------------------------------------------------------------------------- */

export const Card = ({
  title,
  actions,
  children,
  className,
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <section className={clsx('rounded-card border border-[#1e3a75] bg-[#0d1a38] p-5 shadow-lg', className)}>
    {(title || actions) && (
      <header className="mb-3 flex items-center justify-between gap-3">
        {title && <h2 className="font-heading text-lg font-bold text-white">{title}</h2>}
        {actions}
      </header>
    )}
    {children}
  </section>
);

/* Tabs -------------------------------------------------------------------------------------- */

export const Tabs = ({
  tabs,
  value,
  onValueChange,
  children,
}: {
  tabs: { value: string; label: string }[];
  value?: string;
  onValueChange?: (v: string) => void;
  children?: ReactNode;
}) => (
  <RTabs.Root value={value} defaultValue={tabs[0]?.value} onValueChange={onValueChange}>
    <RTabs.List className="mb-4 flex gap-1 border-b border-border" aria-label="Sections">
      {tabs.map((t) => (
        <RTabs.Trigger
          key={t.value}
          value={t.value}
          className="-mb-px border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted data-[state=active]:border-teal data-[state=active]:text-text"
        >
          {t.label}
        </RTabs.Trigger>
      ))}
    </RTabs.List>
    {children}
  </RTabs.Root>
);
export const TabPanel = RTabs.Content;

/* Switch ------------------------------------------------------------------------------------ */

export const Switch = ({
  checked,
  onCheckedChange,
  label,
  id,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: string;
  id: string;
}) => (
  <div className="flex items-center gap-3">
    <RSwitch.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="relative h-6 w-11 rounded-full bg-surface-2 outline-1 outline-border data-[state=checked]:bg-teal"
    >
      <RSwitch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white transition data-[state=checked]:translate-x-[22px]" />
    </RSwitch.Root>
    <label htmlFor={id} className="text-sm">
      {label}
    </label>
  </div>
);

/* Slider ------------------------------------------------------------------------------------ */

export const Slider = ({
  label,
  value,
  min,
  max,
  step = 1,
  onValueChange,
  onValueCommit,
  format = (v: number) => String(v),
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange?: (v: number) => void;
  onValueCommit?: (v: number) => void;
  format?: (v: number) => string;
}) => (
  <div className="w-full">
    <div className="mb-2 flex justify-between text-sm">
      <span>{label}</span>
      <span className="font-semibold tabular-nums">{format(value)}</span>
    </div>
    <RSlider.Root
      className="relative flex h-5 w-full touch-none items-center"
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={([v]) => v !== undefined && onValueChange?.(v)}
      onValueCommit={([v]) => v !== undefined && onValueCommit?.(v)}
      aria-label={label}
    >
      <RSlider.Track className="relative h-1.5 grow rounded-full bg-surface-2">
        <RSlider.Range className="absolute h-full rounded-full bg-teal" />
      </RSlider.Track>
      <RSlider.Thumb className="block size-5 rounded-full border-2 border-teal bg-white" />
    </RSlider.Root>
  </div>
);

/* Select ------------------------------------------------------------------------------------ */

export const Select = ({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
}) => (
  <div className="flex flex-col gap-1">
    <span className="text-sm text-muted">{label}</span>
    <RSelect.Root value={value} onValueChange={onValueChange}>
      <RSelect.Trigger
        aria-label={label}
        className="inline-flex min-h-10 min-w-40 items-center justify-between gap-2 rounded-[10px] border border-border bg-surface-2 px-3 text-sm"
      >
        <RSelect.Value />
        <RSelect.Icon aria-hidden>▾</RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={4}
          className="z-50 min-w-[var(--radix-select-trigger-width)] rounded-[10px] border border-border bg-surface p-1 shadow-lg"
        >
          <RSelect.Viewport>
            {options.map((o) => (
              <RSelect.Item
                key={o.value}
                value={o.value}
                className="cursor-pointer rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface-2"
              >
                <RSelect.ItemText>{o.label}</RSelect.ItemText>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  </div>
);

/* Dialog ------------------------------------------------------------------------------------ */

export const Dialog = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  actions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  actions?: ReactNode;
}) => {
  const f = footer ?? actions;
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm" />
        <RDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,30rem)] -translate-x-1/2 -translate-y-1/2 rounded-card border border-[#1e3a75] bg-[#0d1a38] p-6 shadow-2xl">
          <RDialog.Title className="font-heading text-xl font-bold text-white">{title}</RDialog.Title>
          <RDialog.Description className="mt-1 text-sm text-slate-300">
            {description ?? ''}
          </RDialog.Description>
          <div className="mt-4">{children}</div>
          {f && <div className="mt-6 flex justify-end gap-2">{f}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
};

/* Tooltip ----------------------------------------------------------------------------------- */

export const TooltipProvider = RTooltip.Provider;

export const Tooltip = ({ content, children }: { content: string; children: ReactNode }) => (
  <RTooltip.Root delayDuration={250}>
    <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
    <RTooltip.Portal>
      <RTooltip.Content
        sideOffset={6}
        className="z-50 rounded-md bg-surface-2 px-2 py-1 text-xs text-text shadow-lg"
      >
        {content}
      </RTooltip.Content>
    </RTooltip.Portal>
  </RTooltip.Root>
);

/* EmptyState -------------------------------------------------------------------------------- */

export const EmptyState = ({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) => (
  <div className="grid place-items-center gap-2 rounded-card border border-dashed border-border px-6 py-12 text-center">
    <h3 className="font-heading text-lg font-semibold">{title}</h3>
    {description && <p className="max-w-md text-sm text-muted">{description}</p>}
    {action}
  </div>
);

/* Banner ------------------------------------------------------------------------------------ */

export type BannerTone = 'info' | 'warn' | 'error' | 'success';

const BANNER: Record<BannerTone, string> = {
  info: 'border-blue-500',
  success: 'border-blue-400',
  warn: 'border-amber-500',
  error: 'border-red-600',
};

export const Banner = ({
  tone = 'info',
  title,
  children,
  actions,
}: {
  tone?: BannerTone;
  title?: string;
  children?: ReactNode;
  actions?: ReactNode;
}) => (
  <div
    role={tone === 'error' || tone === 'warn' ? 'alert' : 'status'}
    className={clsx(
      'flex flex-wrap items-center justify-between gap-3 rounded-card border-l-4 bg-surface px-4 py-3',
      BANNER[tone],
    )}
  >
    <div>
      {title && <p className="font-semibold">{title}</p>}
      {children && <p className="text-sm text-muted">{children}</p>}
    </div>
    {actions && <div className="flex gap-2">{actions}</div>}
  </div>
);
