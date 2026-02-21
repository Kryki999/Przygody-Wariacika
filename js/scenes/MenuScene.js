/**
 * MenuScene — ekran głównego menu z animowanymi elementami.
 */
export class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        const W = this.scale.width;
        const H = this.scale.height;
        const saveManager = this.registry.get('saveManager');

        // ─── Tło ───
        this.add.image(W / 2, H / 2, 'sky');

        // ─── Tytuł — animacja wjazdu z góry ───
        const title = this.add.text(W / 2, -80, 'Przygody Wariacika', {
            fontSize: '42px',
            color: '#ffffff',
            fontFamily: 'Arial Black, Arial',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        this.tweens.add({
            targets: title,
            y: H * 0.22,
            duration: 700,
            ease: 'Bounce.easeOut'
        });

        // Podtytuł
        const sub = this.add.text(W / 2, H * 0.33, 'Wersja 1.0', {
            fontSize: '18px', color: '#ffdd57', fontFamily: 'Arial'
        }).setOrigin(0.5).setAlpha(0);

        this.tweens.add({
            targets: sub,
            alpha: 1,
            duration: 500,
            delay: 600
        });

        // Monety
        const coins = saveManager ? saveManager.get('coins') : 0;
        const coinText = this.add.text(W - 16, 16, `💰 ${coins}`, {
            fontSize: '22px', color: '#ffd700', fontFamily: 'Arial'
        }).setOrigin(1, 0);

        // ─── Przyciski menu ───
        const buttons = [
            { label: '▶  GRAJ', key: 'GameScene' },
            { label: '🛒 SKLEP', key: 'ShopScene' },
            { label: '🔄 RESET DANYCH', key: 'reset' }
        ];

        buttons.forEach((btn, i) => {
            const delay = 400 + i * 120;
            const bY = H * 0.52 + i * 70;

            const bg = this.add.rectangle(W / 2, bY, 280, 50, 0x000000, 0.6)
                .setStrokeStyle(2, 0xffffff, 0.8)
                .setInteractive({ useHandCursor: true })
                .setScale(0)
                .setAlpha(0);

            const txt = this.add.text(W / 2, bY, btn.label, {
                fontSize: '22px', color: '#ffffff', fontFamily: 'Arial'
            }).setOrigin(0.5).setAlpha(0);

            // Animacja wjazdu (stagger)
            this.tweens.add({
                targets: [bg, txt],
                scaleX: 1, scaleY: 1,
                alpha: 1,
                duration: 400,
                delay,
                ease: 'Back.easeOut'
            });

            // Hover
            bg.on('pointerover', () => {
                this.tweens.add({ targets: [bg, txt], scaleX: 1.06, scaleY: 1.06, duration: 100 });
            });
            bg.on('pointerout', () => {
                this.tweens.add({ targets: [bg, txt], scaleX: 1, scaleY: 1, duration: 100 });
            });

            // Klik
            bg.on('pointerdown', () => {
                if (btn.key === 'reset') {
                    if (saveManager) saveManager.reset();
                    coinText.setText(`💰 0`);
                    // Animuj potwierdzenie
                    const msg = this.add.text(W / 2, H * 0.88, 'Dane zresetowane!', {
                        fontSize: '18px', color: '#ff6b6b', fontFamily: 'Arial'
                    }).setOrigin(0.5);
                    this.tweens.add({ targets: msg, alpha: 0, duration: 1500, delay: 800, onComplete: () => msg.destroy() });
                } else {
                    this.scene.start(btn.key);
                }
            });
        });

        // ─── Audio toggle ───
        const audioManager = this.registry.get('audioManager');
        if (audioManager) {
            const muteBtn = this.add.text(16, 16,
                audioManager.isMusicMuted() ? '🔇' : '🔊', {
                fontSize: '26px'
            }).setInteractive({ useHandCursor: true });

            muteBtn.on('pointerdown', () => {
                const muted = audioManager.toggleMusicMute();
                muteBtn.setText(muted ? '🔇' : '🔊');
            });
        }

        // ─── Fullscreen toggle ───
        if (this.sys.game.device.fullscreen.available) {
            const fsBtn = this.add.text(W - 16, 16,
                this.scale.isFullscreen ? '◳' : '⛶', {
                fontSize: '26px'
            }).setOrigin(1, 0).setInteractive({ useHandCursor: true });

            fsBtn.on('pointerdown', () => {
                if (this.scale.isFullscreen) {
                    this.scale.stopFullscreen();
                } else {
                    this.scale.startFullscreen();
                }
            });

            // Nasłuchuj zmian trybu fullscreen (np. wyjście z menu przeglądarki) by odświeżyć ikonę
            this.scale.on('enterfullscreen', () => fsBtn.setText('◳'));
            this.scale.on('leavefullscreen', () => fsBtn.setText('⛶'));
        }
    }
}
