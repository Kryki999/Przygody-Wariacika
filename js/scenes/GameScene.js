import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { PowerUp } from '../entities/PowerUp.js';
import { Herb } from '../entities/Herb.js';
import { Portal } from '../entities/Portal.js';
import { InputManager } from '../managers/InputManager.js';
import { EffectsManager } from '../managers/EffectsManager.js';
import { LEVELS } from '../data/levels.js';

/**
 * GameScene — główna scena rozgrywki.
 *
 * Systemy:
 *   - Look-ahead camera (followOffset wg kierunku gracza)
 *   - Kinematyczni wrogowie (bez kolizji z platformami)
 *   - Dash Attack (przebijanie wrogów + niszczenie ścian)
 *   - Combo System (mnożnik za pierniki)
 *   - Zbieranie Ziół → aktywacja portalu → VictoryScene
 */
export class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    init(data) {
        this.levelIndex = data && data.levelIndex !== undefined
            ? Math.min(data.levelIndex, LEVELS.length - 1)
            : 0;
    }

    create() {
        const cfg = LEVELS[this.levelIndex];
        this._levelCfg = cfg;
        const { mapWidth, mapHeight } = cfg;

        // ─── Managery ───
        this.saveManager = this.registry.get('saveManager');
        this.audioManager = this.registry.get('audioManager');
        this.shopManager = this.registry.get('shopManager');
        this.effectsManager = new EffectsManager(this);
        this.inputManager = new InputManager(this);

        // ─── Tło ───
        const bg = this.add.image(0, 0, cfg.background)
            .setOrigin(0, 0).setDepth(-1);
        bg.setDisplaySize(mapWidth, mapHeight);

        // ─── Platformy ───
        this.platforms = this.physics.add.staticGroup();
        cfg.platforms.forEach(p => {
            const tile = this.platforms.create(p.x, p.y, p.key);
            if (p.scaleX) tile.setScale(p.scaleX, 1);
            tile.refreshBody();
        });

        // ─── Kruche Ściany (breakable walls) ───
        this.breakableWalls = this.physics.add.staticGroup();
        this._breakableWallData = [];
        if (cfg.breakableWalls) {
            cfg.breakableWalls.forEach(bw => {
                // Używamy tekstury 'ground' z tintem — widualnie odróżniamy od normalnych platform
                const wall = this.breakableWalls.create(bw.x, bw.y, 'ground');
                wall.setTint(0x886644);
                wall.setScale(0.5, 0.8);
                wall.refreshBody();
                // Powiąż dane sekretu z obiektem ściany
                wall._secretHerbs = bw.secretHerbs || [];
                this._breakableWallData.push(wall);
            });
        }

        // ─── Gracz ───
        this.player = new Player(this, 100, mapHeight - 80, {
            shopManager: this.shopManager,
            saveManager: this.saveManager
        });

        // ─── Magiczne Zioła ───
        this.herbs = [];
        this.herbsCollected = 0;
        this.herbsTotal = cfg.herbs.length;

        cfg.herbs.forEach(h => {
            const herb = new Herb(this, h.x, h.y);
            this.herbs.push(herb);
        });

        // ─── Portal ───
        this.portal = new Portal(this, cfg.portal.x, cfg.portal.y);

        // ─── Pierniki (waluta) ───
        this.pierniki = this.physics.add.group();
        cfg.pierniki.forEach(p => {
            const pier = this.pierniki.create(p.x, p.y, 'star');
            pier.setBounceY(Phaser.Math.FloatBetween(0.3, 0.6));
        });

        // ─── Pociski wrogów ───
        this.bullets = this.physics.add.group();

        // ─── Wrogowie (KINEMATYCZNI — bez collider z platformami!) ───
        this.enemies = [];
        cfg.enemies.forEach(e => {
            const enemy = new Enemy(this, e.x, e.y, {
                ...e,
                bullets: this.bullets
                // UWAGA: nie przekazujemy platforms — enemy jest kinematyczny
            });
            this.enemies.push(enemy);
        });

        // ─── Power-upy ───
        this.powerUps = [];
        if (this.levelIndex === 0) {
            this.powerUps.push(new PowerUp(this, 200, 400, 'speed'));
            this.powerUps.push(new PowerUp(this, 750, 270, 'invincible'));
        }

        // ─── Stan gry ───
        this.score = 0;
        this.coins = this.saveManager ? (this.saveManager.get('coins') || 0) : 0;
        this.gameOver = false;
        this._victoryTriggered = false;

        // ─── Combo System ───
        this._combo = {
            count: 0,
            multiplier: 1,
            timer: 0,
            WINDOW: 2000  // ms na zebranie kolejnego piernika
        };

        // ─── Kolizje ───
        this.physics.add.collider(this.player.sprite, this.platforms);
        this.physics.add.collider(this.pierniki, this.platforms);
        this.physics.add.collider(this.bullets, this.platforms, (b) => b.destroy());
        // Gracz ↔ Kruche Ściany — normalny collider (blokuje)
        this.physics.add.collider(this.player.sprite, this.breakableWalls);

        // Zbieranie pierników
        this.physics.add.overlap(
            this.player.sprite, this.pierniki,
            this._collectPiernik, null, this
        );

        // Pociski w gracza
        this.physics.add.overlap(
            this.player.sprite, this.bullets,
            (_, bullet) => { bullet.destroy(); this._playerHit(); }
        );

        // ─── Look-Ahead Camera ───
        const LOOKAHEAD_PX = 100;
        this._lookaheadPx = LOOKAHEAD_PX;
        this.cameras.main.startFollow(this.player.sprite, true, 0.06, 0.1);
        this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
        this.cameras.main.setBackgroundColor('#87CEEB');
        // Inicjalny offset — w prawo (gracz spawnuje patrząc w prawo)
        this.cameras.main.setFollowOffset(-LOOKAHEAD_PX, 0);

        // Ustaw granice fizyki świata
        this.physics.world.setBounds(0, 0, mapWidth, mapHeight);
        this.player.sprite.setCollideWorldBounds(true);

        // ─── Uruchom UIScene ───
        this.scene.launch('UIScene');
        this._emitUIUpdate();

        // ─── Audio ───
        if (this.audioManager) this.audioManager.playMusic('music_main');
    }

    // ─────────────────────────────────────────
    // Update loop
    // ─────────────────────────────────────────

    update(time, delta) {
        if (this.gameOver) return;

        this.inputManager.update();

        // ─── Gracz ───
        this.player.update(this.inputManager, this.effectsManager, delta);

        // ─── Look-Ahead Camera — aktualizuj offset wg kierunku ───
        const targetOffsetX = -this.player.facingDir * this._lookaheadPx;
        const cam = this.cameras.main;
        // Płynna interpolacja offsetu (0.03 = ~60 klatek do pełnego przesunięcia)
        cam.followOffset.x += (targetOffsetX - cam.followOffset.x) * 0.03;

        // ─── Wrogowie ───
        this.enemies.forEach(enemy => {
            if (!enemy.isDead()) {
                enemy.update(this.player, delta);
            }
        });

        // ─── Kolizja gracz ↔ wrogowie ───
        this._checkEnemyCollisions();

        // ─── Dash ↔ Kruche Ściany ───
        this._checkBreakableWalls();

        // ─── Kolizja gracz ↔ zioła ───
        this._checkHerbCollection();

        // ─── Kolizja gracz ↔ aktywny portal ───
        if (!this._victoryTriggered && this.portal && this.portal.isActive) {
            const dist = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                this.portal.x, this.portal.y
            );
            if (dist < 40) {
                this._triggerVictory();
            }
        }

        // ─── Power-upy ───
        this.powerUps.forEach(pu => {
            if (pu.isCollected()) return;
            const dist = Phaser.Math.Distance.Between(
                this.player.x, this.player.y, pu.x, pu.y
            );
            if (dist < 30) {
                pu.collect(this.player, this.effectsManager);
                this.game.events.emit('ui:buff', {
                    label: pu.type === 'speed' ? '⚡ SPEED!' : '★ INVINCIBLE!',
                    active: true
                });
                this.time.delayedCall(pu._cfg ? pu._cfg.duration : 4000, () => {
                    this.game.events.emit('ui:buff', { label: '', active: false });
                });
            }
        });

        // ─── Combo timer tick ───
        this._updateCombo(delta);
    }

    // ─────────────────────────────────────────
    // Enemy Collision (dash vs stomp vs damage)
    // ─────────────────────────────────────────

    _checkEnemyCollisions() {
        this.enemies.forEach(enemy => {
            if (enemy.isDead()) return;
            const dist = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                enemy.x, enemy.y
            );
            if (dist < 34) {
                // ─── DASH ATTACK → przebij się i zniszcz ───
                if (this.player.isDashing) {
                    const killed = enemy.takeDamage(999, this.effectsManager, {
                        dirX: this.player.facingDir,
                        force: 100
                    });
                    if (killed) {
                        this.score += 100;
                        this._emitUIUpdate();
                        // Duży piernik wypadający z wroga
                        this._spawnBigPiernik(enemy.x, enemy.y);
                    }
                    // Gracz NIE traci pędu — idzie dalej
                    return;
                }

                // ─── Stomp (skok na głowę) ───
                const playerFalling = this.player.body.velocity.y > 50;
                const playerAbove = this.player.y < enemy.y - 10;
                if (playerFalling && playerAbove) {
                    const killed = enemy.takeDamage(999, this.effectsManager);
                    if (killed) {
                        this.score += 50;
                        this._emitUIUpdate();
                        this.player.sprite.setVelocityY(-350);
                    }
                } else {
                    // ─── Gracz obrywa ───
                    this._playerHit();
                }
            }
        });
    }

    /**
     * Duży piernik (5× wartość) wypadający z pokonanego wroga podczas dashu.
     */
    _spawnBigPiernik(x, y) {
        const pier = this.pierniki.create(x, y - 10, 'star');
        if (!pier) return;
        pier.setScale(1.5);
        pier.setTint(0xffaa00);
        pier.setBounceY(0.6);
        pier.setVelocity(Phaser.Math.Between(-60, 60), -200);
        // Oznacz jako "big" — wart 5 pierników
        pier._bigPiernik = true;
    }

    // ─────────────────────────────────────────
    // Breakable Walls
    // ─────────────────────────────────────────

    _checkBreakableWalls() {
        if (!this.player.isDashing) return;

        this._breakableWallData.forEach(wall => {
            if (!wall.active) return;
            const dist = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                wall.x, wall.y
            );
            if (dist < 50) {
                this._destroyWall(wall);
            }
        });
    }

    _destroyWall(wall) {
        // Efekt cząsteczkowy — rozpadające się cegły
        if (this.effectsManager) {
            this.effectsManager.flashOnEnemyDefeat(wall.x, wall.y);
        }

        // Debris particles (prosty efekt)
        for (let i = 0; i < 6; i++) {
            const debris = this.add.rectangle(
                wall.x + Phaser.Math.Between(-20, 20),
                wall.y + Phaser.Math.Between(-15, 15),
                Phaser.Math.Between(6, 14),
                Phaser.Math.Between(6, 14),
                0x886644
            );
            this.tweens.add({
                targets: debris,
                x: debris.x + Phaser.Math.Between(-60, 60),
                y: debris.y + Phaser.Math.Between(20, 80),
                alpha: 0,
                angle: Phaser.Math.Between(-180, 180),
                duration: Phaser.Math.Between(400, 700),
                onComplete: () => debris.destroy()
            });
        }

        // Odkryj sekretne zioła za ścianą
        if (wall._secretHerbs) {
            wall._secretHerbs.forEach(sh => {
                const herb = new Herb(this, sh.x, sh.y);
                this.herbs.push(herb);
                this.herbsTotal++;
                this._emitUIUpdate();
            });
        }

        // Shake
        this.cameras.main.shake(150, 0.01);

        // Zniszcz ścianę
        wall.destroy();
    }

    // ─────────────────────────────────────────
    // Herb Collection
    // ─────────────────────────────────────────

    _checkHerbCollection() {
        this.herbs.forEach(herb => {
            if (herb.isCollected()) return;
            const dist = Phaser.Math.Distance.Between(
                this.player.x, this.player.y, herb.x, herb.y
            );
            if (dist < 30) {
                herb.collect(this.effectsManager);
                this.herbsCollected++;
                this.score += 100;
                this._emitUIUpdate();
                this._checkPortalActivation();
                if (this.audioManager) this.audioManager.playSFX('sfx_collect');
            }
        });
    }

    // ─────────────────────────────────────────
    // Combo System
    // ─────────────────────────────────────────

    _updateCombo(delta) {
        if (this._combo.timer > 0) {
            this._combo.timer -= delta;
            // Emituj ratio do UI co klatkę
            const ratio = Math.max(0, this._combo.timer / this._combo.WINDOW);
            this.game.events.emit('ui:combo', {
                multiplier: this._combo.multiplier,
                timerRatio: ratio
            });

            if (this._combo.timer <= 0) {
                // Combo wygasło
                this._combo.count = 0;
                this._combo.multiplier = 1;
                this.game.events.emit('ui:combo', { multiplier: 0, timerRatio: 0 });
            }
        }
    }

    // ─────────────────────────────────────────
    // Handlers
    // ─────────────────────────────────────────

    _collectPiernik(playerSprite, piernik) {
        piernik.disableBody(true, true);

        // Combo
        this._combo.count++;
        this._combo.multiplier = Math.min(this._combo.count, 10);
        this._combo.timer = this._combo.WINDOW;

        const baseValue = piernik._bigPiernik ? 50 : 10;
        const comboScore = baseValue * this._combo.multiplier;

        this.score += comboScore;
        this.coins += piernik._bigPiernik ? 5 : 1;

        this.effectsManager.sparkOnCollect(piernik.x, piernik.y);
        if (this.audioManager) this.audioManager.playSFX('sfx_collect');
        if (this.saveManager) this.saveManager.addCoins(piernik._bigPiernik ? 5 : 1);
        this._emitUIUpdate();
    }

    _checkPortalActivation() {
        if (this.herbsCollected >= this.herbsTotal) {
            this.portal.activate();
            this.game.events.emit('ui:portal', true);
        }
    }

    _triggerVictory() {
        if (this._victoryTriggered) return;
        this._victoryTriggered = true;
        this.gameOver = true;

        this.player.sprite.setVelocity(0, 0);
        this.physics.pause();

        if (this.saveManager) {
            const prev = this.saveManager.get('score') || 0;
            if (this.score > prev) this.saveManager.set('score', this.score);
        }

        this.cameras.main.shake(200, 0.015);

        this.time.delayedCall(600, () => {
            this.scene.stop('UIScene');
            this.scene.start('VictoryScene', {
                score: this.score,
                herbsTotal: this.herbsTotal,
                coins: this.coins,
                levelIndex: this.levelIndex
            });
        });
    }

    _playerHit() {
        const hurt = this.player.takeDamage(1, this.effectsManager);
        if (!hurt) return;

        if (this.audioManager) this.audioManager.playSFX('sfx_hurt');
        this.game.events.emit('ui:hp', this.player.hp);

        if (!this.player.isAlive()) {
            this._triggerGameOver();
        }
    }

    _triggerGameOver() {
        this.gameOver = true;
        this.physics.pause();

        if (this.saveManager) {
            const prev = this.saveManager.get('score') || 0;
            if (this.score > prev) this.saveManager.set('score', this.score);
        }

        this.cameras.main.shake(500, 0.03);

        const W = this.scale.width;
        const H = this.scale.height;

        // Overlay
        const overlay = this.add.rectangle(0, 0, W * 4, H * 4, 0x000000, 0)
            .setScrollFactor(0).setDepth(300);
        this.tweens.add({ targets: overlay, alpha: 0.65, duration: 600 });

        const goText = this.add.text(W / 2, H / 2 - 60, 'KONIEC GRY', {
            fontSize: '52px', color: '#e94560', fontFamily: 'Arial Black',
            stroke: '#000', strokeThickness: 6
        }).setOrigin(0.5).setScrollFactor(0).setDepth(301).setAlpha(0).setScale(0.5);

        this.tweens.add({
            targets: goText, alpha: 1, scaleX: 1, scaleY: 1,
            duration: 500, ease: 'Back.easeOut', delay: 300
        });

        const msg = this.add.text(W / 2, H / 2 + 0, `🌿 Zebrane zioła: ${this.herbsCollected}/${this.herbsTotal}`, {
            fontSize: '20px', color: '#aaffaa', fontFamily: 'Arial',
            wordWrap: { width: W * 0.85 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(301).setAlpha(0);

        const scoreMsg = this.add.text(W / 2, H / 2 + 44, `Wynik: ${this.score}`, {
            fontSize: '26px', color: '#ffd700', fontFamily: 'Arial Black'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(301).setAlpha(0);

        this.tweens.add({ targets: [msg, scoreMsg], alpha: 1, duration: 400, delay: 700 });

        const restartBtn = this.add.text(W / 2, H / 2 + 110, '▶ ZAGRAJ PONOWNIE', {
            fontSize: '24px', color: '#00ff88', fontFamily: 'Arial Black',
            backgroundColor: '#1a1a2e', padding: { x: 16, y: 8 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(301).setAlpha(0)
            .setInteractive({ useHandCursor: true });

        const menuBtn = this.add.text(W / 2, H / 2 + 165, '🏠 MENU', {
            fontSize: '20px', color: '#ffffff', fontFamily: 'Arial',
            backgroundColor: '#333333', padding: { x: 16, y: 8 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(301).setAlpha(0)
            .setInteractive({ useHandCursor: true });

        this.tweens.add({ targets: [restartBtn, menuBtn], alpha: 1, duration: 400, delay: 1000 });

        restartBtn.on('pointerdown', () => {
            this.scene.stop('UIScene');
            this.scene.restart({ levelIndex: this.levelIndex });
        });
        menuBtn.on('pointerdown', () => {
            this.scene.stop('UIScene');
            this.scene.start('MenuScene');
        });
    }

    _emitUIUpdate() {
        this.game.events.emit('ui:score', this.score);
        this.game.events.emit('ui:coins', this.coins);
        this.game.events.emit('ui:hp', this.player.hp);
        this.game.events.emit('ui:herbs', { collected: this.herbsCollected, total: this.herbsTotal });
    }

    shutdown() {
        if (this.inputManager) this.inputManager.destroy();
        if (this.audioManager) this.audioManager.stopMusic();
    }
}
