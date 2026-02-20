/**
 * Player — klasa gracza z dash attack, binary joystick i retro physics.
 *
 * System Dash:
 *   - inputManager.attack → 180ms zryw w kierunku patrzenia
 *   - Podczas dashu: zerowa grawitacja, niewrażliwość, afterimage trail
 *   - Kolizja z wrogiem podczas dashu → wróg zniszczony (obsługiwane w GameScene)
 */
export class Player {
    // ─── Stałe ───
    static DASH_SPEED = 650;
    static DASH_DURATION = 180;   // ms
    static DASH_COOLDOWN = 800;   // ms

    /**
     * @param {Phaser.Scene} scene
     * @param {number} x
     * @param {number} y
     * @param {object} options — { maxHP, speed, saveManager, shopManager }
     */
    constructor(scene, x, y, options = {}) {
        this.scene = scene;
        const sm = options.shopManager;

        // Statystyki bazowe (+31% prędkości: 160 → 210)
        this.maxHP = 3 + (sm ? sm.getActiveStatBoosts().filter(b => b.effect.stat === 'maxHP').length : 0);
        this.speed = 210 + (sm ? sm.getActiveStatBoosts().filter(b => b.effect.stat === 'speed').reduce((s, b) => s + b.effect.value, 0) : 0);
        this.hp = this.maxHP;

        // Sprite gracza
        this.sprite = scene.physics.add.sprite(x, y, 'dude');
        this.sprite.setBounce(0.05);
        this.sprite.setCollideWorldBounds(false);
        // Wysoki opór poziomy — brak ślizgania
        this.sprite.setDragX(1800);

        // Skórka ze sklepu
        if (sm) {
            const skin = sm.getActiveSkin();
            if (skin) this.sprite.setTint(skin.effect.tint);
        }

        // Animacje (jeśli nie istnieją)
        if (!scene.anims.exists('left')) {
            scene.anims.create({ key: 'left', frames: scene.anims.generateFrameNumbers('dude', { start: 0, end: 3 }), frameRate: 10, repeat: -1 });
            scene.anims.create({ key: 'turn', frames: [{ key: 'dude', frame: 4 }], frameRate: 20 });
            scene.anims.create({ key: 'right', frames: scene.anims.generateFrameNumbers('dude', { start: 5, end: 8 }), frameRate: 10, repeat: -1 });
        }

        // Stan power-upów
        this.activeBuffs = {};

        // Invincibility frames po obrażeniach
        this._damageCooldown = false;
        this._wasOnGround = false;

        // Timer kurzu przy biegu
        this._runDustTimer = 0;

        // ─── Dash state ───
        this._isDashing = false;
        this._dashCooldownTimer = 0;
        this._facingDir = 1;   // 1 = prawo, -1 = lewo  (do kamery look-ahead i dashu)
    }

    get body() { return this.sprite.body; }
    get x() { return this.sprite.x; }
    get y() { return this.sprite.y; }

    /** Czy gracz jest w trakcie dashu (invincible + przebija wrogów). */
    get isDashing() { return this._isDashing; }

    /** Kierunek patrzenia (-1 lewo, 1 prawo). Używany przez kamerę look-ahead. */
    get facingDir() { return this._facingDir; }

    /**
     * Główna funkcja update — wywołuj z GameScene.update().
     */
    update(inputManager, effectsManager, delta) {
        const sprite = this.sprite;
        const onGround = sprite.body.blocked.down;

        // ─── Dash cooldown tick ───
        if (this._dashCooldownTimer > 0) this._dashCooldownTimer -= delta;

        // ─── Podczas dashu — nie reaguj na normalny input ───
        if (this._isDashing) return;

        // ─── Lądowanie (detekcja krawędzi) ───
        if (onGround && !this._wasOnGround) {
            const fallSpeed = Math.abs(sprite.body.velocity.y);
            if (fallSpeed > 200 && effectsManager) {
                effectsManager.dustOnLand(sprite.x, sprite.y + 20);
                if (fallSpeed > 350) effectsManager.shakeLand();
            }
        }
        this._wasOnGround = onGround;

        // ─── Ruch poziomy (binary: -1/0/+1 × baseSpeed) ───
        const baseSpeed = this.activeBuffs.speed ? this.speed * 1.5 : this.speed;
        const joystickX = inputManager.joystickX || 0;

        const velocityX = joystickX * baseSpeed;
        sprite.setVelocityX(velocityX);

        // Animacja kierunku + facing direction tracking
        if (joystickX < -0.1) {
            sprite.anims.play('left', true);
            this._facingDir = -1;
            if (onGround && effectsManager) {
                this._runDustTimer += delta;
                if (this._runDustTimer > 130) {
                    effectsManager.dustOnRun(sprite.x + 10, sprite.y);
                    this._runDustTimer = 0;
                }
            }
        } else if (joystickX > 0.1) {
            sprite.anims.play('right', true);
            this._facingDir = 1;
            if (onGround && effectsManager) {
                this._runDustTimer += delta;
                if (this._runDustTimer > 130) {
                    effectsManager.dustOnRun(sprite.x - 10, sprite.y);
                    this._runDustTimer = 0;
                }
            }
        } else {
            sprite.setVelocityX(0);
            sprite.anims.play('turn');
            this._runDustTimer = 0;
        }

        // ─── Skok ───
        if (inputManager.jump && onGround) {
            const jumpPower = this.activeBuffs.speed ? -820 : -680;
            sprite.setVelocityY(jumpPower);
        }

        // ─── Dash Attack ───
        if (inputManager.attack && this._dashCooldownTimer <= 0) {
            this._startDash(effectsManager);
        }
    }

    // ─────────────────────────────────────────
    // Dash Attack
    // ─────────────────────────────────────────

    _startDash(effectsManager) {
        this._isDashing = true;
        this._damageCooldown = true;  // invincible
        this._dashCooldownTimer = Player.DASH_COOLDOWN;

        const sprite = this.sprite;
        const dir = this._facingDir;

        // Zawiś w powietrzu
        sprite.body.allowGravity = false;
        sprite.setVelocityY(0);
        sprite.setVelocityX(dir * Player.DASH_SPEED);

        // Visual: tint cyan
        sprite.setTint(0x00ffff);

        // Afterimage trail (3 kopie)
        this._spawnAfterimages(dir);

        // Zakończ dash po DASH_DURATION ms
        this.scene.time.delayedCall(Player.DASH_DURATION, () => {
            this._endDash();
        });
    }

    _endDash() {
        this._isDashing = false;
        this._damageCooldown = false;

        const sprite = this.sprite;
        sprite.body.allowGravity = true;
        sprite.clearTint();

        // Nie zeruj prędkości X — niech gracz zachowa pęd (drag go zatrzyma)
    }

    _spawnAfterimages(dir) {
        const sprite = this.sprite;
        for (let i = 1; i <= 3; i++) {
            const ghost = this.scene.add.sprite(
                sprite.x - dir * i * 18,
                sprite.y,
                'dude',
                dir === 1 ? 6 : 2  // frame z animacji left/right
            );
            ghost.setAlpha(0.5 - i * 0.12);
            ghost.setTint(0x00ffff);
            ghost.setDepth(sprite.depth - 1);

            this.scene.tweens.add({
                targets: ghost,
                alpha: 0,
                duration: 250,
                onComplete: () => ghost.destroy()
            });
        }
    }

    // ─────────────────────────────────────────
    // Damage
    // ─────────────────────────────────────────

    /**
     * Zadaj obrażenia graczowi.
     * @returns {boolean} true jeśli obrażenie przyjęte
     */
    takeDamage(amount, effectsManager) {
        if (this._damageCooldown || this._isDashing || this.activeBuffs.invincible) return false;

        this.hp -= amount;
        if (effectsManager) {
            effectsManager.flashOnPlayerHit(this.sprite.x, this.sprite.y);
            effectsManager.shakePlayerHurt();
        }

        // Miganie (invincibility frames ~1.5s)
        this._damageCooldown = true;
        this.scene.tweens.add({
            targets: this.sprite,
            alpha: 0,
            duration: 100,
            yoyo: true,
            repeat: 7,
            onComplete: () => {
                this.sprite.setAlpha(1);
                this._damageCooldown = false;
            }
        });

        return true;
    }

    applyBuff(buff) {
        this.activeBuffs[buff.type] = true;

        if (buff.type === 'invincible') this.sprite.setTint(0x00ffff);
        if (buff.type === 'speed') this.sprite.setTint(0xffaa00);

        this.scene.time.addEvent({
            delay: buff.duration,
            callback: () => {
                delete this.activeBuffs[buff.type];
                this.sprite.clearTint();
                if (buff.onExpire) buff.onExpire();
            }
        });
    }

    isAlive() { return this.hp > 0; }

    destroy() {
        this.sprite.destroy();
    }
}
