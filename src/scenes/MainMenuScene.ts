import Phaser from "phaser";

function button(scene: Phaser.Scene, x: number, y: number, label: string, action: () => void) {
  const bg = scene.add.rectangle(x, y, 260, 48, 0x14334b, 0.92).setStrokeStyle(2, 0xa8d0f0);
  const text = scene.add.text(x, y, label, {
    fontFamily: "Georgia",
    fontSize: "24px",
    color: "#f3f8ff",
  }).setOrigin(0.5);
  const zone = scene.add.zone(x, y, 260, 48).setInteractive({ useHandCursor: true });
  zone.on("pointerover", () => bg.setFillStyle(0x1b4a67));
  zone.on("pointerout", () => bg.setFillStyle(0x14334b));
  zone.on("pointerdown", action);
  return [bg, text, zone];
}

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("main-menu");
  }

  create() {
    const { width, height } = this.scale;
    const g = this.add.graphics();
    g.fillGradientStyle(0x2d5d7b, 0x244f69, 0x0b1826, 0x09111a, 1);
    g.fillRect(0, 0, width, height);
    g.fillStyle(0xffffff, 0.08);
    for (let i = 0; i < 9; i += 1) {
      g.fillEllipse(100 + i * 170, 120 + (i % 2) * 40, 220, 70);
    }

    this.add.text(width * 0.5, 122, "IRON HORIZON", {
      fontFamily: "Georgia",
      fontSize: "56px",
      color: "#f3f8ff",
      stroke: "#07111c",
      strokeThickness: 6,
    }).setOrigin(0.5);
    this.add.text(width * 0.5, 182, "Top-down WW2 battleship combat vertical slice", {
      fontFamily: "Georgia",
      fontSize: "20px",
      color: "#cfe4f7",
    }).setOrigin(0.5);

    button(this, width * 0.5, 300, "Start Game", () => this.scene.start("nation-select"));
    button(this, width * 0.5, 362, "Options", () => this.scene.start("options", { returnScene: "main-menu" }));
    button(this, width * 0.5, 424, "Credits / About", () => this.scene.start("credits"));
    button(this, width * 0.5, 486, "Quit / Back", () => window.history.back());

    this.add.text(width * 0.5, height - 42, "W/S throttle  A/D rudder  Left-click fire  Right-click torpedoes  Ctrl-click priority  Mouse wheel zoom", {
      fontFamily: "Georgia",
      fontSize: "18px",
      color: "#c8dced",
    }).setOrigin(0.5);
  }
}
