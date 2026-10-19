import * as RToast from '@radix-ui/react-toast';
import clsx from 'clsx';
import { useAdmin } from '../store';

const TONE = {
  info: 'border-teal',
  success: 'border-ok',
  error: 'border-error',
} as const;

/** Renders the toast queue held in the admin store. Call `useAdmin.getState().toast(...)`. */
export const Toaster = () => {
  const toasts = useAdmin((s) => s.toasts);
  const dismiss = useAdmin((s) => s.dismissToast);
  return (
    <RToast.Provider swipeDirection="right" duration={5000}>
      {toasts.map((t) => (
        <RToast.Root
          key={t.id}
          onOpenChange={(open) => !open && dismiss(t.id)}
          className={clsx('rounded-card border-l-4 bg-surface px-4 py-3 shadow-lg', TONE[t.kind])}
        >
          <RToast.Title className="text-sm font-semibold">{t.title}</RToast.Title>
          {t.description && (
            <RToast.Description className="text-sm text-muted">{t.description}</RToast.Description>
          )}
        </RToast.Root>
      ))}
      <RToast.Viewport className="fixed bottom-4 right-4 z-[60] flex w-96 max-w-[92vw] flex-col gap-2 outline-none" />
    </RToast.Provider>
  );
};
