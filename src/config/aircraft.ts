export type AircraftId = 'b2' | 'f16' | 'f22' | 'c130'
export interface FlightProfile {
  maxSpeed: number
  boostSpeed: number
  acceleration: number
  braking: number
  throttleRate: number
  turnRate: number
  climbRate: number
}
export interface AircraftDefinition {
  id: AircraftId
  name: string
  assetPath: string | null
  reference: { wingspanM: number; lengthM: number; heightM: number }
  measured: { span: number; height: number; chord: number }
  correctiveYaw: number
  sourceForward: [number, number, number]
  flight: FlightProfile
}

/** Artistic world scale, grounded in the B-2's nominal 52.4 m reference wingspan. */
export const METERS_PER_WORLD_UNIT = 52.4 / 224
export const AIRCRAFT: Record<AircraftId, AircraftDefinition> = {
  b2: {
    id: 'b2', name: 'B-2 Spirit', assetPath: '/models/aircraft/b2-spirit.glb',
    reference: { wingspanM: 52.4, lengthM: 21, heightM: 5.18 },
    measured: { span: 56, height: 3.830313444, chord: 23.053176403 },
    correctiveYaw: Math.PI, sourceForward: [0, 0, 1],
    flight: { maxSpeed: 950, boostSpeed: 1450, acceleration: 230, braking: 380, throttleRate: 0.6, turnRate: 1.18, climbRate: 125 },
  },
  // Reference-only profiles: no other aircraft assets have been supplied.
  f16: { id: 'f16', name: 'F-16', assetPath: null, reference: { wingspanM: 9.96, lengthM: 15.06, heightM: 4.88 }, measured: { span: 0, height: 0, chord: 0 }, correctiveYaw: 0, sourceForward: [0, 0, -1], flight: { maxSpeed: 1500, boostSpeed: 2050, acceleration: 400, braking: 480, throttleRate: 0.8, turnRate: 1.9, climbRate: 210 } },
  f22: { id: 'f22', name: 'F-22', assetPath: null, reference: { wingspanM: 13.56, lengthM: 18.92, heightM: 5.08 }, measured: { span: 0, height: 0, chord: 0 }, correctiveYaw: 0, sourceForward: [0, 0, -1], flight: { maxSpeed: 1650, boostSpeed: 2200, acceleration: 420, braking: 500, throttleRate: 0.8, turnRate: 1.85, climbRate: 230 } },
  c130: { id: 'c130', name: 'C-130', assetPath: null, reference: { wingspanM: 40.4, lengthM: 29.8, heightM: 11.6 }, measured: { span: 0, height: 0, chord: 0 }, correctiveYaw: 0, sourceForward: [0, 0, -1], flight: { maxSpeed: 660, boostSpeed: 820, acceleration: 135, braking: 230, throttleRate: 0.45, turnRate: 0.75, climbRate: 80 } },
}
export const ACTIVE_AIRCRAFT = AIRCRAFT.b2
export const AIRCRAFT_SCALE = ACTIVE_AIRCRAFT.reference.wingspanM / METERS_PER_WORLD_UNIT / ACTIVE_AIRCRAFT.measured.span
export const AIRCRAFT_SIZE = {
  span: ACTIVE_AIRCRAFT.measured.span * AIRCRAFT_SCALE,
  height: ACTIVE_AIRCRAFT.measured.height * AIRCRAFT_SCALE,
  chord: ACTIVE_AIRCRAFT.measured.chord * AIRCRAFT_SCALE,
}
export const AIRCRAFT_RADIUS = Math.hypot(AIRCRAFT_SIZE.span, AIRCRAFT_SIZE.height, AIRCRAFT_SIZE.chord) / 2
export const BOOST = { drain: 0.2, recharge: 0.125, lockoutSeconds: 3, restartEnergy: 0.25 } as const
export function speedKmh(worldUnitsPerSecond: number): number { return worldUnitsPerSecond * METERS_PER_WORLD_UNIT * 3.6 }
export function altitudeMeters(worldY: number): number { return worldY * METERS_PER_WORLD_UNIT }
export function uniformAircraftScale(id: AircraftId, measuredSpan: number): number {
  if (!Number.isFinite(measuredSpan) || measuredSpan <= 0) throw new Error('A positive measured model wingspan is required.')
  return AIRCRAFT[id].reference.wingspanM / METERS_PER_WORLD_UNIT / measuredSpan
}
