import { BALANCE } from "../config/balance";
import type { ShipState } from "../types";
import { clamp, fromAngle, length } from "./math";

export function getShipRadius(ship: ShipState) {
  return ship.blueprint.hull.length * 0.32;
}

export function updateShipMovement(ship: ShipState, dt: number, worldWidth: number, worldHeight: number) {
  const hull = ship.blueprint.hull;
  const maxForward = hull.maxSpeed * BALANCE.knotsToUnits;
  const maxReverse = maxForward * 0.25;
  const accelRate = hull.acceleration * BALANCE.accelerationScale;
  const throttleTarget = ship.desiredThrottle >= 0 ? maxForward * ship.desiredThrottle : maxReverse * ship.desiredThrottle;
  const forward = fromAngle(ship.heading, 1);
  const currentSpeed = length(ship.velocity) * Math.sign(ship.throttle || 1);
  const nextSpeed = currentSpeed + clamp(throttleTarget - currentSpeed, -accelRate * dt, accelRate * dt);
  ship.throttle = clamp(nextSpeed / maxForward, -0.25, 1);

  const heaviness = clamp(hull.tonnage / 70000, 0.45, 1.2);
  const rudderResponse = (1 / hull.rudderShift) * 10 * BALANCE.rudderScale;
  const turnLimit = (maxForward / hull.turningRadius) * BALANCE.turningScale;
  const turnRate = ship.rudder * rudderResponse * turnLimit * (0.6 + Math.abs(ship.throttle) * 0.85) / heaviness;
  ship.heading += turnRate * dt;
  ship.velocity = {
    x: forward.x * nextSpeed,
    y: forward.y * nextSpeed,
  };
  ship.position.x = clamp(ship.position.x + ship.velocity.x * dt, 100, worldWidth - 100);
  ship.position.y = clamp(ship.position.y + ship.velocity.y * dt, 100, worldHeight - 100);
}
