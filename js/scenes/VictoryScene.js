/**
 * VictoryScene — ekran zwycięstwa po ukończeniu poziomu.
 *
 * Dane wejściowe (przez scene.settings.data):
 *   score       — wynik
 *   herbsTotal  — łączna liczba zebranych ziół
 *   coins       — zebrane pierniki
 *   levelIndex  — indeks ukończonego poziomu
 */
export class VictoryScene extends Phaser.Scene {
    constructor() {
        super({ key: 'VictoryScene' });
    }

    init(data) {
        this.score = data.score || 0;
        this.herbsTotal = data.herbsTotal || 0;
        this.coins = data.coins || 0;
        this.levelIndex = data.levelIndex || 0;
    }

    create() {
        const W = this.scale.width;
        const H = this.scale.height;

        // ─── Tło ───
        this.add.rectangle(W / 2, H / 2, W, H, 0x0a1a0a).setDepth(0);

        // Cząsteczki confetti
        this._spawnConfetti(W, H);

        // ─── Panel ───
        const panW = Math.min(W * 0.85, 520);
        const panH = Math.min(H * 0.78, 420);
        const panel = this.add.rectangle(W / 2, H / 2, panW, panH, 0x0d2b0d, 0.95)
            .setStrokeStyle(3, 0x55dd44)
            .setDepth(1);

        // ─── Nagłówek ───
        const title = this.add.text(W / 2, H / 2 - panH / 2 + 36, '✅ POZIOM UKOŃCZONY!', {
            fontSize: this._fs(32, W),
            color: '#55dd44',
            fontFamily: 'Arial Black, Arial',
            stroke: '#003300',
            strokeThickness: 5,
            align: 'center'
        }).setOrigin(0.5).setDepth(2).setAlpha(0).setScale(0.6);

        this.tweens.add({
            targets: title,
            alpha: 1, scaleX: 1, scaleY: 1,
            duration: 500, ease: 'Back.easeOut', delay: 100
        });

        // ─── Statystyki ───
        const statsY = H / 2 - 40;
        const lineH = Math.min(44, H * 0.08);

        const stats = [
            { label: '🌿 Zioła zebrane:', value: `${this.herbsTotal}/${this.herbsTotal}` },
            { label: '🥨 Pierniki:', value: `${this.coins}` },
            { label: '⭐ Wynik:', value: `${this.score}` },
        ];

        stats.forEach((s, i) => {
            const y = statsY + i * lineH;

            const lbl = this.add.text(W / 2 - panW * 0.37, y, s.label, {
                fontSize: this._fs(20, W),
                color: '#aaccaa',
                fontFamily: 'Arial'
            }).setDepth(2).setAlpha(0);

            const val = this.add.text(W / 2 + panW * 0.25, y, s.value, {
                fontSize: this._fs(22, W),
                color: '#ffffff',
                fontFamily: 'Arial Black'
            }).setOrigin(1, 0).setDepth(2).setAlpha(0);

            this.tweens.add({
                targets: [lbl, val], alpha: 1,
                duration: 350, delay: 400 + i * 120
            });
        });

        // ─── Przyciski ───
        const btnY = H / 2 + panH / 2 - 60;

        // Następny poziom
        const nextBtn = this._makeButton(W / 2, btnY - 30, '▶ NASTĘPNY POZIOM', 0x55dd44);
        nextBtn.setAlpha(0);
        this.tweens.add({ targets: nextBtn, alpha: 1, duration: 400, delay: 900 });

        nextBtn.on('pointerdown', () => {
            this.scene.stop('UIScene');
            this.scene.start('GameScene', { levelIndex: this.levelIndex + 1 });
        });

        // Menu
        const menuBtn = this._makeButton(W / 2, btnY + 36, '🏠 MENU GŁÓWNE', 0x666666);
        menuBtn.setAlpha(0);
        this.tweens.add({ targets: menuBtn, alpha: 1, duration: 400, delay: 1050 });

        menuBtn.on('pointerdown', () => {
            this.scene.stop('UIScene');
            this.scene.start('MenuScene');
        });

        // Resize handler
        this.scale.on('resize', this._onResize, this);
        this.events.on('shutdown', () => this.scale.off('resize', this._onResize, this));
    }

    _makeButton(x, y, label, color) {
        const btn = this.add.text(x, y, label, {
            fontSize: this._fs(22, this.scale.width),
            color: '#ffffff',
            fontFamily: 'Arial Black',
            backgroundColor: Phaser.Display.Color.IntegerToColor(color).rgba,
            padding: { x: 22, y: 10 }
        }).setOrigin(0.5).setDepth(2).setScrollFactor(0)
            .setInteractive({ useHandCursor: true });

        btn.on('pointerover', () => btn.setAlpha(0.8));
        btn.on('pointerout', () => btn.setAlpha(1));
        return btn;
    }

    _spawnConfetti(W, H) {
        const colors = [0x55dd44, 0xffd700, 0xff6b6b, 0x66ffdd, 0xffffff];
        for (let i = 0; i < 60; i++) {
            const x = Phaser.Math.Between(0, W);
            const delay = Phaser.Math.Between(0, 800);
            const c = Phaser.Math.RND.pick(colors);

            const g = this.make.graphics({ x: 0, y: 0, add: false });
            g.fillStyle(c, 1);
            g.fillRect(0, 0, 8, 8);
            const key = `conf_${i}`;
            g.generateTexture(key, 8, 8);
            g.destroy();

            const piece = this.add.image(x, -20, key)
                .setDepth(3).setAlpha(0.9).setAngle(Phaser.Math.Between(0, 360));

            this.tweens.add({
                targets: piece,
                y: H + 40,
                x: x + Phaser.Math.Between(-80, 80),
                angle: piece.angle + Phaser.Math.Between(-200, 200),
                alpha: 0,
                duration: Phaser.Math.Between(2000, 3500),
                delay,
                ease: 'Sine.easeIn',
                onComplete: () => piece.destroy()
            });
        }
    }

    /** Pomocnik: skaluje font do szerokości ekranu */
    _fs(base, W) {
        return `${Math.max(14, Math.round(base * Math.min(W / 800, 1.2)))}px`;
    }

    _onResize() {
        // Restart sceny do przerysowania (prostsze niż dynamiczne repozycjonowanie)
        this.scene.restart({
            score: this.score,
            herbsTotal: this.herbsTotal,
            coins: this.coins,
            levelIndex: this.levelIndex
        });
    }
}
