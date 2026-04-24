import { BALANCE } from "../config/balance";
import type { AircraftState, FloatingText, ShipState } from "../types";
import { distance, uid } from "./math";
import { getNearestAircraft } from "./targeting";

export function getAaRange(ship: ShipState) {
  return ship.blueprint.aa.long.range * BALANCE.shellRangeScale;
}

export function updateAa(ship: ShipState, aircraft: AircraftState[], dt: number, texts: FloatingText[]) {
  if (!ship.alive) return;
  const aa = ship.blueprint.aa;
  const longRange = aa.long.range * BALANCE.shellRangeScale;
  const preferred = ship.aaPriorityId ? aircraft.find((plane) => plane.id === ship.aaPriorityId && plane.alive) : undefined;
  const target = preferred && distance(ship.position, preferred.position) <= longRange ? preferred : getNearestAircraft(ship.position, aircraft, longRange);
  if (!target) {
    ship.aaPriorityId = undefined;
    return;
  }

  const d = distance(ship.position, target.position);
  let dps = 0;
  if (d <= aa.long.range * BALANCE.shellRangeScale) dps += aa.long.dps;
  if (d <= aa.medium.range * BALANCE.shellRangeScale) dps += aa.medium.dps;
  if (d <= aa.short.range * BALANCE.shellRangeScale) dps += aa.short.dps;
  const damage = dps * BALANCE.damageScale * dt;
  target.hp -= damage;
  if (Math.random() < dt * 0.12 * aa.flakBursts) {
    target.hp -= aa.flakDamage * BALANCE.damageScale * 0.2;
    texts.push({
      id: uid("flak"),
      position: { ...target.position },
      value: `Flak ${Math.round(aa.flakDamage * BALANCE.damageScale * 0.2)}`,
      color: 0xe6d68c,
      age: 0,
    });
  }
  texts.push({
    id: uid("aa"),
    position: { ...target.position },
    value: `AA ${Math.round(damage)}`,
    color: 0xb8efff,
    age: 0,
  });
  if (target.hp <= 0) {
    target.alive = false;
    ship.aaPriorityId = undefined;
  }
}
