import Phaser from "phaser";
import { appState } from "../core/appState";
import { NATION_REPRESENTATIVES, SHIP_BLUEPRINTS } from "../data/weapons";
import type { Nation } from "../types";

const NATION_BLURBS: Record<Nation, string> = {
  "U.S.A.": "Fast heavy guns, strong AA, flexible positioning.",
  Japan: "Long-range AP punch and disciplined firing lanes.",
  Germany: "Brawling secondaries and close-range aggression.",
  "U.K.": "Fire pressure, concealment, and self-repair value.",
};

export class NationSelectScene extends Phaser.Scene {
  constructor() {
    super("nation-select");
  }

  create() {
    const { width, height } = this.scale;
    this.add.rectangle(width * 0.5, height * 0.5, width, height, 0x0d1b26);
    this.add.text(width * 0.5, 70, "Choose Your Flagship", {
      fontFamily: "Georgia",
      fontSize: "40px",
      color: "#eff7ff",
    }).setOrigin(0.5);

    const nations = Object.keys(NATION_REPRESENTATIVES) as Nation[];
    nations.forEach((nation, index) => {
      const x = 170 + index * 220;
      const y = 310;
      const blueprint = SHIP_BLUEPRINTS[NATION_REPRESENTATIVES[nation]];
      const card = this.add.rectangle(x, y, 190, 330, 0x183346, 0.95).setStrokeStyle(2, blueprint.silhouette.accentColor);
      const art = this.add.graphics();
      art.fillStyle(blueprint.silhouette.hullColor, 1);
      art.fillRoundedRect(x - 52, y - 76, 104, 26, 8);
      art.fillStyle(blueprint.silhouette.accentColor, 1);
      art.fillRect(x - 8, y - 88, 16, 42);
      art.fillTriangle(x - 52, y - 50, x - 72, y - 30, x - 18, y - 34);
      art.fillTriangle(x + 52, y - 50, x + 72, y - 30, x + 18, y - 34);
      this.add.text(x, y - 130, nation, {
        fontFamily: "Georgia",
        fontSize: "28px",
        color: "#f3f8ff",
      }).setOrigin(0.5);
      this.add.text(x, y - 4, NATION_BLURBS[nation], {
        fontFamily: "Georgia",
        fontSize: "16px",
        color: "#d9e6f2",
        align: "center",
        wordWrap: { width: 160 },
      }).setOrigin(0.5);
      this.add.text(x, y + 88, `Representative\n${blueprint.hull.ship}`, {
        fontFamily: "Georgia",
        fontSize: "17px",
        color: "#bfd6ea",
        align: "center",
      }).setOrigin(0.5);
      this.add.text(x, y + 146, blueprint.description, {
        fontFamily: "Georgia",
        fontSize: "14px",
        color: "#96b5cc",
        align: "center",
        wordWrap: { width: 165 },
      }).setOrigin(0.5);
      const zone = this.add.zone(x, y, 190, 330).setInteractive({ useHandCursor: true });
      zone.on("pointerdown", () => {
        appState.selectedNation = nation;
        this.scene.start("battle");
      });
      zone.on("pointerover", () => card.setFillStyle(0x224960));
      zone.on("pointerout", () => card.setFillStyle(0x183346));
    });

    this.add.text(width * 0.5, height - 40, "Each nation uses the provided Tier IX hull data for handling and detection baselines.", {
      fontFamily: "Georgia",
      fontSize: "18px",
      color: "#b4cbdc",
    }).setOrigin(0.5);
  }
}
