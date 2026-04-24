import type { AircraftState, ShipState, Team, Vec2 } from "../types";
import { distance } from "./math";

export function getEnemyShips(ships: ShipState[], team: Team) {
  return ships.filter((ship) => ship.alive && ship.team !== team);
}

export function getNearestShip(origin: Vec2, ships: ShipState[], maxRange: number) {
  let best: ShipState | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const ship of ships) {
    const d = distance(origin, ship.position);
    if (d < bestDistance && d <= maxRange) {
      best = ship;
      bestDistance = d;
    }
  }
  return best;
}

export function getNearestAircraft(origin: Vec2, aircraft: AircraftState[], maxRange: number) {
  let best: AircraftState | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const plane of aircraft) {
    if (!plane.alive) continue;
    const d = distance(origin, plane.position);
    if (d < bestDistance && d <= maxRange) {
      best = plane;
      bestDistance = d;
    }
  }
  return best;
}
