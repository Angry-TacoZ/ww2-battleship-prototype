import { BALANCE } from "../config/balance";
import type { ShipState, TorpedoState, Vec2 } from "../types";
import { angleTo, distance, fromAngle, randomSpread, uid } from "./math";

export function createTorpedoSpread(ship: ShipState, target: Vec2): TorpedoState[] {
  const stats = ship.blueprint.torpedoes;
  if (!stats) return [];
  const baseAngle = angleTo(ship.position, target);
  const speed = stats.speed * BALANCE.knotsToUnits * 1.2;
  return [-3, -2, -1, 0, 1, 2, 3].map((offset) => ({
    id: uid("torpedo"),
    team: ship.team,
    ownerId: ship.id,
    position: { ...ship.position },
    velocity: fromAngle(randomSpread(baseAngle + offset * stats.spread * 0.55, stats.spread * 0.22), speed),
    damage: stats.damage,
    floodChance: stats.floodChance,
    maxRange: stats.range * BALANCE.shellRangeScale,
    traveled: 0,
  }));
}

export function updateTorpedo(torpedo: TorpedoState, dt: number) {
  torpedo.position.x += torpedo.velocity.x * dt;
  torpedo.position.y += torpedo.velocity.y * dt;
  torpedo.traveled += Math.hypot(torpedo.velocity.x, torpedo.velocity.y) * dt;
}

export function canLaunchTorpedoes(ship: ShipState, target: Vec2) {
  const stats = ship.blueprint.torpedoes;
  return Boolean(stats && ship.torpedoReload <= 0 && distance(ship.position, target) <= stats.range * BALANCE.shellRangeScale);
}
