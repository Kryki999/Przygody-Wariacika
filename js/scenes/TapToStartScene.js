/**
 * TapToStartScene — ekran inicjujący z żądaniem Fullscreen API.
 *
 * Przeglądarki mobilne blokują automatyczny tryb pełnoekranowy —
 * wymuszamy go pod zdarzenie pointerdown (gesture-gated).
 * Po tapnięciu: fullscreen → przejście do BootScene.
 */
export class TapToStartScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TapToStartScene' });
    }

    create() {
        const W = this.scale.width;
        const H = this.scale.height;

        // ─── Tło ───
        this.add.rectangle(W / 2, H / 2, W * 2, H * 2, 0x1a1a2e);

        // ─── Tytuł ───
        this.add.text(W / 2, H * 0.32, 'Przygody Wariacika', {
            fontSize: '38px',
            color: '#ffffff',
            fontFamily: 'Arial Black, Arial',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        // ─── Pulsujący napis ───
        const tapText = this.add.text(W / 2, H * 0.58, '👆 DOTKNIJ ABY ROZPOCZĄĆ', {
            fontSize: '24px',
            color: '#00ff88',
            fontFamily: 'Arial Black, Arial',
            stroke: '#003311',
            strokeThickness: 4
        }).setOrigin(0.5);

        this.tweens.add({
            targets: tapText,
            alpha: 0.3,
            scaleX: 1.06,
            scaleY: 1.06,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // ─── Podpis ───
        this.add.text(W / 2, H * 0.82, 'Rycerz z Torunia', {
            fontSize: '16px',
            color: '#ffdd57',
            fontFamily: 'Arial'
        }).setOrigin(0.5).setAlpha(0.7);

        // ─── Kliknięcie / tapnięcie → Fullscreen + start ───
        this.input.once('pointerdown', () => {
            this._requestFullscreen();
            this.cameras.main.fadeOut(400, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.start('BootScene');
            });
        });

        // ─── Resize ───
        this.scale.on('resize', (gameSize) => {
            // Nie repozycjonujemy — scena jest jednorazowa, krótkotrwała
        });
    }

    /**
     * Żądanie natywnego trybu pełnoekranowego (vendor-prefixed).
     * Nie blokujemy gry jeśli się nie powiedzie (np. desktop / iframe).
     */
    _requestFullscreen() {
        const el = document.documentElement;
        const rfs = el.requestFullscreen
            || el.webkitRequestFullscreen
            || el.mozRequestFullScreen
            || el.msRequestFullscreen;

        if (rfs) {
            rfs.call(el).catch(() => {
                // Niektóre przeglądarki / iframes blokują — ignorujemy
                console.log('[Fullscreen] Nie udało się wejść w fullscreen — kontynuujemy.');
            });
        }
    }
}
