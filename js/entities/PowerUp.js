/**
 * PowerUp — collectible dający graczowi chwilowy buff.
 * Typy: 'speed' (zwiększona prędkość), 'invincible' (nieśmiertelność)
 */
export class PowerUp {
    static CONFIGS = {
        speed: {
            color: 0xffaa00,
            label: '⚡',
            duration: 5000,  // ms
            type: 'speed'
        },
        invincible: {
            color: 0x00ffff,
            label: '★',
            duration: 4000,
            type: 'invincible'
        }
    };

    /**
     * @param {Phaser.Scene} scene
     * @param {number} x
     * @param {number} y
     * @param {'speed'|'invincible'} type
     */
    constructor(scene, x, y, type = 'speed') {
        this.scene = scene;
        this.type = type;
        this._collected = false;

        const cfg = PowerUp.CONFIGS[type] || PowerUp.CONFIGS.speed;

        // Stwórz sprite jako kolorowy okrąg z etykietą
        const g = scene.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(cfg.color, 1);
        g.fillCircle(16, 16, 16);
        g.generateTexture(`powerup_${type}`, 32, 32);
        g.destroy();

        this.sprite = scene.physics.add.sprite(x, y, `powerup_${type}`);
        this.sprite.body.allowGravity = false;
        this.sprite.setDepth(5);

        // Etykieta tekstu
        this.label = scene.add.text(x, y, cfg.label, {
            fontSize: '18px', color: '#fff'
        }).setOrigin(0.5).setDepth(6).setScrollFactor(1);

        // Animacja bobowania
        scene.tweens.add({
            targets: [this.sprite, this.label],
            y: y - 10,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Efekt pulsowania (scale)
        scene.tweens.add({
            targets: this.sprite,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this._cfg = cfg;
    }

    get x() { return this.sprite.x; }
    get y() { return this.sprite.y; }

    /**
     * Zastosuj power-upa na graczu. Wywołaj z handlera nakładki.
     * @param {Player} player
     * @param {EffectsManager} effectsManager
     */
    collect(player, effectsManager) {
        if (this._collected) return;
        this._collected = true;

        if (effectsManager) effectsManager.sparkOnCollect(this.sprite.x, this.sprite.y);

        player.applyBuff({
            type: this._cfg.type,
            duration: this._cfg.duration,
            onExpire: () => {
                // Można dodać callback po wygaśnięciu buffa
            }
        });

        // Animacja zbierania (scale-up → znikanie)
        this.scene.tweens.add({
            targets: [this.sprite, this.label],
            scaleX: 2,
            scaleY: 2,
            alpha: 0,
            duration: 300,
            onComplete: () => this.destroy()
        });
    }

    isCollected() { return this._collected; }

    destroy() {
        if (this.sprite) this.sprite.destroy();
        if (this.label) this.label.destroy();
    }
}
