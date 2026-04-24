import Phaser from "phaser";
import { appState } from "../core/appState";
import { saveOptions } from "../core/options";

export class OptionsScene extends Phaser.Scene {
  private container?: HTMLDivElement;
  private returnScene = "main-menu";

  constructor() {
    super("options");
  }

  init(data: { returnScene?: string }) {
    this.returnScene = data.returnScene ?? "main-menu";
  }

  create() {
    this.add.rectangle(this.scale.width * 0.5, this.scale.height * 0.5, this.scale.width, this.scale.height, 0x08131d, 0.82);
    this.add.text(this.scale.width * 0.5, 70, "Options", {
      fontFamily: "Georgia",
      fontSize: "42px",
      color: "#eff7ff",
    }).setOrigin(0.5);

    this.container = document.createElement("div");
    this.container.style.position = "absolute";
    this.container.style.left = "50%";
    this.container.style.top = "52%";
    this.container.style.transform = "translate(-50%, -50%)";
    this.container.style.width = "min(560px, 90vw)";
    this.container.style.padding = "24px";
    this.container.style.border = "2px solid #7fb3d8";
    this.container.style.background = "rgba(12, 29, 42, 0.95)";
    this.container.style.color = "#eef6ff";
    this.container.style.fontFamily = "Georgia, serif";
    this.container.style.borderRadius = "14px";
    this.container.innerHTML = this.getMarkup();
    document.body.appendChild(this.container);

    const apply = this.container.querySelector<HTMLButtonElement>("#apply-options")!;
    const back = this.container.querySelector<HTMLButtonElement>("#back-options")!;
    apply.onclick = () => {
      const fd = new FormData(this.container!.querySelector("form")!);
      appState.options = {
        sfxVolume: Number(fd.get("sfxVolume")),
        musicVolume: Number(fd.get("musicVolume")),
        muted: fd.get("muted") === "on",
        showDamageNumbers: fd.get("showDamageNumbers") === "on",
        zoomSpread: Number(fd.get("zoomSpread")),
      };
      saveOptions(appState.options);
      this.scene.start(this.returnScene);
    };
    back.onclick = () => this.scene.start(this.returnScene);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.container?.remove();
      this.container = undefined;
    });
  }

  getMarkup() {
    const options = appState.options;
    return `
      <form style="display:grid;gap:14px;">
        <label>Sound effects volume <input type="range" min="0" max="1" step="0.05" name="sfxVolume" value="${options.sfxVolume}" /></label>
        <label>Music volume <input type="range" min="0" max="1" step="0.05" name="musicVolume" value="${options.musicVolume}" /></label>
        <label><input type="checkbox" name="muted" ${options.muted ? "checked" : ""} /> Mute all audio</label>
        <label><input type="checkbox" name="showDamageNumbers" ${options.showDamageNumbers ? "checked" : ""} /> Display damage numbers</label>
        <label>Mouse wheel zoom range <input type="range" min="0.2" max="1" step="0.05" name="zoomSpread" value="${options.zoomSpread}" /></label>
        <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:10px;">
          <button type="button" id="back-options" style="padding:10px 16px;">Back</button>
          <button type="button" id="apply-options" style="padding:10px 16px;background:#1e5b7d;color:#fff;border:0;border-radius:6px;">Apply</button>
        </div>
      </form>
    `;
  }
}
