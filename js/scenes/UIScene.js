/**
 * UIScene — overlay HUD przyklejony do kamery.
 * Uruchamiana równolegle z GameScene (scene.launch).
 */
export class UIScene extends Phaser.Scene {
    constructor() {
        super({ key: 'UIScene' });

        this._score = 0;
        this._hp = 3;
        this._maxHP = 3;
        this._buffLabel = null;
    }

    create() {
        const W = this.scale.width;

        // ─── Score ───
        this.scoreText = this.add.text(16, 16, 'Score: 0', {
            fontSize: '28px',
            color: '#ffffff',
            fontFamily: 'Arial Black, Arial',
            stroke: '#000000',
            strokeThickness: 4
        }).setScrollFactor(0).setDepth(200);

        // ─── Monety ───
        this.coinText = this.add.text(16, 52, '💰 0', {
            fontSize: '20px', color: '#ffd700', fontFamily: 'Arial'
        }).setScrollFactor(0).setDepth(200);

        // ─── HP serca ───
        this.hearts = [];
        for (let i = 0; i < 3; i++) {
            const heart = this.add.text(W - 30 - i * 32, 16, '❤️', {
                fontSize: '24px'
            }).setScrollFactor(0).setDepth(200);
            this.hearts.unshift(heart); // od lewej = HP[0]
        }

        // ─── Wskaźnik power-upa ───
        this._buffBg = this.add.rectangle(W / 2, 24, 160, 36, 0x000000, 0.7)
            .setScrollFactor(0)
            .setDepth(199)
            .setAlpha(0);

        this._buffLabel = this.add.text(W / 2, 24, '', {
            fontSize: '18px', color: '#ffffff', fontFamily: 'Arial'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(0);

        // ─── Nasłuchuj eventów z GameScene ───
        const gameEvents = this.game.events;

        gameEvents.on('ui:score', this._onScore, this);
        gameEvents.on('ui:coins', this._onCoins, this);
        gameEvents.on('ui:hp', this._onHP, this);
        gameEvents.on('ui:buff', this._onBuff, this);

        this.events.on('shutdown', () => {
            gameEvents.off('ui:score', this._onScore, this);
            gameEvents.off('ui:coins', this._onCoins, this);
            gameEvents.off('ui:hp', this._onHP, this);
            gameEvents.off('ui:buff', this._onBuff, this);
        });
    }

    // ─── Handlers eventów ───

    _onScore(value) {
        const prev = this._score;
        this._score = value;
        this.scoreText.setText(`Score: ${value}`);

        // Wyskakujący tekst +10!
        const diff = value - prev;
        if (diff > 0) {
            const popup = this.add.text(
                this.scoreText.x + 130,
                this.scoreText.y,
                `+${diff}`,
                { fontSize: '22px', color: '#00ff88', fontFamily: 'Arial Black', stroke: '#000', strokeThickness: 3 }
            ).setScrollFactor(0).setDepth(201);

            this.tweens.add({
                targets: popup,
                y: popup.y - 50,
                alpha: 0,
                duration: 900,
                ease: 'Power2',
                onComplete: () => popup.destroy()
            });

            // Pulsowanie score tekstu
            this.tweens.add({
                targets: this.scoreText,
                scaleX: 1.3,
                scaleY: 1.3,
                duration: 100,
                yoyo: true
            });
        }
    }

    _onCoins(value) {
        this.coinText.setText(`💰 ${value}`);
        this.tweens.add({
            targets: this.coinText,
            scaleX: 1.4,
            scaleY: 1.4,
            duration: 120,
            yoyo: true
        });
    }

    _onHP(value) {
        this._hp = value;
        this.hearts.forEach((h, i) => {
            const alive = i < value;
            h.setText(alive ? '❤️' : '🖤');
            if (!alive) {
                this.tweens.add({ targets: h, scaleX: 0.7, scaleY: 0.7, duration: 200, yoyo: true });
            }
        });
    }

    _onBuff({ label, active }) {
        if (active) {
            this._buffLabel.setText(label);
            this._buffBg.setAlpha(0.7);
            this._buffLabel.setAlpha(1);
            this.tweens.add({
                targets: [this._buffBg, this._buffLabel],
                scaleX: 1.15, scaleY: 1.15,
                duration: 150,
                yoyo: true,
                ease: 'Elastic'
            });
        } else {
            this.tweens.add({
                targets: [this._buffBg, this._buffLabel],
                alpha: 0,
                duration: 300
            });
        }
    }
}
