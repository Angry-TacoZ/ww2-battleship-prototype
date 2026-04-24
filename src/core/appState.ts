import { loadOptions, type GameOptions } from "./options";
import type { Nation } from "../types";

class AppState {
  selectedNation: Nation = "U.S.A.";
  options: GameOptions = loadOptions();
}

export const appState = new AppState();
