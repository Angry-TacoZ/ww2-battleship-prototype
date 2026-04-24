import Phaser from "phaser";
import "./style.css";
import { BattleScene } from "./scenes/BattleScene";
import { CreditsScene } from "./scenes/CreditsScene";
import { MainMenuScene } from "./scenes/MainMenuScene";
import { NationSelectScene } from "./scenes/NationSelectScene";
import { OptionsScene } from "./scenes/OptionsScene";

const container = document.getElementById("app")!;

new Phaser.Game({
  type: Phaser.CANVAS,
  parent: container,
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: "#08111a",
  scene: [MainMenuScene, NationSelectScene, OptionsScene, CreditsScene, BattleScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});
