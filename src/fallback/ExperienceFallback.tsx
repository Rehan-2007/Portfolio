import { OWNER } from '../config/portfolio'

interface ExperienceFallbackProps {
  title?: string
  message?: string
  error?: Error
  onRetry?: () => void
}

export function ExperienceFallback({
  title = '3D FLIGHT MODE UNAVAILABLE',
  message = 'This device does not provide the WebGL2 graphics support required by the flight world.',
  error,
  onRetry,
}: ExperienceFallbackProps) {
  return (
    <main className="fallback-shell">
      <div className="fallback-grid" aria-hidden="true" />
      <section className="fallback-panel panel panel-notch" aria-labelledby="fallback-title">
        <p className="eyebrow">ANTI-AI // HUMAN INTELLIGENCE</p>
        <h1 id="fallback-title">{title}</h1>
        <p className="fallback-copy">{message}</p>
        {error && <p className="fallback-error">SYSTEM: {error.message}</p>}
        <div className="fallback-identity">
          <span>PILOT</span>
          <strong>{OWNER.name}</strong>
          <span>{OWNER.role}</span>
        </div>
        <div className="fallback-actions">
          {onRetry && (
            <button className="btn-mil primary" type="button" onClick={onRetry}>
              Retry 3D system
            </button>
          )}
          <a className="btn-mil" href="#controls">
            View flight controls
          </a>
        </div>
        <section id="controls" className="fallback-controls" aria-labelledby="controls-title">
          <h2 id="controls-title">Flight controls</h2>
          <p>W / ↑ accelerate · S / ↓ brake · A / D turn · Q / E altitude</p>
          <p>Space hover mode · R reset · Esc navigation</p>
        </section>
      </section>
    </main>
  )
}
