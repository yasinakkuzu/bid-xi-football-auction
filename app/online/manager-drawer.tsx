'use client';

import { useEffect, useRef } from 'react';
import type { Manager } from '../../lib/game-engine';
import { SquadPanel } from './squad-panel';

export function ManagerDrawer({
  manager,
  onClose,
  footer,
}: {
  manager: Manager;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      oldOverflow = document.body.style.overflow;
    closeRef.current?.focus();
    document.body.style.overflow = 'hidden';
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      ];
      if (!focusable.length) return;
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, []);
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="online-manager-title"
        className="squad-drawer online-manager-drawer"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drawer-head">
          <div>
            <p className="eyebrow">MENAJER DETAYI</p>
            <h2 id="online-manager-title">{manager.name}</h2>
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Kadroyu kapat">
            ×
          </button>
        </div>
        <SquadPanel manager={manager} compact />
        {footer}
      </aside>
    </div>
  );
}
