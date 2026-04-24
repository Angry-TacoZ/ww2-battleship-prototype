import Phaser from "phaser";
import { appState } from "../core/appState";
import { getZoomLimits } from "../core/options";
import { BattleModel } from "../systems/battle";
import { getShipRadius } from "../systems/movement";

export class BattleScene extends Phaser.Scene {
  private model!: BattleModel;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private hud!: Phaser.GameObjects.Text;
  private world!: Phaser.GameObjects.Graphics;
  private outcomeText!: Phaser.GameObjects.Text;
  private selectedTargetId?: string;
  private followTarget!: Phaser.GameObjects.Zone;
  private damageLabels: Phaser.GameObjects.Text[] = [];

  constructor() {
    super("battle");
  }

  create() {
    this.model = new BattleModel(appState.selectedNation);
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys("W,S,A,D,ONE,TWO,THREE,R,ESC") as Record<string, Phaser.Input.Keyboard.Key>;
    this.world = this.add.graphics();
    this.hud = this.add.text(20, 18, "", {
      fontFamily: "Georgia",
      fontSize: "18px",
      color: "#eff7ff",
      stroke: "#061017",
      strokeThickness: 4,
    }).setScrollFactor(0).setDepth(20);
    this.outcomeText = this.add.text(this.scale.width * 0.5, 82, "", {
      fontFamily: "Georgia",
      fontSize: "30px",
      color: "#fff4d9",
      stroke: "#0b1720",
      strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(21);

    this.followTarget = this.add.zone(this.model.player.position.x, this.model.player.position.y, 10, 10);
    this.cameras.main.setBounds(0, 0, 5400, 4200);
    this.cameras.main.startFollow(this.followTarget, true, 0.09, 0.09);
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const picked = this.model.pickTargetAt(worldPoint, pointer.event.ctrlKey);
      if (picked) this.selectedTargetId = picked.id;
      if (pointer.button === 0 && !pointer.event.ctrlKey) this.model.tryMainFire(worldPoint);
      if (pointer.button === 2) this.model.tryLaunchTorpedoes(worldPoint);
    });
    this.input.mouse?.disableContextMenu();
    this.input.on("wheel", (_pointer: Phaser.Input.Pointer, _go: unknown, _dx: number, dy: number) => {
      const limits = getZoomLimits(appState.options.zoomSpread);
      this.cameras.main.zoom = Phaser.Math.Clamp(this.cameras.main.zoom - dy * 0.001, limits.min, limits.max);
    });
    this.input.keyboard?.on("keydown-ONE", () => this.model.setAmmo("AP"));
    this.input.keyboard?.on("keydown-TWO", () => this.model.setAmmo("HE"));
    this.input.keyboard?.on("keydown-THREE", () => this.model.setWeaponMode("torpedo"));
    this.input.keyboard?.on("keydown-R", () => this.model.activateRepair());
    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("main-menu"));

    const limits = getZoomLimits(appState.options.zoomSpread);
    this.cameras.main.zoom = Phaser.Math.Clamp(0.9, limits.min, limits.max);

    const gameWindow = window as Window & { render_game_to_text?: () => string; advanceTime?: (ms: number) => void };
    gameWindow.render_game_to_text = () => JSON.stringify(this.model.getStateSnapshot());
    gameWindow.advanceTime = (ms: number) => {
      const steps = Math.max(1, Math.round(ms / (1000 / 60)));
      for (let i = 0; i < steps; i += 1) this.model.update(1 / 60, this.getInputState());
      this.followTarget.setPosition(this.model.player.position.x, this.model.player.position.y);
      this.renderWorld();
    };
    (window as Window & { __ironHorizonDebug?: unknown }).__ironHorizonDebug = {
      getModel: () => this.model,
      getScene: () => this,
    };
  }

  update(_time: number, delta: number) {
    const dt = Math.min(delta / 1000, 1 / 30);
    this.model.update(dt, this.getInputState());
    this.followTarget.setPosition(this.model.player.position.x, this.model.player.position.y);
    this.renderWorld();
  }

  getInputState() {
    const throttleDelta = (this.keys.W.isDown || this.cursors.up.isDown ? 1 : 0) - (this.keys.S.isDown || this.cursors.down.isDown ? 1 : 0);
    const rudder = (this.keys.D.isDown || this.cursors.right.isDown ? 1 : 0) - (this.keys.A.isDown || this.cursors.left.isDown ? 1 : 0);
    return {
      throttleDelta: throttleDelta * (1 / 60) * 1.7,
      rudder,
    };
  }

  renderWorld() {
    const g = this.world;
    g.clear();
    this.damageLabels.forEach((label) => label.destroy());
    this.damageLabels = [];

    g.fillStyle(0x0b2435);
    g.fillRect(0, 0, 5400, 4200);
    g.fillStyle(0x143d55, 0.55);
    for (let x = 0; x < 5400; x += 340) {
      for (let y = 0; y < 4200; y += 260) g.fillEllipse(x + 70, y + 40, 220, 70);
    }

    for (const ship of this.model.ships.filter((item) => item.alive)) {
      const radius = getShipRadius(ship);
      const outlineColor = ship.team === "player" ? 0xffffff : 0xf88d8d;
      g.lineStyle(2, outlineColor, 0.95);
      g.fillStyle(ship.blueprint.silhouette.hullColor, 1);
      drawShip(g, ship.position.x, ship.position.y, ship.heading, radius, ship.blueprint.silhouette.accentColor);
      if (this.selectedTargetId === ship.id || ship.id === this.model.player.secondaryPriorityId || ship.id === this.model.player.aaPriorityId) {
        g.lineStyle(3, 0xf9e38a, 0.95);
        g.strokeCircle(ship.position.x, ship.position.y, radius + 15);
      }
      drawBar(g, ship.position.x - 55, ship.position.y - radius - 20, 110, ship.hp / ship.blueprint.survivability.maxHp, ship.team === "player" ? 0x72d4a8 : 0xd97070);
      if (ship.fires.length > 0) {
        g.fillStyle(0xff8d44, 0.8);
        g.fillCircle(ship.position.x - 12, ship.position.y, 8);
      }
      if (ship.floods.length > 0) {
        g.fillStyle(0x61c8ff, 0.9);
        g.fillCircle(ship.position.x + 14, ship.position.y + 8, 7);
      }
    }

    for (const shell of this.model.shells) {
      g.fillStyle(shell.ammoType === "AP" ? 0xffe3a1 : 0xffa36f);
      g.fillCircle(shell.position.x, shell.position.y, 4);
    }

    for (const torpedo of this.model.torpedoes) {
      g.fillStyle(0x8cd7ff);
      g.fillCircle(torpedo.position.x, torpedo.position.y, 5);
      g.lineStyle(1, 0xd8f6ff, 0.6);
      g.strokeLineShape(new Phaser.Geom.Line(torpedo.position.x, torpedo.position.y, torpedo.position.x - torpedo.velocity.x * 0.08, torpedo.position.y - torpedo.velocity.y * 0.08));
    }

    for (const plane of this.model.aircraft) {
      g.fillStyle(0xe7ebf2);
      g.fillTriangle(plane.position.x - 12, plane.position.y + 5, plane.position.x + 14, plane.position.y, plane.position.x - 12, plane.position.y - 5);
      drawBar(g, plane.position.x - 20, plane.position.y - 18, 40, plane.hp / plane.maxHp, 0xa8d4f7);
      if (this.selectedTargetId === plane.id || plane.id === this.model.player.aaPriorityId) {
        g.lineStyle(2, 0xe7ef83);
        g.strokeCircle(plane.position.x, plane.position.y, 20);
      }
    }

    if (appState.options.showDamageNumbers) {
      for (const text of this.model.texts) {
        const alpha = 1 - text.age / 1.1;
        const label = this.add.text(text.position.x, text.position.y, text.value, {
          fontFamily: "Georgia",
          fontSize: "16px",
          color: `#${text.color.toString(16).padStart(6, "0")}`,
          stroke: "#08111a",
          strokeThickness: 3,
        }).setOrigin(0.5).setAlpha(alpha);
        this.damageLabels.push(label);
      }
    }

    const player = this.model.player;
    this.hud.setText([
      `${player.blueprint.hull.ship} | ${Math.round(player.hp)}/${player.blueprint.survivability.maxHp} HP | Ammo ${player.selectedAmmo} | Weapon ${player.weaponMode.toUpperCase()}`,
      `Main ${player.mainReload.toFixed(1)}s | Torps ${player.blueprint.torpedoes ? player.torpedoReload.toFixed(1) : "N/A"} | Repair ${player.repairCooldown.toFixed(1)}s | Fires ${player.fires.length} | Floods ${player.floods.length}`,
      `Throttle ${player.desiredThrottle.toFixed(2)} | Zoom ${this.cameras.main.zoom.toFixed(2)} | Secondary priority ${player.secondaryPriorityId ?? "auto"} | AA priority ${player.aaPriorityId ?? "auto"}`,
      `Controls: W/S throttle  A/D rudder  1 AP  2 HE  3 torpedoes  R repair  Ctrl-click priority  Mouse wheel zoom`,
    ]);
    this.outcomeText.setText(this.model.outcome.result === "running" ? "" : `${this.model.outcome.result.toUpperCase()}: ${this.model.outcome.message}`);
  }
}

function drawShip(g: Phaser.GameObjects.Graphics, x: number, y: number, heading: number, radius: number, accentColor: number) {
  const forward = new Phaser.Math.Vector2(Math.cos(heading), Math.sin(heading));
  const right = new Phaser.Math.Vector2(-forward.y, forward.x);
  const nose = new Phaser.Math.Vector2(x + forward.x * radius * 1.2, y + forward.y * radius * 1.2);
  const sternLeft = new Phaser.Math.Vector2(x - forward.x * radius + right.x * radius * 0.4, y - forward.y * radius + right.y * radius * 0.4);
  const sternRight = new Phaser.Math.Vector2(x - forward.x * radius - right.x * radius * 0.4, y - forward.y * radius - right.y * radius * 0.4);
  g.beginPath();
  g.moveTo(nose.x, nose.y);
  g.lineTo(sternLeft.x, sternLeft.y);
  g.lineTo(sternRight.x, sternRight.y);
  g.closePath();
  g.fillPath();
  g.strokePath();
  g.fillStyle(accentColor, 0.95);
  g.fillCircle(x, y, radius * 0.18);
  g.fillCircle(x - forward.x * radius * 0.35, y - forward.y * radius * 0.35, radius * 0.16);
}

function drawBar(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, ratio: number, color: number) {
  g.fillStyle(0x041017, 0.9);
  g.fillRect(x, y, width, 8);
  g.fillStyle(color, 1);
  g.fillRect(x + 1, y + 1, Math.max(0, (width - 2) * Phaser.Math.Clamp(ratio, 0, 1)), 6);
}
