/**
 * Herb — Magiczne Zioło.
 * Collectible kluczowy dla postępu poziomu (odblokowanie portalu).
 *
 * Tekstura generowana proceduralnie — zielony gradient + biały błysk.
 * Kompatybilność: Phaser 3.22+ (staticGroup, overlap).
 */
export class Herb {
    static _textureReady = false;

    /**
     * @param {Phaser.Scene} scene
     * @param {number} x
     * @param {number} y
     */
    constructor(scene, x, y) {
        this.scene = scene;
        this._collected = false;

        Herb._ensureTexture(scene);

        // Sprite fizyczny (statyczny — nie spada z platform)
        this.sprite = scene.physics.add.sprite(x, y, 'herb_tex');
        this.sprite.body.allowGravity = false;
        this.sprite.setDepth(5);
        this.sprite.setScale(1.2);

        // Etykieta emoji
        this.label = scene.add.text(x, y - 2, '🌿', {
            fontSize: '20px'
        }).setOrigin(0.5).setDepth(6);

        // Animacja bobowania
        this._bobTween = scene.tweens.add({
            targets: [this.sprite, this.label],
            y: { from: y, to: y - 12 },
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Efekt pulsowania koloru (lekka zmiana alpha)
        scene.tweens.add({
            targets: this.sprite,
            alpha: { from: 1, to: 0.75 },
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    static _ensureTexture(scene) {
        if (scene.textures.exists('herb_tex')) return;
        const g = scene.make.graphics({ x: 0, y: 0, add: false });
        // Zielone kółko z jaśniejszym środkiem
        g.fillStyle(0x55dd44, 1);
        g.fillCircle(16, 16, 16);
        g.fillStyle(0xaaffaa, 0.5);
        g.fillCircle(16, 16, 9);
        g.generateTexture('herb_tex', 32, 32);
        g.destroy();
    }

    get x() { return this.sprite.x; }
    get y() { return this.sprite.y; }

    /**
     * Zbierz zioło — iskry + animacja znikania.
     * @param {EffectsManager} effectsManager
     */
    collect(effectsManager) {
        if (this._collected) return;
        this._collected = true;

        // Zatrzymaj tween bobowania
        if (this._bobTween) this._bobTween.stop();

        // Efekt cząsteczek
        if (effectsManager) effectsManager.sparkOnCollect(this.sprite.x, this.sprite.y);

        // Animacja zebrania
        this.scene.tweens.add({
            targets: [this.sprite, this.label],
            scaleX: 2.2,
            scaleY: 2.2,
            alpha: 0,
            y: this.sprite.y - 30,
            duration: 350,
            ease: 'Back.easeOut',
            onComplete: () => this.destroy()
        });
    }

    isCollected() { return this._collected; }

    destroy() {
        if (this.sprite && this.sprite.active) this.sprite.destroy();
        if (this.label && this.label.active) this.label.destroy();
    }
}
