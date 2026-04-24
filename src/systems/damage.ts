import { BALANCE } from "../config/balance";
import type { DamageOverTime, FireResult, FloatingText, ShipState, TorpedoState } from "../types";
import { angleTo, clamp, uid, wrapAngle } from "./math";

function createDot(type: "fire" | "flood", ship: ShipState): DamageOverTime {
  const survivability = ship.blueprint.survivability;
  const duration = type === "fire" ? survivability.fireDuration : survivability.floodDuration;
  const perTickRatio = type === "fire" ? survivability.fireDamage : survivability.floodingDamage;
  return {
    id: uid(type),
    type,
    remaining: duration,
    tickTimer: type === "fire" ? BALANCE.fireTickSeconds : BALANCE.floodTickSeconds,
    damagePerTick: ship.blueprint.survivability.maxHp * perTickRatio,
  };
}

export function applyShellDamage(attacker: ShipState, target: ShipState, damage: number, ammoType: "AP" | "HE", impactAngle: number, caliber: number, shellWeight: number) {
  const survivability = target.blueprint.survivability;
  const armorFacing = Math.abs(wrapAngle(impactAngle - target.heading));
  const broadsideFactor = Math.abs(Math.sin(armorFacing));
  let result: FireResult;
  let dealt = 0;

  if (ammoType === "AP") {
    const penetrationPower = caliber * 0.65 + shellWeight * 0.05;
    const armorCheck = survivability.armorBelt * (1 - broadsideFactor * 0.2);
    if (broadsideFactor < 0.22) {
      result = "ricochet";
    } else if (penetrationPower > armorCheck * 1.4 && broadsideFactor > 0.88) {
      result = "citadel";
      dealt = damage * 0.85;
    } else if (penetrationPower > armorCheck) {
      result = "pen";
      dealt = damage * 0.55;
    } else if (penetrationPower > armorCheck * 0.7) {
      result = "partial";
      dealt = damage * 0.33;
    } else {
      result = "overpen";
      dealt = damage * 0.12;
    }
  } else if (caliber / 6 < survivability.deckArmor) {
    result = "shatter";
    dealt = damage * 0.06;
  } else {
    result = "hePen";
    dealt = damage * 0.34;
    if (target.fires.length < survivability.noOfFires) {
      const fireChance = clamp(attacker.blueprint.mainBattery.heFireChance - survivability.fireResist, 0.04, 0.65);
      if (Math.random() < fireChance) {
        target.fires.push(createDot("fire", target));
      }
    }
  }

  const teamScalar = attacker.team === "player" ? BALANCE.playerDamageScale : BALANCE.enemyDamageScale;
  target.hp = Math.max(0, target.hp - dealt * BALANCE.damageScale * teamScalar);
  if (target.hp <= 0) {
    target.alive = false;
  }
  return { result, damage: dealt * BALANCE.damageScale * teamScalar };
}

export function applyTorpedoDamage(target: ShipState, torpedo: TorpedoState) {
  const reduced = torpedo.damage * (1 - target.blueprint.survivability.torpedoProtection);
  target.hp = Math.max(0, target.hp - reduced * BALANCE.damageScale);
  if (target.hp <= 0) {
    target.alive = false;
  }
  if (target.floods.length < target.blueprint.survivability.noOfFloodings && Math.random() < torpedo.floodChance) {
    target.floods.push(createDot("flood", target));
  }
  return reduced * BALANCE.damageScale;
}

export function updateDamageOverTime(ship: ShipState, dt: number, texts: FloatingText[]) {
  const allDots = [...ship.fires, ...ship.floods];
  for (const dot of allDots) {
    dot.remaining -= dt;
    dot.tickTimer -= dt;
    if (dot.tickTimer <= 0) {
      dot.tickTimer = dot.type === "fire" ? BALANCE.fireTickSeconds : BALANCE.floodTickSeconds;
      const dealt = dot.damagePerTick;
      ship.hp = Math.max(0, ship.hp - dealt);
      texts.push({
        id: uid("dot"),
        position: { ...ship.position },
        value: dot.type === "fire" ? `Fire ${Math.round(dealt)}` : `Flood ${Math.round(dealt)}`,
        color: dot.type === "fire" ? 0xff9944 : 0x69d2ff,
        age: 0,
      });
      if (ship.hp <= 0) {
        ship.alive = false;
      }
    }
  }
  ship.fires = ship.fires.filter((dot) => dot.remaining > 0);
  ship.floods = ship.floods.filter((dot) => dot.remaining > 0);
}

export function useRepair(ship: ShipState) {
  if (ship.repairCharges <= 0 || ship.repairCooldown > 0) return false;
  ship.repairCharges -= 1;
  ship.repairCooldown = BALANCE.repairCooldown;
  const restore = ship.blueprint.survivability.maxHp * ship.blueprint.survivability.repairPercent;
  ship.hp = Math.min(ship.blueprint.survivability.maxHp, ship.hp + restore);
  ship.fires = ship.fires.slice(0, Math.max(0, ship.fires.length - 1));
  ship.floods = ship.floods.slice(0, Math.max(0, ship.floods.length - 1));
  return true;
}

export function impactAngleFromShell(target: ShipState, from: { x: number; y: number }) {
  return angleTo(from, target.position);
}
