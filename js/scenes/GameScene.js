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
 * Nowa pętla rozgrywki:
 *   1. Zbierz wszystkie Magiczne Zioła (🌿) → portal się aktywuje
 *   2. Wejdź w Portal → VictoryScene
 *   Pierniki (🥨) to waluta/punkty, nie blokują portalu.
 *
 * Poziomy ładowane z js/data/levels.js (data-driven).
 */
export class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    /**
     * Dane startowe przekazywane przez scene.start('GameScene', { levelIndex })
     */
    init(data) {
        this.levelIndex = data && data.levelIndex !== undefined
            ? Math.min(data.levelIndex, LEVELS.length - 1)
            : 0;
    }

    create() {
        // Pobierz konfigurację poziomu
        this._levelCfg = LEVELS[this.levelIndex];
        const cfg = this._levelCfg;
        const { mapWidth, mapHeight } = cfg;

        // ─── Managery ───
        this.saveManager = this.registry.get('saveManager');
        this.audioManager = this.registry.get('audioManager');
        this.shopManager = this.registry.get('shopManager');
        this.effectsManager = new EffectsManager(this);
        this.inputManager = new InputManager(this);

        // ─── Tło (skalowane do mapy) ───
        const bg = this.add.image(0, 0, cfg.background)
            .setOrigin(0, 0)
            .setDepth(-1);
        // Skaluj tło żeby wypełniło całą mapę
        bg.setDisplaySize(mapWidth, mapHeight);

        // ─── Platformy z konfiguracji ───
        this.platforms = this.physics.add.staticGroup();
        cfg.platforms.forEach(p => {
            const tile = this.platforms.create(p.x, p.y, p.key);
            if (p.scaleX) tile.setScale(p.scaleX, 1);
            tile.refreshBody();
        });

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

        // ─── Wrogowie ───
        this.enemies = [];
        cfg.enemies.forEach(e => {
            const enemy = new Enemy(this, e.x, e.y, {
                ...e,
                platforms: this.platforms,
                bullets: this.bullets
            });
            this.physics.add.collider(enemy.sprite, this.platforms);
            this.enemies.push(enemy);
        });

        // ─── Power-upy (hardkodowane per poziom 0) ───
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

        // ─── Kolizje ───
        this.physics.add.collider(this.player.sprite, this.platforms);
        this.physics.add.collider(this.pierniki, this.platforms);
        this.physics.add.collider(this.bullets, this.platforms, (b) => b.destroy());

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

        // ─── Kamera ───
        // Śledź gracza; granice = wymiary mapy (gracz nie widzi pustki za mapą)
        this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
        this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
        this.cameras.main.setBackgroundColor('#87CEEB');

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

        // ─── Wrogowie ───
        this.enemies.forEach(enemy => {
            if (!enemy.isDead()) {
                enemy.update(this.player, delta);
            }
        });

        // ─── Kolizja gracz z wrogami (detekcja manualna) ───
        this.enemies.forEach(enemy => {
            if (enemy.isDead()) return;
            const dist = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                enemy.x, enemy.y
            );
            if (dist < 34) {
                const playerFalling = this.player.body.velocity.y > 50;
                const playerAbove = this.player.y < enemy.y - 10;
                if (playerFalling && playerAbove) {
                    const killed = enemy.takeDamage(999, this.effectsManager);
                    if (killed) {
                        this.score += 50;
                        this._emitUIUpdate();
                        this.player.sprite.setVelocityY(-280);
                    }
                } else {
                    this._playerHit();
                }
            }
        });

        // ─── Kolizja gracz z ziołami ───
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

        // ─── Kolizja gracz z aktywnym portalem ───
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
    }

    // ─────────────────────────────────────────
    // Handlers
    // ─────────────────────────────────────────

    _collectPiernik(playerSprite, piernik) {
        piernik.disableBody(true, true);
        this.score += 10;
        this.coins += 1;
        this.effectsManager.sparkOnCollect(piernik.x, piernik.y);
        if (this.audioManager) this.audioManager.playSFX('sfx_collect');
        if (this.saveManager) this.saveManager.addCoins(1);
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

        // Zachowaj wynik
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
