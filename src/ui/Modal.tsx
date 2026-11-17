import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useScenePreparation } from '../stores/useScenePreparation'

interface ModalProps { title: string; children: ReactNode; onClose: () => void; className?: string }

export function Modal({ title, children, onClose, className = '' }: ModalProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const ready = useScenePreparation((state) => state.ready)
  useEffect(() => {
    const element = dialog.current!
    if (ready && !element.open) element.showModal()
    else if (!ready && element.open) element.close()
  }, [ready])
  useEffect(() => {
    const element = dialog.current!
    const previous = document.activeElement as HTMLElement | null
    return () => { element.close(); previous?.focus() }
  }, [])
  return (
    <dialog ref={dialog} className={`world-dialog ${className}`} aria-label={title} onCancel={(event) => { event.preventDefault(); onClose() }} onClick={(event) => { if (event.target === dialog.current) onClose() }}>
      <div className="dialog-content">
        <header className="dialog-header"><div><span className="eyebrow">HUMAN INTELLIGENCE // PORTFOLIO</span><h2>{title}</h2></div><button type="button" className="close-button" onClick={onClose} aria-label={`Close ${title}`}>×</button></header>
        {children}
      </div>
    </dialog>
  )
}
