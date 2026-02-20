/**
 * Player — klasa gracza enkapsulująca HP, prędkość, buffy i integrację z managerami.
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
        this.sprite.setBounce(0.2);
        this.sprite.setCollideWorldBounds(true);

        // Zastosuj skórkę ze sklepu
        if (sm) {
            const skin = sm.getActiveSkin();
            if (skin) this.sprite.setTint(skin.effect.tint);
        }

        // Rejestracja animacji (jeśli jeszcze nie istnieją)
        if (!scene.anims.exists('left')) {
            scene.anims.create({ key: 'left', frames: scene.anims.generateFrameNumbers('dude', { start: 0, end: 3 }), frameRate: 10, repeat: -1 });
            scene.anims.create({ key: 'turn', frames: [{ key: 'dude', frame: 4 }], frameRate: 20 });
            scene.anims.create({ key: 'right', frames: scene.anims.generateFrameNumbers('dude', { start: 5, end: 8 }), frameRate: 10, repeat: -1 });
        }

        // Stan power-upów
        this.activeBuffs = {};

        // Cooldown po otrzymaniu obrażeń (invincibility frames)
        this._damageCooldown = false;
        this._wasOnGround = false;

        // Licznik klatek dla efektu kurzu przy biegu
        this._runDustTimer = 0;
    }

    get body() { return this.sprite.body; }
    get x() { return this.sprite.x; }
    get y() { return this.sprite.y; }

    /**
     * Główna funkcja update — wywołuj z GameScene.update()
     */
    update(inputManager, effectsManager, delta) {
        const sprite = this.sprite;
        const onGround = sprite.body.touching.down || sprite.body.blocked.down;

        // ─── Lądowanie (detekcja krawędzi) ───
        if (onGround && !this._wasOnGround) {
            const fallSpeed = Math.abs(sprite.body.velocity.y);
            if (fallSpeed > 200 && effectsManager) {
                effectsManager.dustOnLand(sprite.x, sprite.y + 20);
                if (fallSpeed > 350) effectsManager.shakeLand();
            }
        }
        this._wasOnGround = onGround;

        // ─── Ruch poziomy ───
        const currentSpeed = this.activeBuffs.speed ? this.speed * 1.5 : this.speed;

        if (inputManager.left) {
            sprite.setVelocityX(-currentSpeed);
            sprite.anims.play('left', true);

            // Efekt kurzu przy biegu
            if (onGround && effectsManager) {
                this._runDustTimer += delta;
                if (this._runDustTimer > 120) {
                    effectsManager.dustOnRun(sprite.x + 10, sprite.y);
                    this._runDustTimer = 0;
                }
            }

        } else if (inputManager.right) {
            sprite.setVelocityX(currentSpeed);
            sprite.anims.play('right', true);

            if (onGround && effectsManager) {
                this._runDustTimer += delta;
                if (this._runDustTimer > 120) {
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
            const jumpPower = this.activeBuffs.speed ? -380 : -330;
            sprite.setVelocityY(jumpPower);
        }
    }

    /**
     * Zadaj obrażenia graczowi.
     * @returns {boolean} true jeśli obrażenie zostało przyjęte (nie na cooldownie)
     */
    takeDamage(amount, effectsManager) {
        if (this._damageCooldown || this.activeBuffs.invincible) return false;

        this.hp -= amount;
        if (effectsManager) {
            effectsManager.flashOnPlayerHit(this.sprite.x, this.sprite.y);
            effectsManager.shakePlayerHurt();
        }

        // Mignięcie (invincibility frames: 1.5s)
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

    /**
     * Aplikuje chwilowy buff power-upa.
     * @param {{ type: string, duration: number }} buff
     */
    applyBuff(buff) {
        this.activeBuffs[buff.type] = true;

        // Wizualny wskaźnik aktywnego buffa
        if (buff.type === 'invincible') this.sprite.setTint(0x00ffff);
        if (buff.type === 'speed') this.sprite.setTint(0xffaa00);

        // Usuń buff po czasie
        this.scene.time.addEvent({
            delay: buff.duration,
            callback: () => {
                delete this.activeBuffs[buff.type];
                this.sprite.clearTint();
                // Przywróć skórkę ze sklepu jeśli była aktywna
                if (buff.onExpire) buff.onExpire();
            }
        });
    }

    isAlive() { return this.hp > 0; }

    destroy() {
        this.sprite.destroy();
    }
}
