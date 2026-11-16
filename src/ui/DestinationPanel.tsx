import { useState } from 'react'
import { Code2, Cpu, GraduationCap, Heart, Laptop, Layers, Mail } from 'lucide-react'
import { CONTACT, CUBE_FACES, DREAM_LAPTOP, FAVOURITES, LAB_EXHIBITS, OWNER, PROJECTS, TECH_PROFILE } from '../config/portfolio'
import { MODEL_CONFIG } from '../config/models'
import type { ModelId } from '../config/models'
import { getStation } from '../config/stations'
import type { StationId } from '../config/stations'
import { useExperienceStore } from '../stores/useExperienceStore'
import { useModelAssets } from '../stores/useModelAssets'
import { Modal } from './Modal'
import { ContactForm } from './ContactForm'
import { useCubeControls } from '../stores/useCubeControls'

function configuredUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:' ? value : undefined } catch { return undefined }
}

function AssetStatus({ id }: { id: ModelId }) {
  const state = useModelAssets((store) => store.statuses[id])
  const retry = useModelAssets((store) => store.retry)
  const config = MODEL_CONFIG[id]
  return (
    <div className="asset-status">
      {!config.assetPath ? <p>3D model slot ready — awaiting your uploaded {config.label} asset. No substitute model is displayed.</p> : <p>3D model: {state?.phase ?? 'waiting'}{state?.message ? ` — ${state.message}` : ''}</p>}
      {state?.phase === 'error' && <button type="button" className="btn-mil" onClick={() => retry(id)}>Retry model</button>}
      {state?.inspection && <details><summary>Model inspection</summary><p>Dimensions: {state.inspection.dimensions.map((v) => v.toFixed(2)).join(' × ')} · {state.inspection.meshes} meshes · {state.inspection.triangles.toLocaleString()} triangles</p><p>Animation clips: {state.inspection.animations.join(', ') || 'none'}</p>{state.inspection.warnings.map((warning) => <p key={warning}>{warning}</p>)}</details>}
    </div>
  )
}

export function ProjectList() {
  return (
    <div className="info-grid">
      {PROJECTS.map((project) => (
        <article key={project.id} className="info-card">
          <span className="eyebrow">PROJECT {project.index} // {project.tagline}</span><h3>{project.title}</h3>
          <p>{project.description}</p>
          <div className="tech-tags">{project.tech.map((item) => <span key={item}>{item}</span>)}</div>
          <details><summary>Project details</summary><p>{project.description}</p>{project.id === 'anon-chat' && <p>Backend choice is not confirmed in the supplied project details.</p>}{['electromart', 'aiml-roadmap'].includes(project.id) && <p>Implementation stack and preview are awaiting confirmed project files.</p>}</details>
          <div className="info-links">{configuredUrl(project.githubUrl) && <a href={project.githubUrl} target="_blank" rel="noreferrer">GitHub ↗</a>}{configuredUrl(project.liveUrl) && <a href={project.liveUrl} target="_blank" rel="noreferrer">Live demo ↗</a>}{!project.githubUrl && !project.liveUrl && <small>Project URLs not configured.</small>}</div>
        </article>
      ))}
    </div>
  )
}

function ContactContent() {
  return <section className="info-card"><Mail size={24} /><h3>Open a channel</h3><p>Contact details are configurable. No email backend is connected, so this site does not claim to send messages.</p><div className="info-links">{CONTACT.email ? <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> : <span>Email — not configured</span>}{configuredUrl(CONTACT.github) ? <a href={CONTACT.github} target="_blank" rel="noreferrer">GitHub ↗</a> : <span>GitHub — not configured</span>}{configuredUrl(CONTACT.linkedin) ? <a href={CONTACT.linkedin} target="_blank" rel="noreferrer">LinkedIn ↗</a> : <span>LinkedIn — not configured</span>}</div><ContactForm /></section>
}

function LaptopContent() {
  const [section, setSection] = useState('About me')
  const sections = ['About me', 'Education', 'Technical skills', 'My setup', 'Projects', 'Contact']
  return <><nav className="info-tabs" aria-label="Profile sections">{sections.map((item) => <button type="button" key={item} aria-pressed={section === item} onClick={() => setSection(item)}>{item}</button>)}</nav>
    <div className="asset-status"><p>The 3D landmark is the supplied Predator laptop asset—not an exact Aurora 16 CAD model. My setup specifications below remain Alienware Aurora 16 AC16250.</p></div>{section === 'About me' && <section className="info-card"><Laptop size={28} /><h3>{OWNER.name}</h3><p className="profile-role">{OWNER.degree}</p>{OWNER.about.map((p) => <p key={p}>{p}</p>)}<p>{OWNER.location}</p><div className="tech-tags">{FAVOURITES.map((item) => <span key={item.label}>{item.label}: {item.value}</span>)}</div><p className="small-note">ANTI-AI is an artistic rejection of generic design, not a rejection of AI and machine learning.</p></section>}
    {section === 'Education' && <section className="info-card"><GraduationCap size={28} /><h3>{OWNER.degree}</h3><p>Specialization: {OWNER.specialization}</p><p>{OWNER.college}</p><p>{OWNER.location}</p></section>}
    {section === 'Technical skills' && <><p className="small-note">Current foundations, project experience, and learning areas — not claims of advanced professional mastery.</p><div className="info-grid">{TECH_PROFILE.map((group) => <article key={group.label} className="info-card"><Code2 size={22} /><h3>{group.label}</h3><span className="eyebrow">{group.tier === 'core' ? 'FOUNDATIONS' : group.tier === 'active' ? 'PROJECT EXPERIENCE' : 'LEARNING'}</span><div className="tech-tags">{group.items.map((item) => <span key={item}>{item}</span>)}</div></article>)}</div></>}
    {section === 'My setup' && <section className="info-card"><Cpu size={28} /><h3>{DREAM_LAPTOP.model}</h3><p>Favourite laptop specifications supplied by Mohammed Rehan.</p><dl className="spec-list">{DREAM_LAPTOP.specs.map((spec) => <div key={spec.label}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}</dl></section>}
    {section === 'Projects' && <ProjectList />}{section === 'Contact' && <ContactContent />}
  </>
}

function CubeContent() {
  const faceId = useModelAssets((state) => state.selectedFace)
  const select = useCubeControls((state) => state.selectFace)
  const rotate = useCubeControls((state) => state.rotate)
  const scramble = useCubeControls((state) => state.scramble)
  const solve = useCubeControls((state) => state.solve)
  const turns = useCubeControls((state) => state.history.length)
  const solving = useCubeControls((state) => state.solving)
  const error = useCubeControls((state) => state.error)
  const modelReady = useModelAssets((state) => state.statuses.cube?.phase === 'ready')
  const face = CUBE_FACES.find((item) => item.id === faceId)
  return <><p className="small-note">Original supplied cubelets. Solve reverses the moves made here; it is not an arbitrary-state solver.</p>
    <div className="cube-actions"><button type="button" className="btn-mil" disabled={!modelReady || solving || !!error} onClick={scramble}>Scramble</button><button type="button" className="btn-mil" disabled={!modelReady || !turns || solving || !!error} onClick={solve}>{solving ? 'Solving…' : 'Solve history'}</button><span>{turns} recorded turns</span>{error && <p role="alert">{error}</p>}</div>
    {face ? <section className="info-card"><button type="button" className="btn-mil" onClick={() => select(null)}>← Back to six faces</button><h3>{face.title}</h3><div className="cube-actions"><button type="button" className="btn-mil" disabled={!modelReady || solving || !!error} onClick={() => rotate(face.id, 1)}>Rotate face ↻</button><button type="button" className="btn-mil" disabled={!modelReady || solving || !!error} onClick={() => rotate(face.id, -1)}>Rotate face ↺</button></div><p>{face.tagline}</p><div className="info-grid">{face.entries.map((entry) => <div key={entry.name}><strong>{entry.name}</strong><p>{entry.desc}</p></div>)}</div></section> : <div className="info-grid">{CUBE_FACES.map((item, index) => <button className="face-card" key={item.id} type="button" onClick={() => select(item.id)}><span className={`face-chip face-chip-${index}`} /><Layers size={22} /><strong>{item.title}</strong><span>{item.tagline}</span></button>)}</div>}
  </>
}

function LabContent() {
  return <><section className="info-card"><Cpu size={28} /><h3>RFID ATTENDANCE SYSTEM</h3><p>{PROJECTS[0].description}</p><div className="tech-tags">{PROJECTS[0].tech.map((item) => <span key={item}>{item}</span>)}</div></section><div className="info-grid">{LAB_EXHIBITS.filter((item) => item.id !== 'rfid-project').map((item) => <details key={item.id} className="info-card"><summary>{item.name}</summary><p>{item.desc}</p></details>)}</div></>
}

export function DestinationContent({ id }: { id: StationId }) {
  switch (id) {
    case 'about': return <LaptopContent />
    case 'cube': return <CubeContent />
    case 'lab': return <LabContent />
    case 'archive': return <ProjectList />
    case 'contact': return <ContactContent />
    case 'shawarma': return <section className="info-card"><Heart size={28} /><h3>FUEL FOR THE ENGINEER.</h3><p>Favourite food: Shawarma.</p><p>Some engineers run on coffee. This one runs on garlic sauce.</p></section>
  }
}

export function DestinationPanel() {
  const active = useExperienceStore((state) => state.activeStation)
  const close = useExperienceStore((state) => state.closeStation)
  if (!active) return null
  return <Modal key={active} title={getStation(active).name} onClose={close} className="destination-dialog"><AssetStatus id={active} /><DestinationContent id={active} /><footer className="dialog-footer"><button className="btn-mil" type="button" onClick={close}>Back to exploration</button></footer></Modal>
}
