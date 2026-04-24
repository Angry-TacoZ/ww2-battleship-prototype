import Phaser from "phaser";

export class CreditsScene extends Phaser.Scene {
  constructor() {
    super("credits");
  }

  create() {
    const { width, height } = this.scale;
    this.add.rectangle(width * 0.5, height * 0.5, width, height, 0x08111a);
    this.add.text(width * 0.5, 80, "Credits / About", {
      fontFamily: "Georgia",
      fontSize: "40px",
      color: "#eef6ff",
    }).setOrigin(0.5);
    this.add.text(width * 0.5, 220, "Iron Horizon is an original WW2-inspired prototype built with Phaser, TypeScript, and stat-driven ship data.\n\nPlaceholder art is procedural so the vertical slice remains fully playable.\n\nMain guns are manual. Secondaries and AA auto-engage. Ctrl-click sets target priority.\n\nPress Esc to return.", {
      fontFamily: "Georgia",
      fontSize: "22px",
      color: "#bfd5e7",
      align: "center",
      wordWrap: { width: 760 },
    }).setOrigin(0.5);
    this.input.keyboard?.once("keydown-ESC", () => this.scene.start("main-menu"));
  }
}
