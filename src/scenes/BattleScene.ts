import Phaser from "phaser";
import { appState } from "../core/appState";
import { getZoomLimits } from "../core/options";
import { BattleModel } from "../systems/battle";
import { getShipRadius } from "../systems/movement";
import playerShipUrl from "../assets/generated/player-battleship.png";
import enemyShipUrl from "../assets/generated/enemy-battleship.png";
import oceanTextureUrl from "../assets/generated/ocean-texture.jpg";
import shellTracerUrl from "../assets/generated/shell-tracer.png";
import shellSplashUrl from "../assets/generated/shell-splash.png";
import torpedoWakeUrl from "../assets/generated/torpedo-wake.png";
import flakBurstUrl from "../assets/generated/flak-burst.png";
import fireStatusUrl from "../assets/generated/fire-status.png";
import floodStatusUrl from "../assets/generated/flood-status.png";

// The texture's nose is rotated about 60 degrees in its square display size.
const SHELL_ART_ROTATION_OFFSET = Math.PI / 3;

export class BattleScene extends Phaser.Scene {
  private model!: BattleModel;
  private hudCamera!: Phaser.Cameras.Scene2D.Camera;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private hud!: Phaser.GameObjects.Text;
  private world!: Phaser.GameObjects.Graphics;
  private outcomeText!: Phaser.GameObjects.Text;
  private selectedTargetId?: string;
  private followTarget!: Phaser.GameObjects.Zone;
  private shipSprites = new Map<string, Phaser.GameObjects.Image>();
  private shellSprites = new Map<string, Phaser.GameObjects.Image>();
  private torpedoSprites = new Map<string, Phaser.GameObjects.Image>();
  private fireSprites = new Map<string, Phaser.GameObjects.Image>();
  private floodSprites = new Map<string, Phaser.GameObjects.Image>();
  private damageLabels = new Map<string, Phaser.GameObjects.Text>();
  private splashSprites = new Map<string, Phaser.GameObjects.Image>();
  private activeFlakIds = new Set<string>();
  private ocean!: Phaser.GameObjects.TileSprite;

  constructor() {
    super("battle");
  }

  preload() {
    this.load.image("art-player-ship", playerShipUrl);
    this.load.image("art-enemy-ship", enemyShipUrl);
    this.load.image("art-ocean", oceanTextureUrl);
    this.load.image("art-shell", shellTracerUrl);
    this.load.image("art-splash", shellSplashUrl);
    this.load.image("art-torpedo", torpedoWakeUrl);
    this.load.image("art-flak", flakBurstUrl);
    this.load.image("art-fire", fireStatusUrl);
    this.load.image("art-flood", floodStatusUrl);
  }

  create() {
    this.model = new BattleModel(appState.selectedNation);
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys("W,S,A,D,ONE,TWO,THREE,R,ESC") as Record<string, Phaser.Input.Keyboard.Key>;
    this.ocean = this.add.tileSprite(2700, 2100, 5400, 4200, "art-ocean").setDepth(-2);
    this.ocean.setTileScale(0.72, 0.72);
    this.world = this.add.graphics();
    const hudPanel = this.add.rectangle(16, 14, 1015, 142, 0x06131f, 0.84)
      .setOrigin(0)
      .setStrokeStyle(2, 0x6db8cf, 0.55)
      .setScrollFactor(0)
      .setDepth(19);
    this.hud = this.add.text(34, 28, "", {
      fontFamily: "Georgia",
      fontSize: "20px",
      lineSpacing: 6,
      color: "#eff7ff",
      stroke: "#02080d",
      strokeThickness: 3,
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
    const hudObjects = new Set<Phaser.GameObjects.GameObject>([hudPanel, this.hud, this.outcomeText]);
    this.cameras.main.ignore([...hudObjects]);
    this.hudCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height).setScroll(0, 0);
    this.hudCamera.ignore(this.children.list.filter((child) => !hudObjects.has(child)));
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
    this.ocean.tilePositionX = this.model.player.position.x * 0.08;
    this.ocean.tilePositionY = this.model.player.position.y * 0.06;

    const liveShipIds = new Set<string>();
    for (const ship of this.model.ships.filter((item) => item.alive)) {
      liveShipIds.add(ship.id);
      const radius = getShipRadius(ship);
      const outlineColor = ship.team === "player" ? 0xffffff : 0xf88d8d;
      let shipArt = this.shipSprites.get(ship.id);
      if (!shipArt) {
        shipArt = this.ignoreOnHudCamera(this.add.image(ship.position.x, ship.position.y, ship.team === "player" ? "art-player-ship" : "art-enemy-ship").setDepth(4));
        this.shipSprites.set(ship.id, shipArt);
      }
      shipArt.setPosition(ship.position.x, ship.position.y).setDisplaySize(radius * 1.15, radius * 3.1).setRotation(ship.heading + Math.PI / 2);
      g.lineStyle(2, outlineColor, 0.95);
      if (this.selectedTargetId === ship.id || ship.id === this.model.player.secondaryPriorityId || ship.id === this.model.player.aaPriorityId) {
        g.lineStyle(3, 0xf9e38a, 0.95);
        g.strokeCircle(ship.position.x, ship.position.y, radius + 15);
      }
      drawBar(g, ship.position.x - 55, ship.position.y - radius - 20, 110, ship.hp / ship.blueprint.survivability.maxHp, ship.team === "player" ? 0x72d4a8 : 0xd97070);
      this.syncShipStatusSprite(this.fireSprites, ship.id, ship.fires.length > 0, "art-fire", ship.position.x - radius * 0.12, ship.position.y - radius * 0.1, radius * 0.9, radius * 1.15);
      this.syncShipStatusSprite(this.floodSprites, ship.id, ship.floods.length > 0, "art-flood", ship.position.x + radius * 0.12, ship.position.y + radius * 0.18, radius * 1.12, radius * 0.72);
    }
    for (const [id, sprite] of this.shipSprites) {
      if (!liveShipIds.has(id)) {
        sprite.destroy();
        this.shipSprites.delete(id);
      }
    }
    this.destroyMissingSprites(this.fireSprites, liveShipIds);
    this.destroyMissingSprites(this.floodSprites, liveShipIds);

    this.syncShellSprites();
    this.syncTorpedoSprites();

    for (const plane of this.model.aircraft) {
      g.fillStyle(0xe7ebf2);
      g.fillTriangle(plane.position.x - 12, plane.position.y + 5, plane.position.x + 14, plane.position.y, plane.position.x - 12, plane.position.y - 5);
      drawBar(g, plane.position.x - 20, plane.position.y - 18, 40, plane.hp / plane.maxHp, 0xa8d4f7);
      if (this.selectedTargetId === plane.id || plane.id === this.model.player.aaPriorityId) {
        g.lineStyle(2, 0xe7ef83);
        g.strokeCircle(plane.position.x, plane.position.y, 20);
      }
    }

    const flakEvents = this.model.texts.filter((text) => text.value.startsWith("Flak"));
    for (const event of flakEvents) {
      if (this.activeFlakIds.has(event.id)) continue;
      const flak = this.ignoreOnHudCamera(this.add.image(event.position.x, event.position.y, "art-flak")
        .setDisplaySize(72, 72)
        .setDepth(8));
      this.tweens.add({
        targets: flak,
        alpha: 0,
        scaleX: flak.scaleX * 1.35,
        scaleY: flak.scaleY * 1.35,
        duration: 420,
        onComplete: () => flak.destroy(),
      });
      this.activeFlakIds.add(event.id);
    }
    this.activeFlakIds = new Set(flakEvents.map((event) => event.id));

    this.syncShellImpacts();
    this.syncDamageNumbers();

    const player = this.model.player;
    this.hud.setText([
      `${player.blueprint.hull.ship} | ${Math.round(player.hp)}/${player.blueprint.survivability.maxHp} HP | Ammo ${player.selectedAmmo} | Weapon ${player.weaponMode.toUpperCase()}`,
      `Main ${player.mainReload.toFixed(1)}s | Torps ${player.blueprint.torpedoes ? player.torpedoReload.toFixed(1) : "N/A"} | Repair ${player.repairCooldown.toFixed(1)}s | Fires ${player.fires.length} | Floods ${player.floods.length}`,
      `Throttle ${player.desiredThrottle.toFixed(2)} | Zoom ${this.cameras.main.zoom.toFixed(2)} | Secondary priority ${player.secondaryPriorityId ?? "auto"} | AA priority ${player.aaPriorityId ?? "auto"}`,
      `Controls: W/S throttle  A/D rudder  1 AP  2 HE  3 torpedoes  R repair  Ctrl-click priority  Mouse wheel zoom`,
    ]);
    this.outcomeText.setText(this.model.outcome.result === "running" ? "" : `${this.model.outcome.result.toUpperCase()}: ${this.model.outcome.message}`);
  }

  private syncShellSprites() {
    const liveIds = new Set<string>();
    for (const shell of this.model.shells) {
      liveIds.add(shell.id);
      let sprite = this.shellSprites.get(shell.id);
      if (!sprite) {
        sprite = this.ignoreOnHudCamera(this.add.image(shell.position.x, shell.position.y, "art-shell").setDepth(7));
        this.shellSprites.set(shell.id, sprite);
      }
      const angle = Math.atan2(shell.velocity.y, shell.velocity.x);
      sprite.setPosition(shell.position.x, shell.position.y).setDisplaySize(38, 38).setRotation(angle + SHELL_ART_ROTATION_OFFSET).setTint(shell.ammoType === "AP" ? 0xfff3c4 : 0xffbd81);
    }
    this.destroyMissingSprites(this.shellSprites, liveIds);
  }

  private syncTorpedoSprites() {
    const liveIds = new Set<string>();
    for (const torpedo of this.model.torpedoes) {
      liveIds.add(torpedo.id);
      let sprite = this.torpedoSprites.get(torpedo.id);
      if (!sprite) {
        sprite = this.ignoreOnHudCamera(this.add.image(torpedo.position.x, torpedo.position.y, "art-torpedo").setDepth(5));
        this.torpedoSprites.set(torpedo.id, sprite);
      }
      const angle = Math.atan2(torpedo.velocity.y, torpedo.velocity.x);
      sprite.setPosition(torpedo.position.x, torpedo.position.y).setDisplaySize(44, 88).setRotation(angle + Math.PI / 2);
    }
    this.destroyMissingSprites(this.torpedoSprites, liveIds);
  }

  private syncShipStatusSprite(sprites: Map<string, Phaser.GameObjects.Image>, shipId: string, active: boolean, texture: string, x: number, y: number, width: number, height: number) {
    if (!active) {
      const sprite = sprites.get(shipId);
      if (sprite) {
        sprite.destroy();
        sprites.delete(shipId);
      }
      return;
    }
    let sprite = sprites.get(shipId);
    if (!sprite) {
      sprite = this.ignoreOnHudCamera(this.add.image(x, y, texture).setDepth(6).setAlpha(0.92));
      sprites.set(shipId, sprite);
    }
    sprite.setPosition(x, y).setDisplaySize(width, height);
  }

  private syncDamageNumbers() {
    if (!appState.options.showDamageNumbers) {
      this.damageLabels.forEach((label) => label.destroy());
      this.damageLabels.clear();
      return;
    }
    const liveIds = new Set<string>();
    for (const text of this.model.texts) {
      if (text.value.startsWith("Flak")) continue;
      liveIds.add(text.id);
      const alpha = 1 - text.age / 1.1;
      let label = this.damageLabels.get(text.id);
      if (!label) {
        label = this.ignoreOnHudCamera(this.add.text(text.position.x, text.position.y, text.value, {
          fontFamily: "Georgia",
          fontSize: "16px",
          color: `#${text.color.toString(16).padStart(6, "0")}`,
          stroke: "#08111a",
          strokeThickness: 3,
        }).setOrigin(0.5));
        this.damageLabels.set(text.id, label);
      }
      label.setPosition(text.position.x, text.position.y).setAlpha(alpha);
    }
    for (const [id, label] of this.damageLabels) {
      if (!liveIds.has(id)) {
        label.destroy();
        this.damageLabels.delete(id);
      }
    }
  }

  private syncShellImpacts() {
    const liveIds = new Set<string>();
    for (const impact of this.model.shellImpacts) {
      liveIds.add(impact.id);
      const alpha = 1 - impact.age / 1.1;
      let splash = this.splashSprites.get(impact.id);
      if (!splash) {
        splash = this.ignoreOnHudCamera(this.add.image(impact.position.x, impact.position.y, "art-splash").setDisplaySize(54, 54).setDepth(6));
        this.splashSprites.set(impact.id, splash);
      }
      splash.setPosition(impact.position.x, impact.position.y).setAlpha(alpha * 0.72);
    }
    this.destroyMissingSprites(this.splashSprites, liveIds);
  }

  private ignoreOnHudCamera<T extends Phaser.GameObjects.GameObject>(object: T) {
    this.hudCamera.ignore(object);
    return object;
  }

  private destroyMissingSprites(sprites: Map<string, Phaser.GameObjects.Image>, liveIds: Set<string>) {
    for (const [id, sprite] of sprites) {
      if (!liveIds.has(id)) {
        sprite.destroy();
        sprites.delete(id);
      }
    }
  }
}

function drawBar(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, ratio: number, color: number) {
  g.fillStyle(0x041017, 0.9);
  g.fillRect(x, y, width, 8);
  g.fillStyle(color, 1);
  g.fillRect(x + 1, y + 1, Math.max(0, (width - 2) * Phaser.Math.Clamp(ratio, 0, 1)), 6);
}
