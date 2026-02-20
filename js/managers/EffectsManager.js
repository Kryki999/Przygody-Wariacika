/**
 * EffectsManager — globalny menedżer efektów cząsteczkowych i screen shake.
 * 
 * Particle textures generowane proceduralnie (brak potrzeby dodatkowych assetów),
 * lub z istniejącego star.png jeśli dostępny.
 */
export class EffectsManager {
    constructor(scene) {
        this.scene = scene;
        this._initParticleTextures();
        this._emitters = [];
    }

    /**
     * Generuje tekstury cząsteczek proceduralnie.
     */
    _initParticleTextures() {
        const scene = this.scene;

        // Mała biała cząsteczka (kurz, rozbłysk)
        if (!scene.textures.exists('fx_dot_white')) {
            const g = scene.make.graphics({ x: 0, y: 0, add: false });
            g.fillStyle(0xffffff, 1);
            g.fillCircle(4, 4, 4);
            g.generateTexture('fx_dot_white', 8, 8);
            g.destroy();
        }

        // Złota cząsteczka (zbieranie gwiazd)
        if (!scene.textures.exists('fx_dot_gold')) {
            const g = scene.make.graphics({ x: 0, y: 0, add: false });
            g.fillStyle(0xffd700, 1);
            g.fillCircle(5, 5, 5);
            g.generateTexture('fx_dot_gold', 10, 10);
            g.destroy();
        }

        // Pomarańczowa iskra (pokonanie wroga)
        if (!scene.textures.exists('fx_dot_spark')) {
            const g = scene.make.graphics({ x: 0, y: 0, add: false });
            g.fillStyle(0xff6b00, 1);
            g.fillCircle(3, 3, 3);
            g.generateTexture('fx_dot_spark', 6, 6);
            g.destroy();
        }
    }

    /**
     * Tworzy burst cząsteczek w miejscu i niszczy emitter po zakończeniu animacji.
     * Kompatybilne z Phaser 3.22 (createEmitter API).
     */
    _burst(x, y, textureKey, count, config = {}) {
        const {
            speedMin = 50,
            speedMax = 150,
            scale = { start: 1, end: 0 },
            alpha = { start: 1, end: 0 },
            lifespan = 500,
            gravityY = 100
        } = config;

        // Phaser 3.22 API: particles = manager, emitter = createEmitter()
        // explode(count, x, y) jest metodą EMITERA
        const particles = this.scene.add.particles(textureKey);
        const emitter = particles.createEmitter({
            speed: { min: speedMin, max: speedMax },
            angle: { min: 0, max: 360 },
            scale,
            alpha,
            lifespan,
            gravityY,
            on: false
        });

        emitter.explode(count, x, y);

        // Auto-cleanup po zakończeniu animacji
        this.scene.time.delayedCall(lifespan + 100, () => {
            particles.destroy();
        });
    }

    // ─────────────────────────────────────────
    // Publiczne API efektów
    // ─────────────────────────────────────────

    /** Kurz przy lądowaniu na ziemi */
    dustOnLand(x, y) {
        this._burst(x, y, 'fx_dot_white', 12, {
            speedMin: 30, speedMax: 80,
            scale: { start: 0.6, end: 0 },
            lifespan: 400,
            gravityY: -50  // kurz unosi się lekko w górę
        });
    }

    /** Drobny kurz przy biegu (ciągły — wywołuj co kilka klatek) */
    dustOnRun(x, y) {
        // Mały, jednorazowy burst
        this._burst(x, y + 10, 'fx_dot_white', 3, {
            speedMin: 10, speedMax: 40,
            scale: { start: 0.4, end: 0 },
            lifespan: 250,
            gravityY: 0
        });
    }

    /** Iskry/gwiazdki przy zbieraniu znajdziek */
    sparkOnCollect(x, y) {
        // Złote gwiazdki rozsypujące się dookoła
        this._burst(x, y, 'fx_dot_gold', 18, {
            speedMin: 80, speedMax: 200,
            scale: { start: 1.2, end: 0 },
            lifespan: 600,
            gravityY: 200
        });

        // Mniejszy biały rozbłysk pośrodku
        this._burst(x, y, 'fx_dot_white', 8, {
            speedMin: 20, speedMax: 60,
            scale: { start: 1.5, end: 0 },
            lifespan: 300,
            gravityY: 0
        });
    }

    /** Rozbłysk przy pokonaniu wroga */
    flashOnEnemyDefeat(x, y) {
        // Pomarańczowe iskry
        this._burst(x, y, 'fx_dot_spark', 20, {
            speedMin: 100, speedMax: 280,
            scale: { start: 1, end: 0 },
            lifespan: 700,
            gravityY: 300
        });

        // Biały rozbłysk centralny
        this._burst(x, y, 'fx_dot_white', 10, {
            speedMin: 50, speedMax: 120,
            scale: { start: 2, end: 0 },
            lifespan: 350,
            gravityY: 0
        });
    }

    /** Rozbłysk przy trafieniu gracza */
    flashOnPlayerHit(x, y) {
        this._burst(x, y, 'fx_dot_white', 15, {
            speedMin: 60, speedMax: 180,
            scale: { start: 1.5, end: 0 },
            lifespan: 500,
            gravityY: 50
        });
    }

    // ─────────────────────────────────────────
    // Screen Shake — wstrząsy kamery
    // ─────────────────────────────────────────

    /** Lekki wstrząs — twarde lądowanie */
    shakeLand() {
        this.scene.cameras.main.shake(120, 0.006);
    }

    /** Średni wstrząs — zadanie obrażeń wrogowi */
    shakeHitEnemy() {
        this.scene.cameras.main.shake(200, 0.012);
    }

    /** Mocny wstrząs — otrzymanie obrażeń przez gracza */
    shakePlayerHurt() {
        this.scene.cameras.main.shake(350, 0.025);
    }
}
