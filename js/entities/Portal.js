/**
 * Portal — obiekt wyjścia z poziomu.
 *
 * Stany:
 *   inactive — szary, brak interakcji, tooltip "Zbierz zioła!"
 *   active   — świecący, rotujący, kwalifikuje się do nakładki z graczem
 *
 * Tekstura generowana proceduralnie.
 */
export class Portal {
    /**
     * @param {Phaser.Scene} scene
     * @param {number} x
     * @param {number} y
     */
    constructor(scene, x, y) {
        this.scene = scene;
        this._active = false;

        Portal._ensureTextures(scene);

        // Zewnętrzny pierścień (duży, obraca się gdy aktywny)
        this.ring = scene.add.image(x, y, 'portal_ring')
            .setDepth(4)
            .setAlpha(0.3)
            .setTint(0x888888);

        // Wewnętrzna kula (fizyczna dla overlap)
        this.sprite = scene.physics.add.sprite(x, y, 'portal_core');
        this.sprite.body.allowGravity = false;
        this.sprite.setImmovable(true);
        this.sprite.setDepth(5);
        this.sprite.setAlpha(0.25);
        this.sprite.setTint(0x888888);

        // Tekst pomocniczy
        this._hintText = scene.add.text(x, y - 52, '🔒 Zbierz\nzioła!', {
            fontSize: '13px',
            color: '#cccccc',
            fontFamily: 'Arial',
            align: 'center'
        }).setOrigin(0.5).setDepth(6).setAlpha(0.7);
    }

    static _ensureTextures(scene) {
        // Zewnętrzny pierścień
        if (!scene.textures.exists('portal_ring')) {
            const g = scene.make.graphics({ x: 0, y: 0, add: false });
            g.lineStyle(6, 0xffffff, 1);
            g.strokeCircle(36, 36, 34);
            g.lineStyle(3, 0xffffff, 0.5);
            g.strokeCircle(36, 36, 26);
            g.generateTexture('portal_ring', 72, 72);
            g.destroy();
        }
        // Rdzeń
        if (!scene.textures.exists('portal_core')) {
            const g = scene.make.graphics({ x: 0, y: 0, add: false });
            g.fillStyle(0xffffff, 1);
            g.fillCircle(22, 22, 22);
            g.generateTexture('portal_core', 44, 44);
            g.destroy();
        }
    }

    get x() { return this.sprite.x; }
    get y() { return this.sprite.y; }
    get isActive() { return this._active; }

    /**
     * Aktywuje portal — efekt wizualny + particles.
     */
    activate() {
        if (this._active) return;
        this._active = true;

        // Usuń podpowiedź blokady
        this.scene.tweens.add({
            targets: this._hintText,
            alpha: 0,
            duration: 300,
            onComplete: () => this._hintText.destroy()
        });

        // Odblokuj kolory
        this.ring.clearTint().setAlpha(1);
        this.sprite.clearTint().setAlpha(1);
        this.sprite.setTint(0x66ffdd);

        // Rotacja pierścienia
        this.scene.tweens.add({
            targets: this.ring,
            angle: 360,
            duration: 2500,
            repeat: -1,
            ease: 'Linear'
        });

        // Pulsacja rdzenia
        this.scene.tweens.add({
            targets: this.sprite,
            scaleX: 1.3,
            scaleY: 1.3,
            alpha: { from: 0.8, to: 1 },
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Pulsacja pierścienia (inna faza)
        this.scene.tweens.add({
            targets: this.ring,
            scaleX: 1.15,
            scaleY: 1.15,
            duration: 1100,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Tekst "PORTAL AKTYWNY!"
        const px = this.sprite.x;
        const py = this.sprite.y;
        const flashTxt = this.scene.add.text(px, py - 60, '✨ PORTAL\nAKTYWNY!', {
            fontSize: '16px',
            color: '#66ffdd',
            fontFamily: 'Arial Black',
            stroke: '#003322',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5).setDepth(10).setAlpha(0);

        this.scene.tweens.add({
            targets: flashTxt,
            alpha: 1,
            y: py - 80,
            duration: 600,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.scene.time.delayedCall(1200, () => {
                    this.scene.tweens.add({
                        targets: flashTxt,
                        alpha: 0,
                        duration: 400,
                        onComplete: () => flashTxt.destroy()
                    });
                });
            }
        });

        // Burst cząsteczek przy aktywacji
        this._burstActivation();
    }

    _burstActivation() {
        if (!this.scene.textures.exists('fx_dot_gold')) return;
        const particles = this.scene.add.particles('fx_dot_gold');
        const emitter = particles.createEmitter({
            speed: { min: 80, max: 220 },
            angle: { min: 0, max: 360 },
            scale: { start: 1.3, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 700,
            gravityY: 80,
            on: false
        });
        emitter.explode(30, this.sprite.x, this.sprite.y);
        this.scene.time.delayedCall(900, () => particles.destroy());
    }

    destroy() {
        if (this.ring) this.ring.destroy();
        if (this.sprite) this.sprite.destroy();
        if (this._hintText && this._hintText.active) this._hintText.destroy();
    }
}
