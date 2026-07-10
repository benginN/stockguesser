/** Minimal accessible dialog: Esc closes, backdrop click closes, focus moves in. */
import { useEffect, useRef } from "react";

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export default function Modal({ title, onClose, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="border-terminal-line bg-terminal-panel max-h-[85dvh] w-full max-w-md overflow-auto rounded-lg border p-5 shadow-2xl outline-none"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-terminal-dim hover:text-terminal-text min-h-9 min-w-9 rounded text-xl"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
