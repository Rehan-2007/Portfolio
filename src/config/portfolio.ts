/**
 * ════════════════════════════════════════════════════════════════
 *  ANTI-AI // HUMAN INTELLIGENCE — CONTENT CONFIGURATION
 *  Single source of truth for every piece of portfolio content.
 *  Edit values here; the 3D world and the no-WebGL fallback both
 *  read from this file.
 * ════════════════════════════════════════════════════════════════
 */

export const OWNER = {
  name: 'Mohammed Rehan',
  callsign: 'REHAN-01',
  role: 'CSE (AI & ML) Undergraduate',
  location: 'Hyderabad, Telangana, India',
  college: 'Methodist College of Engineering and Technology',
  degree: 'B.E. Computer Science Engineering',
  specialization: 'Artificial Intelligence and Machine Learning',
  about: [
    'I am pursuing B.E. in Computer Science Engineering with specialization in Artificial Intelligence and Machine Learning.',
    'My interests include programming, artificial intelligence, machine learning, electronics, technology and hardware experimentation.',
  ],
  // NOTE: date of birth is intentionally NOT displayed anywhere.
} as const

/* ── Technical profile ──────────────────────────────────────────
   Tiers keep the profile honest: what I know, what I build with,
   and what I am actively learning. Adjust tier membership freely. */
export type SkillTier = 'core' | 'active' | 'learning'

export interface SkillGroup {
  label: string
  tier: SkillTier
  items: string[]
}

export const SKILL_TIERS: Record<SkillTier, { label: string; blurb: string }> = {
  core: { label: 'CORE', blurb: 'Comfortable writing and debugging' },
  active: { label: 'ACTIVE', blurb: 'Building projects with' },
  learning: { label: 'LEARNING', blurb: 'Currently exploring' },
}

export const TECH_PROFILE: SkillGroup[] = [
  {
    label: 'Programming',
    tier: 'core',
    items: ['C', 'Python', 'JavaScript'],
  },
  {
    label: 'Frontend',
    tier: 'active',
    items: ['HTML', 'CSS', 'React', 'Tailwind CSS'],
  },
  {
    label: 'Backend & Databases',
    tier: 'learning',
    items: ['Firebase', 'Supabase', 'Node.js'],
  },
  {
    label: 'AI & Machine Learning',
    tier: 'learning',
    items: ['NumPy', 'Pandas', 'Matplotlib', 'Scikit-learn'],
  },
  {
    label: 'Hardware & IoT',
    tier: 'active',
    items: [
      'Arduino',
      'ESP32',
      'ESP8266',
      'RFID',
      'Raspberry Pi',
      'Microcontrollers',
    ],
  },
  {
    label: 'Development Tools',
    tier: 'active',
    items: [
      'VS Code',
      'Git',
      'GitHub',
      'Android Studio',
      'Ollama',
      'Google AI Studio',
      'Vercel',
    ],
  },
]

/* ── Favourite laptop ─────────────────────────────────────────── */
export const DREAM_LAPTOP = {
  model: 'Alienware Aurora 16 AC16250',
  specs: [
    { label: 'CPU', value: 'Intel Core 7 240H' },
    { label: 'GPU', value: 'NVIDIA GeForce RTX 5050 · 8GB' },
    { label: 'RAM', value: '16GB' },
    { label: 'STORAGE', value: '1TB SSD' },
    { label: 'OS', value: 'Windows 11' },
  ],
} as const

/* ── Personal profile (favourites) ────────────────────────────── */
export const FAVOURITES = [
  { label: 'AIRCRAFT', value: 'B-2 Spirit' },
  { label: 'LAPTOP', value: 'Alienware Aurora 16' },
  { label: 'PUZZLE', value: "Rubik's Cube" },
  { label: 'FOOD', value: 'Shawarma' },
] as const

/* ── Rubik's Cube: the six personality faces ──────────────────── */
export interface CubeFace {
  id: string
  face: string
  title: string
  tagline: string
  entries: { name: string; desc: string }[]
}

export const CUBE_FACES: CubeFace[] = [
  {
    id: 'programming',
    face: 'U',
    title: 'PROGRAMMING',
    tagline: 'Languages I think in',
    entries: [
      { name: 'C', desc: 'Where I learned how memory and logic really work' },
      { name: 'Python', desc: 'My main tool for scripts, logic and ML work' },
      { name: 'JavaScript', desc: 'The language of everything I build for the web' },
      { name: 'HTML', desc: 'Structure of every page I ship' },
      { name: 'CSS', desc: 'Turning structure into interface' },
      { name: 'React', desc: 'My component model for building UIs' },
    ],
  },
  {
    id: 'ai',
    face: 'F',
    title: 'ARTIFICIAL INTELLIGENCE',
    tagline: 'The specialization I am pursuing',
    entries: [
      { name: 'Artificial Intelligence', desc: 'The field I chose as my specialization' },
      { name: 'Machine Learning', desc: 'Learning the theory and the practice' },
      { name: 'NumPy', desc: 'Numerical computing foundation' },
      { name: 'Pandas', desc: 'Data wrangling and analysis' },
      { name: 'Matplotlib', desc: 'Making data visible' },
      { name: 'Scikit-learn', desc: 'Training and evaluating models' },
    ],
  },
  {
    id: 'iot',
    face: 'R',
    title: 'ELECTRONICS & IoT',
    tagline: 'Where code meets hardware',
    entries: [
      { name: 'Arduino UNO', desc: 'My first microcontroller platform' },
      { name: 'ESP32', desc: 'Wi-Fi brain of my IoT projects' },
      { name: 'ESP8266', desc: 'Cheap, tiny, endlessly useful' },
      { name: 'RFID RC522', desc: 'Contactless ID — core of my attendance system' },
      { name: 'Raspberry Pi', desc: 'Full Linux on a credit card' },
      { name: 'Sensors & Embedded', desc: 'Reading the physical world, acting on it' },
    ],
  },
  {
    id: 'tech',
    face: 'B',
    title: 'TECHNOLOGY & GADGETS',
    tagline: 'The hardware enthusiast side',
    entries: [
      { name: 'Alienware', desc: 'Favourite machines, inside and out' },
      { name: 'GPUs', desc: 'Parallel power, gaming and AI alike' },
      { name: 'Computer Hardware', desc: 'Building, upgrading, understanding' },
      { name: 'Gaming Tech', desc: 'High refresh, low latency' },
      { name: 'Computer Architecture', desc: 'How the machine actually thinks' },
      { name: 'Emerging Tech', desc: 'Watching what comes next' },
    ],
  },
  {
    id: 'hobbies',
    face: 'L',
    title: 'HOBBIES',
    tagline: 'What I do when I am not studying',
    entries: [
      { name: 'Rubik’s Cube Solving', desc: 'Patterns, algorithms, speed' },
      { name: 'Anime', desc: 'Stories, art style and soundtracks' },
      { name: 'Coding', desc: 'Hobby projects that became skills' },
      { name: 'Tech Exploration', desc: 'New tools, new toys' },
      { name: 'Electronics Projects', desc: 'Breadboards at 2 AM' },
    ],
  },
  {
    id: 'personal',
    face: 'D',
    title: 'PERSONAL INTERESTS',
    tagline: 'The rest of the picture',
    entries: [
      { name: 'B-2 Spirit', desc: 'The aircraft that flies through this world' },
      { name: 'Aviation', desc: 'Flight, design and engineering in the air' },
      { name: 'Alienware', desc: 'Hardware I admire' },
      { name: 'Engineering', desc: 'The discipline I am building my life on' },
      { name: 'Shawarma', desc: 'Fuel for the engineer' },
      { name: 'New Technologies', desc: 'Always exploring' },
    ],
  },
]

/* ── Engineering lab exhibits ─────────────────────────────────── */
export const LAB_EXHIBITS = [
  {
    id: 'arduino',
    name: 'Arduino UNO',
    desc: 'Classic ATmega328P board — my entry into embedded systems and the brain of many early projects.',
  },
  {
    id: 'esp32',
    name: 'ESP32',
    desc: 'Dual-core microcontroller with Wi-Fi and Bluetooth. The networked brain of my IoT work.',
  },
  {
    id: 'rfid',
    name: 'RFID RC522',
    desc: '13.56 MHz contactless reader. Core component of my RFID attendance system.',
  },
  {
    id: 'lcd',
    name: '16×2 LCD Display',
    desc: 'HD44780 character display for showing status, messages and debug output.',
  },
  {
    id: 'breadboard',
    name: 'Breadboard',
    desc: 'Solderless prototyping — where every circuit starts.',
  },
  {
    id: 'sensors',
    name: 'Sensor Kit',
    desc: 'Temperature, ultrasonic, PIR and more — the senses of an embedded system.',
  },
  {
    id: 'psu',
    name: 'Bench Power Supply',
    desc: 'Regulated voltage for safe testing and experimentation.',
  },
  {
    id: 'station',
    name: 'Workstation',
    desc: 'Where code is written, compiled and flashed to the boards.',
  },
  {
    id: 'rfid-project',
    name: 'RFID ATTENDANCE SYSTEM',
    desc: 'My main lab project — RFID-based student attendance with Arduino/ESP32, Firebase Realtime Database and a web dashboard.',
  },
] as const

/* ── Projects ───────────────────────────────────────────────────
   NOTE: githubUrl / liveUrl are intentionally empty. Set them when
   ready — the UI only renders link buttons that have real targets. */
export interface Project {
  id: string
  index: string
  title: string
  tagline: string
  description: string
  tech: string[]
  githubUrl?: string
  liveUrl?: string
}

export const PROJECTS: Project[] = [
  {
    id: 'rfid-attendance',
    index: '01',
    title: 'RFID ATTENDANCE SYSTEM',
    tagline: 'Hardware + Cloud',
    description:
      'An RFID-based student attendance system with online attendance management and student records.',
    tech: ['Arduino', 'ESP32', 'RC522 RFID', 'Firebase RTDB', 'Web Dashboard'],
  },
  {
    id: 'anon-chat',
    index: '02',
    title: 'ANONYMOUS CHAT PLATFORM',
    tagline: 'Realtime Web',
    description:
      'A platform for anonymous communication and real-time messaging.',
    tech: ['React', 'Firebase / Supabase'],
  },
  {
    id: 'electromart',
    index: '03',
    title: 'ELECTROMART',
    tagline: 'E-commerce',
    description:
      'An electronics e-commerce website with product browsing, wishlist and administration features.',
    tech: [],
  },
  {
    id: 'aiml-roadmap',
    index: '04',
    title: 'AIML LEARNING ROADMAP',
    tagline: 'Education',
    description:
      'A structured learning platform for programming, artificial intelligence and machine learning.',
    tech: [],
  },
]

/* ── Contact ────────────────────────────────────────────────────
   Placeholders — replace with real handles/addresses when ready. */
export const CONTACT = {
  email: '', // e.g. 'rehan@example.com'
  github: '', // e.g. 'https://github.com/your-handle'
  linkedin: '', // e.g. 'https://www.linkedin.com/in/your-handle'
  note:
    'No mail backend is connected yet. The form validates your input and is ready to be wired to a real service — it will never pretend a message was sent.',
} as const

/* ── Shawarma easter egg ──────────────────────────────────────── */
export const SHAWARMA = {
  title: 'FUEL FOR THE ENGINEER.',
  lines: [
    'Favourite food: Shawarma.',
    'Some engineers run on coffee. This one runs on garlic sauce.',
  ],
} as const
