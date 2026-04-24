import { chromium } from "playwright";

const URL = "http://127.0.0.1:5173";
const VIEWPORT = { width: 1280, height: 720 };
const nationClick = {
  germany: { x: 610, y: 310 },
  usa: { x: 170, y: 310 },
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function launchBattle(page, nation) {
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.mouse.click(640, 300);
  await page.waitForTimeout(250);
  const point = nationClick[nation];
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(500);
  await page.evaluate(() => window.advanceTime?.(200));
}

async function getSnapshot(page) {
  const raw = await page.evaluate(() => window.render_game_to_text?.() ?? "{}");
  return JSON.parse(raw);
}

async function getTargetScreenPoint(page, kind, index = 0) {
  return page.evaluate(({ kind, index }) => {
    const debug = window.__ironHorizonDebug;
    const scene = debug.getScene();
    const model = debug.getModel();
    const cam = scene.cameras.main;
    const entity = kind === "ship" ? model.ships.filter((ship) => ship.team === "enemy" && ship.alive)[index] : model.aircraft.filter((plane) => plane.alive)[index];
    return {
      x: (entity.position.x - cam.scrollX) * cam.zoom,
      y: (entity.position.y - cam.scrollY) * cam.zoom,
      id: entity.id,
    };
  }, { kind, index });
}

async function getAircraftPointById(page, id) {
  return page.evaluate((id) => {
    const debug = window.__ironHorizonDebug;
    const scene = debug.getScene();
    const model = debug.getModel();
    const cam = scene.cameras.main;
    const entity = model.aircraft.find((plane) => plane.id === id);
    return {
      x: (entity.position.x - cam.scrollX) * cam.zoom,
      y: (entity.position.y - cam.scrollY) * cam.zoom,
      id: entity.id,
    };
  }, id);
}

async function dispatchCanvasClick(page, x, y, options = {}) {
  await page.evaluate(({ x, y, options }) => {
    const canvas = document.querySelector("canvas");
    const rect = canvas.getBoundingClientRect();
    const eventInit = {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + x,
      clientY: rect.top + y,
      ctrlKey: Boolean(options.ctrlKey),
      button: options.button === "right" ? 2 : 0,
      buttons: options.button === "right" ? 2 : 1,
    };
    canvas.dispatchEvent(new PointerEvent("pointerdown", eventInit));
    canvas.dispatchEvent(new MouseEvent("mousedown", eventInit));
    canvas.dispatchEvent(new PointerEvent("pointerup", eventInit));
    canvas.dispatchEvent(new MouseEvent(options.button === "right" ? "contextmenu" : "click", eventInit));
    canvas.dispatchEvent(new MouseEvent("mouseup", eventInit));
  }, { x, y, options });
}

async function setupCloseSurfaceFight(page) {
  await page.evaluate(() => {
    const model = window.__ironHorizonDebug.getModel();
    const player = model.player;
    player.position.x = 2100;
    player.position.y = 2100;
    player.heading = 0;
    player.desiredThrottle = 0.2;
    const enemies = model.ships.filter((ship) => ship.team === "enemy");
    enemies[0].position.x = 2580;
    enemies[0].position.y = 2100;
    enemies[0].heading = Math.PI;
    enemies[0].desiredThrottle = 0;
    enemies[1].position.x = 2350;
    enemies[1].position.y = 2480;
    enemies[1].heading = -Math.PI / 2;
    enemies[1].desiredThrottle = 0;
    model.texts = [];
  });
  await page.evaluate(() => window.advanceTime?.(200));
}

async function spawnAircraftPair(page) {
  await page.evaluate(() => {
    const model = window.__ironHorizonDebug.getModel();
    model.aircraftTimer = 999;
    model.aircraft = [
      { id: "plane-a", team: "enemy", position: { x: model.player.position.x + 250, y: model.player.position.y - 80 }, velocity: { x: -30, y: 0 }, hp: 1400, maxHp: 1400, heading: Math.PI, alive: true, squadron: "Test A" },
      { id: "plane-b", team: "enemy", position: { x: model.player.position.x + 250, y: model.player.position.y + 90 }, velocity: { x: -30, y: 0 }, hp: 1400, maxHp: 1400, heading: Math.PI, alive: true, squadron: "Test B" },
    ];
  });
  await page.evaluate(() => window.advanceTime?.(300));
}

async function run() {
  const browser = await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader"] });
  const page = await browser.newPage({ viewport: VIEWPORT });
  const results = [];

  await launchBattle(page, "germany");
  await setupCloseSurfaceFight(page);

  const beforeMain = await getSnapshot(page);
  const enemyPoint = await getTargetScreenPoint(page, "ship", 0);
  await page.mouse.click(enemyPoint.x, enemyPoint.y);
  await page.evaluate(() => window.advanceTime?.(5000));
  const afterMain = await getSnapshot(page);
  results.push({
    name: "Player can damage an enemy with main guns",
    pass: afterMain.enemies[0].hp < beforeMain.enemies[0].hp,
    detail: { before: beforeMain.enemies[0].hp, after: afterMain.enemies[0].hp },
  });

  const playerBeforeEnemyFire = afterMain.player.hp;
  await page.evaluate(() => window.advanceTime?.(12000));
  const afterEnemyFire = await getSnapshot(page);
  results.push({
    name: "Enemy can damage the player",
    pass: afterEnemyFire.player.hp < playerBeforeEnemyFire,
    detail: { before: playerBeforeEnemyFire, after: afterEnemyFire.player.hp },
  });

  await page.evaluate(() => {
    const model = window.__ironHorizonDebug.getModel();
    const enemy = model.ships.filter((ship) => ship.team === "enemy")[1];
    enemy.hp = enemy.blueprint.survivability.maxHp;
    enemy.position.x = model.player.position.x + 520;
    enemy.position.y = model.player.position.y + 30;
    enemy.desiredThrottle = 0;
  });
  const beforeSecondary = await getSnapshot(page);
  const secondaryTargetId = await page.evaluate(() => window.__ironHorizonDebug.getModel().ships.filter((ship) => ship.team === "enemy")[1].id);
  await page.evaluate(() => window.advanceTime?.(6000));
  const afterSecondary = await getSnapshot(page);
  const beforeSecondaryHp = beforeSecondary.enemies.find((enemy) => enemy.id === secondaryTargetId)?.hp ?? 0;
  const afterSecondaryHp = afterSecondary.enemies.find((enemy) => enemy.id === secondaryTargetId)?.hp ?? 0;
  results.push({
    name: "Secondaries auto-fire when ships enter range",
    pass: afterSecondaryHp < beforeSecondaryHp,
    detail: { before: beforeSecondaryHp, after: afterSecondaryHp },
  });

  const secondEnemyPoint = await getTargetScreenPoint(page, "ship", 1);
  await dispatchCanvasClick(page, secondEnemyPoint.x, secondEnemyPoint.y, { ctrlKey: true });
  const afterSecondaryPriority = await getSnapshot(page);
  results.push({
    name: "Ctrl-click changes secondary priority target",
    pass: afterSecondaryPriority.player.secondaryPriorityId === secondEnemyPoint.id,
    detail: { selected: afterSecondaryPriority.player.secondaryPriorityId, expected: secondEnemyPoint.id },
  });

  await spawnAircraftPair(page);
  const beforeAa = await getSnapshot(page);
  await page.evaluate(() => window.advanceTime?.(3000));
  const afterAa = await getSnapshot(page);
  results.push({
    name: "AA fires at aircraft",
    pass: afterAa.aircraft[0].hp < beforeAa.aircraft[0].hp || afterAa.aircraft.length < beforeAa.aircraft.length,
    detail: { before: beforeAa.aircraft, after: afterAa.aircraft },
  });

  const secondAircraftPoint = await getAircraftPointById(page, "plane-b");
  await dispatchCanvasClick(page, secondAircraftPoint.x, secondAircraftPoint.y, { ctrlKey: true });
  const afterAaPriority = await getSnapshot(page);
  results.push({
    name: "Ctrl-click changes AA priority target",
    pass: afterAaPriority.player.aaPriorityId === secondAircraftPoint.id,
    detail: { selected: afterAaPriority.player.aaPriorityId, expected: secondAircraftPoint.id },
  });

  await page.evaluate(() => {
    const model = window.__ironHorizonDebug.getModel();
    const enemy = model.ships.filter((ship) => ship.team === "enemy")[0];
    enemy.position.x = model.player.position.x + 280;
    enemy.position.y = model.player.position.y;
    enemy.desiredThrottle = 0;
    model.player.blueprint.torpedoes.floodChance = 1;
  });
  const beforeTorpedo = await page.evaluate(() => {
    const model = window.__ironHorizonDebug.getModel();
    const enemy = model.ships.filter((ship) => ship.team === "enemy")[0];
    return { hp: enemy.hp, floods: enemy.floods.length, id: enemy.id };
  });
  const torpedoPoint = await getTargetScreenPoint(page, "ship", 0);
  await dispatchCanvasClick(page, torpedoPoint.x, torpedoPoint.y, { button: "right" });
  await page.evaluate(() => window.advanceTime?.(8000));
  const afterTorpedo = await getSnapshot(page);
  const torpedoTarget = afterTorpedo.enemies.find((enemy) => enemy.id === torpedoPoint.id);
  const afterTorpedoDebug = await page.evaluate(() => {
    const model = window.__ironHorizonDebug.getModel();
    const enemy = model.ships.filter((ship) => ship.team === "enemy")[0];
    return { hp: enemy.hp, floods: enemy.floods.length };
  });
  results.push({
    name: "Torpedoes launch on torpedo-equipped ships and cause meaningful damage/flooding",
    pass: Boolean(torpedoTarget && beforeTorpedo.hp - torpedoTarget.hp > 10000 && afterTorpedoDebug.floods >= beforeTorpedo.floods),
    detail: { before: beforeTorpedo, target: torpedoTarget, afterDebug: afterTorpedoDebug, torpedoesInWorld: afterTorpedo.torpedoes },
  });

  await page.evaluate(() => {
    const model = window.__ironHorizonDebug.getModel();
    const player = model.player;
    player.fires = [{ id: "test-fire", type: "fire", remaining: 2.5, tickTimer: 0.5, damagePerTick: 150 }];
    player.floods = [{ id: "test-flood", type: "flood", remaining: 2.5, tickTimer: 0.5, damagePerTick: 180 }];
  });
  const beforeDots = await getSnapshot(page);
  await page.evaluate(() => window.advanceTime?.(4000));
  const afterDots = await getSnapshot(page);
  results.push({
    name: "Fires and flooding tick over time and expire",
    pass: afterDots.player.hp < beforeDots.player.hp && afterDots.player.fires === 0 && afterDots.player.floods === 0,
    detail: { before: beforeDots.player, after: afterDots.player },
  });

  await launchBattle(page, "usa");
  await setupCloseSurfaceFight(page);
  const usaPoint = await getTargetScreenPoint(page, "ship", 0);
  await dispatchCanvasClick(page, usaPoint.x, usaPoint.y, { button: "right" });
  await page.evaluate(() => window.advanceTime?.(1000));
  const usaAfterTorp = await getSnapshot(page);
  results.push({
    name: "Torpedoes do not appear on ships without torpedo stats",
    pass: usaAfterTorp.torpedoes === 0,
    detail: { ship: usaAfterTorp.player.ship, torpedoes: usaAfterTorp.torpedoes },
  });

  await launchBattle(page, "germany");
  const winResult = await page.evaluate(() => {
    const model = window.__ironHorizonDebug.getModel();
    const dt = 1 / 30;
    for (let i = 0; i < 30 * 150 && model.outcome.result === "running"; i += 1) {
      const player = model.player;
      const enemies = model.ships.filter((ship) => ship.team === "enemy" && ship.alive);
      const target = enemies.sort((a, b) => {
        const da = Math.hypot(a.position.x - player.position.x, a.position.y - player.position.y);
        const db = Math.hypot(b.position.x - player.position.x, b.position.y - player.position.y);
        return da - db;
      })[0];
      if (target) {
        const angle = Math.atan2(target.position.y - player.position.y, target.position.x - player.position.x);
        player.heading = angle;
        player.desiredThrottle = 0.55;
        if (player.mainReload <= 0) model.tryMainFire({ x: target.position.x, y: target.position.y });
        if (player.blueprint.torpedoes && player.torpedoReload <= 0 && Math.hypot(target.position.x - player.position.x, target.position.y - player.position.y) < 700) {
          model.tryLaunchTorpedoes({ x: target.position.x, y: target.position.y });
        }
        if (player.hp < player.blueprint.survivability.maxHp * 0.45) model.activateRepair();
      }
      model.update(dt, { throttleDelta: 0, rudder: 0 });
    }
    return model.outcome;
  });
  results.push({
    name: "Player can win the default scenario with reasonable play",
    pass: winResult.result === "victory",
    detail: winResult,
  });

  await launchBattle(page, "germany");
  const loseResult = await page.evaluate(() => {
    const model = window.__ironHorizonDebug.getModel();
    const dt = 1 / 30;
    for (let i = 0; i < 30 * 600 && model.outcome.result === "running"; i += 1) {
      model.update(dt, { throttleDelta: 0, rudder: 0 });
    }
    return model.outcome;
  });
  results.push({
    name: "Player can lose the default scenario by ignoring threats",
    pass: loseResult.result === "defeat",
    detail: loseResult,
  });

  await page.screenshot({ path: "output/web-game/verification-summary.png" });
  await browser.close();

  const failed = results.filter((result) => !result.pass);
  console.log(JSON.stringify({ results, failedCount: failed.length }, null, 2));
  process.exitCode = failed.length ? 1 : 0;
}

run();
