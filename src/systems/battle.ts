import { BALANCE } from "../config/balance";
import { SHIP_BLUEPRINTS, NATION_REPRESENTATIVES } from "../data/weapons";
import type {
  AmmoType,
  BattleOutcome,
  FloatingText,
  Nation,
  ShipBlueprint,
  ShipState,
  ShellState,
  TorpedoState,
  Vec2,
  WeaponMode,
} from "../types";
import type { AircraftState } from "../types";
import { updateAa } from "./aa";
import { canMainBatteryFire, createMainSalvo, getTurretLeadAngle, updateShell } from "./ballistics";
import { applyShellDamage, applyTorpedoDamage, impactAngleFromShell, updateDamageOverTime, useRepair } from "./damage";
import { getShipRadius, updateShipMovement } from "./movement";
import { clamp, distance, fromAngle, uid } from "./math";
import { getNearestShip } from "./targeting";
import { canLaunchTorpedoes, createTorpedoSpread, updateTorpedo } from "./torpedoes";

export interface BattleInput {
  throttleDelta: number;
  rudder: number;
}

export class BattleModel {
  ships: ShipState[] = [];
  aircraft: AircraftState[] = [];
  shells: ShellState[] = [];
  torpedoes: TorpedoState[] = [];
  texts: FloatingText[] = [];
  outcome: BattleOutcome = { result: "running", message: "Engage the enemy battle line." };
  time = 0;
  aircraftTimer = BALANCE.aircraftWaveSeconds;
  playerId = "";

  constructor(public selectedNation: Nation) {
    this.reset();
  }

  get player() {
    return this.ships.find((ship) => ship.id === this.playerId)!;
  }

  reset() {
    const playerBlueprint = SHIP_BLUEPRINTS[NATION_REPRESENTATIVES[this.selectedNation]];
    const enemies = this.getEnemyBlueprints(this.selectedNation);
    this.ships = [
      createShipState(playerBlueprint, "player", { x: BALANCE.worldWidth * 0.3, y: BALANCE.worldHeight * 0.52 }, 0),
      createShipState(enemies[0], "enemy", { x: BALANCE.worldWidth * 0.56, y: BALANCE.worldHeight * 0.34 }, Math.PI),
      createShipState(enemies[1], "enemy", { x: BALANCE.worldWidth * 0.61, y: BALANCE.worldHeight * 0.53 }, Math.PI * 0.95),
    ];
    this.playerId = this.ships[0].id;
    this.aircraft = [];
    this.shells = [];
    this.torpedoes = [];
    this.texts = [];
    this.outcome = { result: "running", message: "Destroy the enemy line and survive air attack." };
    this.time = 0;
    this.aircraftTimer = BALANCE.aircraftWaveSeconds;
  }

  getEnemyBlueprints(selectedNation: Nation): [ShipBlueprint, ShipBlueprint, ShipBlueprint] {
    const pool = Object.values(SHIP_BLUEPRINTS).filter((ship) => ship.hull.nation !== selectedNation);
    return [pool[0], pool[1], pool[2]];
  }

  setAmmo(ammo: AmmoType) {
    this.player.selectedAmmo = ammo;
  }

  setWeaponMode(mode: WeaponMode) {
    this.player.weaponMode = mode;
  }

  activateRepair() {
    if (useRepair(this.player)) {
      this.texts.push({
        id: uid("repair"),
        position: { ...this.player.position },
        value: "Repair Party",
        color: 0x96e28f,
        age: 0,
      });
    }
  }

  tryMainFire(target: Vec2) {
    const player = this.player;
    if (!canMainBatteryFire(player, target)) return false;
    player.mainReload = player.blueprint.mainBattery.reload;
    player.turretAngle = getTurretLeadAngle(player, target);
    this.shells.push(...createMainSalvo(player, target));
    return true;
  }

  tryLaunchTorpedoes(target: Vec2) {
    const player = this.player;
    if (!canLaunchTorpedoes(player, target)) return false;
    player.torpedoReload = player.blueprint.torpedoes?.reload ?? 0;
    this.torpedoes.push(...createTorpedoSpread(player, target));
    return true;
  }

  ctrlPriority(targetId: string, type: "ship" | "aircraft") {
    if (type === "ship") {
      this.player.secondaryPriorityId = targetId;
    } else {
      this.player.aaPriorityId = targetId;
    }
  }

  update(dt: number, input: BattleInput) {
    if (this.outcome.result !== "running") return;
    this.time += dt;
    this.aircraftTimer -= dt;
    this.updatePlayerInput(input);
    for (const ship of this.ships) {
      if (!ship.alive) continue;
      ship.mainReload = Math.max(0, ship.mainReload - dt);
      ship.secondaryReload = Math.max(0, ship.secondaryReload - dt);
      ship.torpedoReload = Math.max(0, ship.torpedoReload - dt);
      ship.repairCooldown = Math.max(0, ship.repairCooldown - dt);
      updateShipMovement(ship, dt, BALANCE.worldWidth, BALANCE.worldHeight);
      updateDamageOverTime(ship, dt, this.texts);
      this.updateSecondaries(ship);
      updateAa(ship, this.aircraft, dt, this.texts);
      if (ship.team === "enemy") {
        this.updateEnemyAi(ship, dt);
      }
    }

    for (const shell of this.shells) updateShell(shell, dt);
    for (const torpedo of this.torpedoes) updateTorpedo(torpedo, dt);

    this.resolveShellHits();
    this.resolveTorpedoHits();
    this.updateAircraft(dt);
    this.texts.forEach((text) => {
      text.age += dt;
      text.position.y -= dt * 12;
    });
    this.texts = this.texts.filter((text) => text.age < 1.1).slice(-BALANCE.maxVisibleDamageTexts);
    this.shells = this.shells.filter((shell) => shell.traveled <= shell.maxRange);
    this.torpedoes = this.torpedoes.filter((torpedo) => torpedo.traveled <= torpedo.maxRange);
    this.aircraft = this.aircraft.filter((plane) => plane.alive && plane.hp > 0);
    this.checkOutcome();
  }

  updatePlayerInput(input: BattleInput) {
    const player = this.player;
    player.desiredThrottle = clamp(player.desiredThrottle + input.throttleDelta, -0.25, 1);
    player.rudder = input.rudder;
  }

  updateEnemyAi(ship: ShipState, dt: number) {
    const player = this.player;
    const range = distance(ship.position, player.position);
    ship.desiredThrottle = range > 1100 ? 0.7 : 0.35;
    const desiredHeading = Math.atan2(player.position.y - ship.position.y, player.position.x - ship.position.x);
    const angleDelta = clamp(desiredHeading - ship.heading, -1, 1);
    ship.rudder = clamp(angleDelta * 2.5, -1, 1);
    ship.aiFireDelay -= dt;
    if (ship.aiFireDelay <= 0 && range <= ship.blueprint.mainBattery.range * BALANCE.shellRangeScale) {
      const aimError = (1 - BALANCE.enemyAccuracy) * 250;
      const target = {
        x: player.position.x + (Math.random() - 0.5) * aimError,
        y: player.position.y + (Math.random() - 0.5) * aimError,
      };
      if (canMainBatteryFire(ship, target)) {
        ship.mainReload = ship.blueprint.mainBattery.reload;
        ship.turretAngle = getTurretLeadAngle(ship, target);
        this.shells.push(...createMainSalvo(ship, target));
      }
      ship.aiFireDelay = 4 + Math.random() * 6;
    }
  }

  updateSecondaries(ship: ShipState) {
    const stats = ship.blueprint.secondaryBattery;
    if (ship.secondaryReload > 0) return;
    const inRange = this.ships.filter((target) => target.team !== ship.team && target.alive);
    const range = stats.range * BALANCE.shellRangeScale;
    const preferred = ship.secondaryPriorityId ? inRange.find((target) => target.id === ship.secondaryPriorityId) : undefined;
    const target = preferred && distance(ship.position, preferred.position) <= range ? preferred : getNearestShip(ship.position, inRange, range);
    if (!target) {
      ship.secondaryPriorityId = undefined;
      return;
    }
    const spreadFactor = ship.team === "player" ? BALANCE.secondaryAccuracy : 0.82;
    const rangeFactor = 1 - distance(ship.position, target.position) / (range * 1.6);
    const hitChance = clamp(0.82 * spreadFactor * rangeFactor, 0.35, 0.96);
    const dealt = stats.damage * stats.dpmBias * BALANCE.damageScale * BALANCE.secondaryDamageScale * 0.24 * hitChance;
    target.hp = Math.max(0, target.hp - dealt);
    this.texts.push({
      id: uid("sec"),
      position: { ...target.position },
      value: `Secondary ${Math.round(dealt)}`,
      color: 0xffcc88,
      age: 0,
    });
    if (Math.random() < stats.fireChance * hitChance && target.fires.length < target.blueprint.survivability.noOfFires) {
      target.fires.push({
        id: uid("fire"),
        type: "fire",
        remaining: target.blueprint.survivability.fireDuration,
        tickTimer: BALANCE.fireTickSeconds,
        damagePerTick: target.blueprint.survivability.maxHp * target.blueprint.survivability.fireDamage,
      });
    }
    if (target.hp <= 0) {
      target.alive = false;
    }
    ship.secondaryReload = stats.reload;
  }

  updateAircraft(dt: number) {
    if (this.aircraftTimer <= 0) {
      this.spawnAircraftWave();
      this.aircraftTimer = BALANCE.aircraftWaveSeconds;
    }
    for (const plane of this.aircraft) {
      plane.position.x += plane.velocity.x * dt;
      plane.position.y += plane.velocity.y * dt;
      if (distance(plane.position, this.player.position) < 120) {
        const maneuverPenalty = this.player.desiredThrottle < 0.15 ? 2.2 : 1;
        const strafeDamage = 420 * BALANCE.damageScale * BALANCE.aircraftStrafeScale * maneuverPenalty * dt * 2;
        this.player.hp = Math.max(0, this.player.hp - strafeDamage);
        this.texts.push({
          id: uid("air"),
          position: { ...this.player.position },
          value: `Air ${Math.round(strafeDamage)}`,
          color: 0xff6f6f,
          age: 0,
        });
      }
    }
  }

  spawnAircraftWave() {
    for (let i = 0; i < 4; i += 1) {
      const spawn = { x: BALANCE.worldWidth + 200, y: 850 + i * 70 };
      const heading = Math.atan2(this.player.position.y - spawn.y, this.player.position.x - spawn.x);
      const velocity = fromAngle(heading, 220 + i * 10);
      this.aircraft.push({
        id: uid("plane"),
        team: "enemy",
        position: spawn,
        velocity,
        hp: 1450,
        maxHp: 1450,
        heading,
        alive: true,
        squadron: "Strike Wave",
      });
    }
  }

  resolveShellHits() {
    const survivors: ShellState[] = [];
    for (const shell of this.shells) {
      const targets = this.ships.filter((ship) => ship.alive && ship.team !== shell.team);
      const hit = targets.find((ship) => distance(ship.position, shell.position) <= getShipRadius(ship));
      if (!hit) {
        survivors.push(shell);
        continue;
      }
      const owner = this.ships.find((ship) => ship.id === shell.ownerId);
      if (!owner) continue;
      const impactAngle = impactAngleFromShell(hit, shell.position);
      const outcome = applyShellDamage(owner, hit, shell.damage, shell.ammoType, impactAngle, shell.caliber, shell.shellWeight);
      this.texts.push({
        id: uid("hit"),
        position: { ...hit.position },
        value: `${outcome.result.toUpperCase()} ${Math.round(outcome.damage)}`,
        color: shell.ammoType === "AP" ? 0xffd37a : 0xff9362,
        age: 0,
      });
    }
    this.shells = survivors;
  }

  resolveTorpedoHits() {
    const survivors: TorpedoState[] = [];
    for (const torpedo of this.torpedoes) {
      const targets = this.ships.filter((ship) => ship.alive && ship.team !== torpedo.team);
      const hit = targets.find((ship) => distance(ship.position, torpedo.position) <= getShipRadius(ship) * 1.2);
      if (!hit) {
        survivors.push(torpedo);
        continue;
      }
      const dealt = applyTorpedoDamage(hit, torpedo);
      this.texts.push({
        id: uid("torp"),
        position: { ...hit.position },
        value: `TORP ${Math.round(dealt)}`,
        color: 0x6ed7ff,
        age: 0,
      });
    }
    this.torpedoes = survivors;
  }

  pickTargetAt(point: Vec2, ctrlKey: boolean) {
    if (ctrlKey) {
      const priorityPlane = this.aircraft.find((candidate) => candidate.alive && distance(candidate.position, point) <= BALANCE.targetSelectRadius * 1.8);
      if (priorityPlane) {
        this.ctrlPriority(priorityPlane.id, "aircraft");
        return { id: priorityPlane.id, type: "aircraft" as const };
      }
      const nearestPlane = this.aircraft
        .filter((candidate) => candidate.alive)
        .sort((a, b) => distance(a.position, point) - distance(b.position, point))[0];
      if (nearestPlane && distance(nearestPlane.position, point) <= BALANCE.targetSelectRadius * 4) {
        this.ctrlPriority(nearestPlane.id, "aircraft");
        return { id: nearestPlane.id, type: "aircraft" as const };
      }
    }
    const ship = this.ships.find((candidate) => candidate.alive && candidate.id !== this.playerId && distance(candidate.position, point) <= getShipRadius(candidate) + BALANCE.targetSelectRadius);
    if (ship) {
      if (ctrlKey) this.ctrlPriority(ship.id, "ship");
      return { id: ship.id, type: "ship" as const };
    }
    const plane = this.aircraft.find((candidate) => candidate.alive && distance(candidate.position, point) <= BALANCE.targetSelectRadius);
    if (plane) {
      if (ctrlKey) this.ctrlPriority(plane.id, "aircraft");
      return { id: plane.id, type: "aircraft" as const };
    }
    return undefined;
  }

  getStateSnapshot() {
    return {
      mode: "battle",
      outcome: this.outcome,
      coordinateSystem: "origin top-left; x increases right; y increases down",
      player: {
        ship: this.player.blueprint.hull.ship,
        hp: Math.round(this.player.hp),
        maxHp: this.player.blueprint.survivability.maxHp,
        pos: { x: Math.round(this.player.position.x), y: Math.round(this.player.position.y) },
        heading: Number(this.player.heading.toFixed(2)),
        throttle: Number(this.player.desiredThrottle.toFixed(2)),
        ammo: this.player.selectedAmmo,
        weaponMode: this.player.weaponMode,
        mainReload: Number(this.player.mainReload.toFixed(1)),
        torpedoReload: Number(this.player.torpedoReload.toFixed(1)),
        repairCooldown: Number(this.player.repairCooldown.toFixed(1)),
        secondaryPriorityId: this.player.secondaryPriorityId ?? null,
        aaPriorityId: this.player.aaPriorityId ?? null,
        fires: this.player.fires.length,
        floods: this.player.floods.length,
      },
      enemies: this.ships.filter((ship) => ship.id !== this.playerId && ship.alive).map((ship) => ({
        id: ship.id,
        ship: ship.blueprint.hull.ship,
        hp: Math.round(ship.hp),
        pos: { x: Math.round(ship.position.x), y: Math.round(ship.position.y) },
      })),
      aircraft: this.aircraft.filter((plane) => plane.alive).map((plane) => ({
        id: plane.id,
        hp: Math.round(plane.hp),
        pos: { x: Math.round(plane.position.x), y: Math.round(plane.position.y) },
      })),
      shells: this.shells.length,
      torpedoes: this.torpedoes.length,
    };
  }

  checkOutcome() {
    if (!this.player.alive || this.player.hp <= 0) {
      this.outcome = { result: "defeat", message: "Flagship lost. The battle line collapses." };
      return;
    }
    if (!this.ships.some((ship) => ship.team === "enemy" && ship.alive)) {
      this.outcome = { result: "victory", message: "Enemy force destroyed. Sector secured." };
    }
  }
}

function createShipState(blueprint: ShipBlueprint, team: "player" | "enemy", position: Vec2, heading: number): ShipState {
  return {
    id: uid("ship"),
    blueprint,
    team,
    position: { ...position },
    velocity: { x: 0, y: 0 },
    heading,
    throttle: 0,
    desiredThrottle: team === "player" ? 0 : 0.45,
    rudder: 0,
    hp: blueprint.survivability.maxHp,
    alive: true,
    spotted: true,
    selectedAmmo: "AP",
    weaponMode: "main",
    mainReload: 0,
    secondaryReload: 0.8,
    torpedoReload: 0,
    turretAngle: heading,
    fires: [],
    floods: [],
    repairCharges: 3,
    repairCooldown: 0,
    aiFireDelay: 4 + Math.random() * 5,
  };
}
