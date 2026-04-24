export type Nation = "U.S.A." | "Japan" | "Germany" | "U.K.";
export type AmmoType = "AP" | "HE";
export type WeaponMode = "main" | "torpedo";
export type EntityKind = "ship" | "aircraft" | "shell" | "torpedo" | "effect";
export type FireResult = "ricochet" | "overpen" | "partial" | "pen" | "citadel" | "shatter" | "hePen";
export type Team = "player" | "enemy";

export interface ShipHullData {
  ship: string;
  tier: number;
  class: "BB";
  nation: Nation;
  year: number;
  length: number;
  beam: number;
  tonnage: number;
  detectSea: number;
  detectAir: number;
  powerWeight: number;
  maxSpeed: number;
  acceleration: number;
  rudderShift: number;
  turningRadius: number;
}

export interface MainBatteryStats {
  name: string;
  barrels: number;
  reload: number;
  turretTraverse180: number;
  range: number;
  dispersion: number;
  sigma: number;
  shellVelocity: number;
  drag: number;
  apDamage: number;
  heDamage: number;
  heFireChance: number;
  caliber: number;
  shellWeight: number;
}

export interface SecondaryBatteryStats {
  range: number;
  reload: number;
  damage: number;
  fireChance: number;
  dpmBias: number;
}

export interface TorpedoStats {
  range: number;
  speed: number;
  reload: number;
  spread: number;
  damage: number;
  floodChance: number;
  detectability: number;
}

export interface AaBand {
  range: number;
  dps: number;
}

export interface AaStats {
  long: AaBand;
  medium: AaBand;
  short: AaBand;
  flakBursts: number;
  flakDamage: number;
}

export interface SurvivabilityStats {
  maxHp: number;
  armorBelt: number;
  deckArmor: number;
  torpedoProtection: number;
  noOfFires: number;
  fireDuration: number;
  fireDamage: number;
  fireResist: number;
  noOfFloodings: number;
  floodDuration: number;
  floodingDamage: number;
  repairPercent: number;
  citRepairPercent: number;
}

export interface ShipBlueprint {
  hull: ShipHullData;
  identity: string;
  description: string;
  mainBattery: MainBatteryStats;
  secondaryBattery: SecondaryBatteryStats;
  torpedoes?: TorpedoStats;
  aa: AaStats;
  survivability: SurvivabilityStats;
  silhouette: {
    hullColor: number;
    accentColor: number;
  };
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface DamageOverTime {
  id: string;
  type: "fire" | "flood";
  remaining: number;
  tickTimer: number;
  damagePerTick: number;
}

export interface ShipState {
  id: string;
  blueprint: ShipBlueprint;
  team: Team;
  position: Vec2;
  velocity: Vec2;
  heading: number;
  throttle: number;
  desiredThrottle: number;
  rudder: number;
  hp: number;
  alive: boolean;
  spotted: boolean;
  selectedAmmo: AmmoType;
  weaponMode: WeaponMode;
  mainReload: number;
  secondaryReload: number;
  torpedoReload: number;
  turretAngle: number;
  secondaryPriorityId?: string;
  aaPriorityId?: string;
  fires: DamageOverTime[];
  floods: DamageOverTime[];
  repairCharges: number;
  repairCooldown: number;
  targetPoint?: Vec2;
  aiFireDelay: number;
}

export interface AircraftState {
  id: string;
  team: Team;
  position: Vec2;
  velocity: Vec2;
  hp: number;
  maxHp: number;
  heading: number;
  alive: boolean;
  squadron: string;
}

export interface ShellState {
  id: string;
  team: Team;
  ownerId: string;
  ammoType: AmmoType;
  position: Vec2;
  velocity: Vec2;
  damage: number;
  maxRange: number;
  traveled: number;
  caliber: number;
  shellWeight: number;
  targetId?: string;
}

export interface TorpedoState {
  id: string;
  team: Team;
  ownerId: string;
  position: Vec2;
  velocity: Vec2;
  damage: number;
  floodChance: number;
  maxRange: number;
  traveled: number;
}

export interface FloatingText {
  id: string;
  position: Vec2;
  value: string;
  color: number;
  age: number;
}

export interface BattleOutcome {
  result: "running" | "victory" | "defeat";
  message: string;
}
