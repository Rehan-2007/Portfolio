/**
 * World layout — the six destinations arranged around the runway.
 * The B-2 spawns above the runway centre and flies between these.
 */

export type StationId = 'about' | 'cube' | 'lab' | 'archive' | 'contact' | 'shawarma'

export interface StationDef {
  id: StationId
  index: string
  name: string
  sub: string
  /** World position [x, y, z] — y is ground level */
  pos: [number, number, number]
  /** Radius within which the "enter station" prompt appears */
  enterRadius: number
  /** Hint shown on the radar / nav menu */
  hint: string
}

export const STATIONS: StationDef[] = [
  {
    id: 'about',
    index: '01',
    name: 'ABOUT ME',
    sub: 'Alienware Terminal',
    pos: [-1200, 0, -900],
    enterRadius: 340,
    hint: 'Identity · Education · Profile',
  },
  {
    id: 'cube',
    index: '02',
    name: 'SKILLS & MIND',
    sub: 'Rubik Vault',
    pos: [560, 0, -340],
    enterRadius: 150,
    hint: 'Six faces of personality',
  },
  {
    id: 'lab',
    index: '03',
    name: 'ENGINEERING LAB',
    sub: 'Electronics & IoT',
    pos: [-560, 0, 420],
    enterRadius: 150,
    hint: 'Boards, sensors, circuits',
  },
  {
    id: 'archive',
    index: '04',
    name: 'PROJECT ARCHIVE',
    sub: 'Classified Files',
    pos: [540, 0, 460],
    enterRadius: 150,
    hint: 'Four project dossiers',
  },
  {
    id: 'contact',
    index: '05',
    name: 'COMMS TERMINAL',
    sub: 'Contact',
    pos: [0, 0, -800],
    enterRadius: 150,
    hint: 'Open a channel',
  },
  {
    id: 'shawarma',
    index: '06',
    name: 'UNIDENTIFIED OBJECT',
    sub: '???',
    pos: [155, 0, 135],
    enterRadius: 70,
    hint: 'Investigate closely',
  },
]

/** B-2 spawn state: above the runway, heading north (-Z) */
export const SPAWN = {
  x: 0,
  y: 130,
  z: 235,
  heading: 0, // 0 = facing -Z
  speed: 160,
} as const

/** Soft flight boundary (half-extent of the playable world) */
export const WORLD_BOUND = 5200
export const MIN_ALTITUDE = 7
export const MAX_ALTITUDE = 1450

export function getStation(id: StationId): StationDef {
  const s = STATIONS.find((st) => st.id === id)
  if (!s) throw new Error(`Unknown station: ${id}`)
  return s
}
