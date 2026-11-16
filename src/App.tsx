import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { SceneErrorBoundary } from './components/SceneErrorBoundary'
import { ExperienceFallback } from './fallback/ExperienceFallback'
import { hasWebGL } from './hooks/useDevice'
import { useExperienceStore } from './stores/useExperienceStore'
import { useModelAssets } from './stores/useModelAssets'
import { useScenePreparation } from './stores/useScenePreparation'
import { FlightInterface } from './ui/FlightInterface'
import './App.css'

const PhaseOneExperience = lazy(() => import('./experience/PhaseOneExperience'))

function LoadingScreen() {
  const preparation = useScenePreparation()
  const statuses = useModelAssets((state) => state.statuses)
  const loaded = Object.values(statuses).filter((status) => status.phase === 'ready').length
  const percent = Math.min(98, Math.round(preparation.terrainCompleted / preparation.terrainTotal * 70 + Math.min(loaded, 5) / 5 * 20 + (preparation.stage.includes('shaders') ? 8 : 0)))
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <div className="loading-grid" aria-hidden="true" />
      <div className="loading-copy">
        <p>ANTI-AI // COMPLETE WORLD INITIALIZATION</p>
        <h1>HUMAN<br />INTELLIGENCE</h1>
        <div className="loading-rule"><span style={{ width: `${Math.max(2, percent)}%`, animation: 'none' }} /></div>
        <span>{preparation.stage.toUpperCase()} · {percent}%</span>
        <p className="loading-details">Terrain {preparation.terrainCompleted}/{preparation.terrainTotal} · Models {Math.min(loaded, 5)}/5</p>
        {preparation.error && <div className="loading-failure" role="alert"><p>{preparation.error}</p><button className="btn-mil" type="button" onClick={() => location.reload()}>Retry complete world</button><button className="btn-mil" type="button" onClick={() => { useExperienceStore.getState().updateSettings({ quality: 'low' }); location.reload() }}>Retry in low graphics</button></div>}
      </div>
    </div>
  )
}

function App() {
  const webGL2Available = useMemo(() => hasWebGL(), [])
  const ready = useScenePreparation((state) => state.ready)
  const [contextLost, setContextLost] = useState(false)
  const [everReady, setEverReady] = useState(false)
  const onReady = useCallback(() => { setEverReady(true); setContextLost(false) }, [])
  const onContextLost = useCallback(() => { useScenePreparation.getState().contextLost(); setContextLost(true) }, [])
  const onContextRestored = useCallback(() => { setContextLost(false) }, [])
  if (!webGL2Available) return <ExperienceFallback />
  return (
    <main className={`experience-shell ${ready ? 'world-ready' : 'world-preparing'}`}>
      <SceneErrorBoundary fallback={(error, retry) => <ExperienceFallback title="3D WORLD INTERRUPTED" message="World preparation failed safely. Retry the renderer or use the accessible controls guide." error={error} onRetry={retry} />}>
        <Suspense fallback={<LoadingScreen />}><PhaseOneExperience onReady={onReady} onContextLost={onContextLost} onContextRestored={onContextRestored} /></Suspense>
      </SceneErrorBoundary>
      {!ready && !contextLost && <LoadingScreen />}
      {contextLost && <ExperienceFallback title="GRAPHICS CONTEXT LOST" message="The graphics device paused. Restore the page to prepare its resources again." onRetry={() => location.reload()} />}
      {everReady && !contextLost && <div className="persistent-interface" inert={!ready}><FlightInterface /></div>}
      <div className="crt-scanlines screen-effect" aria-hidden="true" />
      <div className="film-grain screen-effect" aria-hidden="true" />
      <div className="vignette screen-effect" aria-hidden="true" />
    </main>
  )
}
export default App
