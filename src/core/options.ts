import { BALANCE } from "../config/balance";
import { loadJson, saveJson } from "./storage";

export interface GameOptions {
  sfxVolume: number;
  musicVolume: number;
  muted: boolean;
  showDamageNumbers: boolean;
  zoomSpread: number;
}

const STORAGE_KEY = "iron-horizon-options";

export const defaultOptions: GameOptions = {
  sfxVolume: 0.7,
  musicVolume: 0.55,
  muted: false,
  showDamageNumbers: true,
  zoomSpread: 0.6,
};

export function loadOptions(): GameOptions {
  const loaded = loadJson<GameOptions>(STORAGE_KEY, defaultOptions);
  return { ...defaultOptions, ...loaded };
}

export function saveOptions(options: GameOptions) {
  saveJson(STORAGE_KEY, options);
}

export function getZoomLimits(zoomSpread: number) {
  return {
    min: BALANCE.zoomBaseMin,
    max: BALANCE.zoomBaseMin + zoomSpread + (BALANCE.zoomBaseMax - BALANCE.zoomBaseMin),
  };
}
