/**
 * Player — klasa gracza z obsługą analogowego joysticka.
 * Kompatybilna z nowym InputManager (joystickX -1..1).
 */
export class Player {
    /**
     * @param {Phaser.Scene} scene
     * @param {number} x
     * @param {number} y
     * @param {object} options — { maxHP, speed, saveManager, shopManager }
     */
    constructor(scene, x, y, options = {}) {
        this.scene = scene;
        const sm = options.shopManager;

        // Statystyki bazowe
        this.maxHP = 3 + (sm ? sm.getActiveStatBoosts().filter(b => b.effect.stat === 'maxHP').length : 0);
        this.speed = 160 + (sm ? sm.getActiveStatBoosts().filter(b => b.effect.stat === 'speed').reduce((s, b) => s + b.effect.value, 0) : 0);
        this.hp = this.maxHP;

        // Sprite gracza
        this.sprite = scene.physics.add.sprite(x, y, 'dude');
        this.sprite.setBounce(0.1);
        this.sprite.setCollideWorldBounds(false); // Granice ustawia kamera/scena

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
    }

    get body() { return this.sprite.body; }
    get x() { return this.sprite.x; }
    get y() { return this.sprite.y; }

    /**
     * Główna funkcja update — wywołuj z GameScene.update().
     * Używa inputManager.joystickX do proporcjonalnego ruchu.
     */
    update(inputManager, effectsManager, delta) {
        const sprite = this.sprite;
        const onGround = sprite.body.blocked.down;

        // ─── Lądowanie (detekcja krawędzi) ───
        if (onGround && !this._wasOnGround) {
            const fallSpeed = Math.abs(sprite.body.velocity.y);
            if (fallSpeed > 200 && effectsManager) {
                effectsManager.dustOnLand(sprite.x, sprite.y + 20);
                if (fallSpeed > 350) effectsManager.shakeLand();
            }
        }
        this._wasOnGround = onGround;

        // ─── Ruch poziomy (proporcjonalny do wychylenia joysticka) ───
        const baseSpeed = this.activeBuffs.speed ? this.speed * 1.5 : this.speed;
        const joystickX = inputManager.joystickX || 0;

        // Dead zone jest już obsłużona w InputManager; tu używamy wartości wprost
        const velocityX = joystickX * baseSpeed;
        sprite.setVelocityX(velocityX);

        // Animacja kierunku
        if (joystickX < -0.1) {
            sprite.anims.play('left', true);
            if (onGround && effectsManager) {
                this._runDustTimer += delta;
                if (this._runDustTimer > 130) {
                    effectsManager.dustOnRun(sprite.x + 10, sprite.y);
                    this._runDustTimer = 0;
                }
            }
        } else if (joystickX > 0.1) {
            sprite.anims.play('right', true);
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
            const jumpPower = this.activeBuffs.speed ? -400 : -340;
            sprite.setVelocityY(jumpPower);
        }
    }

    /**
     * Zadaj obrażenia graczowi.
     * @returns {boolean} true jeśli obrażenie przyjęte
     */
    takeDamage(amount, effectsManager) {
        if (this._damageCooldown || this.activeBuffs.invincible) return false;

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
