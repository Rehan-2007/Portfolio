import { useModelAssets } from '../stores/useModelAssets'

export function AircraftLoadNotice() {
  const status = useModelAssets((state) => state.statuses.aircraft)
  const retry = useModelAssets((state) => state.retry)
  if (status?.phase === 'ready') return null
  return (
    <aside className="aircraft-load-notice" role={status?.phase === 'error' ? 'alert' : 'status'}>
      <strong>{status?.phase === 'error' ? 'Aircraft loading failed' : 'Loading the supplied B-2'}</strong>
      <p>{status?.phase === 'error' ? status.message : 'The world remains available. Flight begins when the real aircraft is ready.'}</p>
      {status?.phase === 'error' && <button className="btn-mil" type="button" onClick={() => retry('aircraft')}>Retry aircraft</button>}
    </aside>
  )
}
