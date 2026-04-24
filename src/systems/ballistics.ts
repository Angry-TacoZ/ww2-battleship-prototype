import { BALANCE } from "../config/balance";
import type { AmmoType, MainBatteryStats, ShellState, ShipState, Vec2 } from "../types";
import { angleTo, distance, fromAngle, randomSpread, uid } from "./math";

export function computeWeaponRange(stats: MainBatteryStats) {
  return stats.range * BALANCE.shellRangeScale;
}

export function computeRangeMeters(distanceUnits: number) {
  return distanceUnits / BALANCE.shellRangeScale;
}

export function computeShellFlightTime(stats: MainBatteryStats, distanceUnits: number) {
  const distanceMeters = computeRangeMeters(distanceUnits) * 1000;
  const averageVelocity = stats.shellVelocity * (1 - stats.drag * 0.25);
  return Math.max(0.6, distanceMeters / averageVelocity);
}

export function createMainSalvo(ship: ShipState, target: Vec2): ShellState[] {
  const stats = ship.blueprint.mainBattery;
  const baseAngle = angleTo(ship.position, target);
  const range = Math.min(distance(ship.position, target), computeWeaponRange(stats));
  const sigmaTightening = Math.max(0.45, 1.4 - stats.sigma * 0.25);
  const spreadRadians = (stats.dispersion / 1000) * sigmaTightening * (range / computeWeaponRange(stats));
  const velocityMagnitude = stats.shellVelocity * BALANCE.shellSpeedScale;
  const shells: ShellState[] = [];
  for (let i = 0; i < stats.barrels; i += 1) {
    const angle = randomSpread(baseAngle, spreadRadians);
    shells.push({
      id: uid("shell"),
      team: ship.team,
      ownerId: ship.id,
      ammoType: ship.selectedAmmo,
      position: { ...ship.position },
      velocity: fromAngle(angle, velocityMagnitude),
      damage: ship.selectedAmmo === "AP" ? stats.apDamage : stats.heDamage,
      maxRange: computeWeaponRange(stats),
      traveled: 0,
      caliber: stats.caliber,
      shellWeight: stats.shellWeight,
    });
  }
  return shells;
}

export function updateShell(shell: ShellState, dt: number) {
  const drag = shell.ammoType === "AP" ? 0.994 : 0.991;
  shell.position.x += shell.velocity.x * dt;
  shell.position.y += shell.velocity.y * dt;
  shell.velocity.x *= drag;
  shell.velocity.y *= drag;
  shell.traveled += Math.hypot(shell.velocity.x, shell.velocity.y) * dt;
}

export function getTurretLeadAngle(ship: ShipState, target: Vec2) {
  return angleTo(ship.position, target);
}

export function canMainBatteryFire(ship: ShipState, target: Vec2) {
  return ship.mainReload <= 0 && distance(ship.position, target) <= computeWeaponRange(ship.blueprint.mainBattery);
}

export function swapAmmo(ship: ShipState, ammoType: AmmoType) {
  ship.selectedAmmo = ammoType;
}
