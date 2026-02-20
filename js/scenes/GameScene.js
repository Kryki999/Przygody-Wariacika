import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { PowerUp } from '../entities/PowerUp.js';
import { InputManager } from '../managers/InputManager.js';
import { EffectsManager } from '../managers/EffectsManager.js';

/**
 * GameScene — główna scena rozgrywki.
 * Refaktor oryginalnego main.js w architekturę klas.
 */
export class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    create() {
        const W = this.scale.width;
        const H = this.scale.height;

        // Pobierz globalne managery z Phaser Registry
        this.saveManager = this.registry.get('saveManager');
        this.audioManager = this.registry.get('audioManager');
        this.shopManager = this.registry.get('shopManager');

        // ─── Inicjalizacja managerów lokalnych ───
        this.effectsManager = new EffectsManager(this);
        this.inputManager = new InputManager(this);

        // ─── Tło ───
        this.add.image(W / 2, H / 2, 'sky');

        // ─── Platformy ───
        this.platforms = this.physics.add.staticGroup();
        this.platforms.create(400, 568, 'ground').setScale(2).refreshBody();
        this.platforms.create(600, 400, 'ground');
        this.platforms.create(50, 250, 'ground');
        this.platforms.create(750, 220, 'ground');

        // ─── Gracz ───
        this.player = new Player(this, 100, 450, {
            shopManager: this.shopManager,
            saveManager: this.saveManager
        });

        // ─── Gwiazdki (znajdzki) ───
        this.stars = this.physics.add.group({
            key: 'star',
            repeat: 11,
            setXY: { x: 12, y: 0, stepX: 70 }
        });
        this.stars.children.iterate(child => {
            child.setBounceY(Phaser.Math.FloatBetween(0.4, 0.8));
        });

        // ─── Pociski wrogów ───
        this.bullets = this.physics.add.group();

        // ─── Wrogowie ───
        this.enemies = [];
        this._spawnEnemies();

        // ─── Power-upy ───
        this.powerUps = [];
        this._spawnPowerUps();

        // ─── Kolizje i nakładki ───
        this.physics.add.collider(this.player.sprite, this.platforms);
        this.physics.add.collider(this.stars, this.platforms);
        this.physics.add.collider(this.bullets, this.platforms, (bullet) => bullet.destroy());

        this.enemies.forEach(e => {
            if (e.sprite.active) {
                this.physics.add.collider(e.sprite, this.platforms);
            }
        });

        // Gracz zbiera gwiazdki
        this.physics.add.overlap(this.player.sprite, this.stars, this._collectStar, null, this);

        // Gracz wchodzi w power-upa (sprawdzane ręcznie w update)

        // Gracz vs pociski
        this.physics.add.overlap(this.player.sprite, this.bullets, (playerSprite, bullet) => {
            bullet.destroy();
            this._playerHit();
        });

        // ─── Stan gry ───
        this.score = 0;
        this.coins = this.saveManager ? this.saveManager.get('coins') : 0;
        this.gameOver = false;

        // ─── Uruchom UIScene jako overlay ───
        this.scene.launch('UIScene');
        this._emitUIUpdate();

        // ─── Kamera ───
        this.cameras.main.setBackgroundColor('#87CEEB');

        // ─── Audio ───
        if (this.audioManager) this.audioManager.playMusic('music_main');
    }

    // ─────────────────────────────────────────
    // Spawn
    // ─────────────────────────────────────────

    _spawnEnemies() {
        // Patrolujący
        const e1 = new Enemy(this, 600, 370, { type: 'patrol', speed: 70, patrolDistance: 90, hp: 1 });
        this.physics.add.collider(e1.sprite, this.platforms);
        this.enemies.push(e1);

        // Goniący
        const e2 = new Enemy(this, 300, 220, { type: 'chaser', speed: 85, aggroRange: 220, hp: 2 });
        this.physics.add.collider(e2.sprite, this.platforms);
        this.enemies.push(e2);

        // Latający + strzelający
        const e3 = new Enemy(this, 650, 150, {
            type: 'flying', speed: 60, hp: 3,
            bulletInterval: 2500, bullets: this.bullets
        });
        this.enemies.push(e3);
    }

    _spawnPowerUps() {
        // Power-up prędkości na platformie środkowej
        const pu1 = new PowerUp(this, 200, 220, 'speed');
        this.powerUps.push(pu1);

        // Power-up nieśmiertelności na platformie prawej
        const pu2 = new PowerUp(this, 730, 185, 'invincible');
        this.powerUps.push(pu2);
    }

    // ─────────────────────────────────────────
    // Update loop
    // ─────────────────────────────────────────

    update(time, delta) {
        if (this.gameOver) return;

        // InputManager — uaktualnij stan
        this.inputManager.update();

        // Gracz
        this.player.update(this.inputManager, this.effectsManager, delta);

        // Wrogowie
        this.enemies.forEach(enemy => {
            if (!enemy.isDead()) {
                enemy.update(this.player, delta);
            }
        });

        // Kolizja gracz z wrogami (przez overlap na spriteach)
        this.enemies.forEach(enemy => {
            if (enemy.isDead()) return;
            const dist = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                enemy.x, enemy.y
            );

            if (dist < 32) {
                // Skok na wroga od góry → pokonanie
                const playerFalling = this.player.body.velocity.y > 50;
                const playerAbove = this.player.y < enemy.y - 10;

                if (playerFalling && playerAbove) {
                    const killed = enemy.takeDamage(999, this.effectsManager);
                    if (killed) {
                        this.score += 50;
                        this.coins += 5;
                        this._emitUIUpdate();
                        this.player.sprite.setVelocityY(-280); // odbicie po depcnięciu
                    }
                } else {
                    this._playerHit();
                }
            }
        });

        // Power-upy
        this.powerUps.forEach(pu => {
            if (pu.isCollected()) return;
            const dist = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                pu.x, pu.y
            );
            if (dist < 30) {
                pu.collect(this.player, this.effectsManager);
                // Powiadom UI o aktivnym buffie
                this.game.events.emit('ui:buff', { label: pu.type === 'speed' ? '⚡ SPEED!' : '★ INVINCIBLE!', active: true });
                this.time.delayedCall(pu._cfg ? pu._cfg.duration : 4000, () => {
                    this.game.events.emit('ui:buff', { label: '', active: false });
                });
            }
        });

        // Mini aktualizacja monet z saveManager (zsynchronizuj co 2s)
        // (zapis odbywa się bezpośrednio w collectStar)
    }

    // ─────────────────────────────────────────
    // Handlers
    // ─────────────────────────────────────────

    _collectStar(playerSprite, star) {
        star.disableBody(true, true);

        this.score += 10;
        this.coins += 1;

        this.effectsManager.sparkOnCollect(star.x, star.y);
        if (this.audioManager) this.audioManager.playSFX('sfx_collect');

        // Zapisz monety
        if (this.saveManager) this.saveManager.addCoins(1);

        this._emitUIUpdate();

        // Respawn wszystkich gwiazdek gdy wszystkie zebrane
        if (this.stars.countActive(true) === 0) {
            this.stars.children.iterate(child => {
                child.enableBody(true, child.x, 0, true, true);
            });
            // Dodaj nowego latającego wroga dla trudności
            this._spawnBonusEnemy();
        }
    }

    _spawnBonusEnemy() {
        const x = Phaser.Math.Between(100, 700);
        const bonus = new Enemy(this, x, 50, {
            type: 'flying',
            speed: 80,
            hp: 2,
            bulletInterval: 2000,
            bullets: this.bullets
        });
        this.enemies.push(bonus);
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

        // Zapisz score jeśli lepszy od poprzedniego
        if (this.saveManager) {
            const prevScore = this.saveManager.get('score') || 0;
            if (this.score > prevScore) {
                this.saveManager.set('score', this.score);
            }
        }

        this.cameras.main.shake(500, 0.03);

        // Panel Game Over — wjazd z alfa 0
        const W = this.scale.width;
        const H = this.scale.height;

        const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0)
            .setScrollFactor(0).setDepth(300);

        this.tweens.add({ targets: overlay, alpha: 0.65, duration: 600 });

        const goText = this.add.text(W / 2, H / 2 - 50, 'KONIEC GRY', {
            fontSize: '52px',
            color: '#e94560',
            fontFamily: 'Arial Black',
            stroke: '#000', strokeThickness: 6
        }).setOrigin(0.5).setScrollFactor(0).setDepth(301).setAlpha(0).setScale(0.5);

        this.tweens.add({
            targets: goText,
            alpha: 1,
            scaleX: 1, scaleY: 1,
            duration: 500,
            ease: 'Back.easeOut',
            delay: 300
        });

        const msg = this.add.text(W / 2, H / 2 + 10, 'Kasjan zabrał ci całe zioło i uciekł 😭', {
            fontSize: '20px', color: '#ffffff', fontFamily: 'Arial',
            wordWrap: { width: W * 0.85 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(301).setAlpha(0);

        const scoreMsg = this.add.text(W / 2, H / 2 + 50, `Wynik: ${this.score}`, {
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
            this.scene.restart();
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
    }

    // Czyszczenie przy zatrzymaniu sceny
    shutdown() {
        if (this.inputManager) this.inputManager.destroy();
        if (this.audioManager) this.audioManager.stopMusic();
    }
}
