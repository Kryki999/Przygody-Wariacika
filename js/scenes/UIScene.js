/**
 * UIScene — overlay HUD przyklejony do kamery.
 * Uruchamiana równolegle z GameScene (scene.launch).
 *
 * Systemy:
 *   - Wynik (animacja +N)
 *   - Pierniki / waluta (🥨)
 *   - HP (serca ❤️ / 🖤)
 *   - Licznik ziół (🌿 0/5)
 *   - Wskaźnik portalu
 *   - Power-up badge
 *   - Combo HUD (mnożnik + gasnący pasek czasu)
 */
export class UIScene extends Phaser.Scene {
    constructor() {
        super({ key: 'UIScene' });
        this._score = 0;
        this._hp = 3;
        this._herbs = { collected: 0, total: 0 };
    }

    create() {
        this._buildUI();

        // Nasłuchuj eventów z GameScene
        const ge = this.game.events;
        ge.on('ui:score', this._onScore, this);
        ge.on('ui:coins', this._onCoins, this);
        ge.on('ui:hp', this._onHP, this);
        ge.on('ui:buff', this._onBuff, this);
        ge.on('ui:herbs', this._onHerbs, this);
        ge.on('ui:portal', this._onPortal, this);
        ge.on('ui:combo', this._onCombo, this);

        this.events.on('shutdown', () => {
            ge.off('ui:score', this._onScore, this);
            ge.off('ui:coins', this._onCoins, this);
            ge.off('ui:hp', this._onHP, this);
            ge.off('ui:buff', this._onBuff, this);
            ge.off('ui:herbs', this._onHerbs, this);
            ge.off('ui:portal', this._onPortal, this);
            ge.off('ui:combo', this._onCombo, this);
        });

        // Resize — repozycjonowanie HUD
        this.scale.on('resize', this._repositionUI, this);
        this.events.on('shutdown', () => this.scale.off('resize', this._repositionUI, this));
    }

    _buildUI() {
        const W = this.scale.width;
        const H = this.scale.height;

        // ─── Wynik ───
        this.scoreText = this.add.text(16, 16, 'Wynik: 0', {
            fontSize: '26px', color: '#ffffff', fontFamily: 'Arial Black, Arial',
            stroke: '#000000', strokeThickness: 4
        }).setScrollFactor(0).setDepth(200);

        // ─── Pierniki (waluta) ───
        this.coinText = this.add.text(16, 52, '🥨 0', {
            fontSize: '20px', color: '#ffd700', fontFamily: 'Arial',
            stroke: '#000', strokeThickness: 3
        }).setScrollFactor(0).setDepth(200);

        // ─── Licznik ziół — środek górny ───
        this._herbBar = this.add.text(W / 2, 14, '🌿 0/0', {
            fontSize: '24px', color: '#aaffaa', fontFamily: 'Arial Black',
            stroke: '#003300', strokeThickness: 4
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(200);

        // ─── HP serca — prawy górny róg ───
        this.hearts = [];
        for (let i = 0; i < 3; i++) {
            const heart = this.add.text(W - 14 - i * 34, 14, '❤️', {
                fontSize: '24px'
            }).setScrollFactor(0).setDepth(200);
            this.hearts.unshift(heart);
        }

        // ─── Fullscreen toggle ───
        // Sprawdź czy fullscreen jest w ogóle obsługiwany przez urządzenie (np. iOS Safari go NIE obsługuje na iPhonie)
        if (this.sys.game.device.fullscreen.available) {
            this.fsBtn = this.add.text(W - 14, 52,
                this.scale.isFullscreen ? '◳' : '⛶', {
                fontSize: '28px', color: '#ffffff',
                stroke: '#000000', strokeThickness: 4
            }).setOrigin(1, 0).setScrollFactor(0).setDepth(200).setInteractive({ useHandCursor: true });

            this.fsBtn.on('pointerdown', () => {
                if (this.scale.isFullscreen) {
                    this.scale.stopFullscreen();
                } else {
                    this.scale.startFullscreen();
                }
            });

            this.scale.on('enterfullscreen', () => this.fsBtn.setText('◳'));
            this.scale.on('leavefullscreen', () => this.fsBtn.setText('⛶'));
        } else {
            this.fsBtn = null; // Brak wsparcia
        }

        // ─── Wskaźnik power-upa ───
        this._buffBg = this.add.rectangle(W / 2, H * 0.15, 180, 38, 0x000000, 0.7)
            .setScrollFactor(0).setDepth(199).setAlpha(0);
        this._buffLabel = this.add.text(W / 2, H * 0.15, '', {
            fontSize: '18px', color: '#ffffff', fontFamily: 'Arial', stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(0);

        // ─── "PORTAL AKTYWNY!" flash ───
        this._portalFlash = this.add.text(W / 2, H * 0.12, '', {
            fontSize: '20px', color: '#66ffdd', fontFamily: 'Arial Black',
            stroke: '#003322', strokeThickness: 5, align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(0);

        // ─── Combo HUD ───
        // Mnożnik badge
        this._comboText = this.add.text(W / 2, H - 90, '', {
            fontSize: '32px', color: '#ffaa00', fontFamily: 'Arial Black',
            stroke: '#000', strokeThickness: 5
        }).setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(0);

        // Pasek czasu combo (tło + wypełnienie)
        this._comboBarBg = this.add.rectangle(W / 2, H - 58, 120, 8, 0x333333, 0.8)
            .setScrollFactor(0).setDepth(199).setAlpha(0);
        this._comboBarFill = this.add.rectangle(W / 2, H - 58, 120, 8, 0x00ff88, 1)
            .setScrollFactor(0).setDepth(200).setAlpha(0).setOrigin(0.5);
    }

    // ─────────────────────────────────────────
    // Resize
    // ─────────────────────────────────────────

    _repositionUI(gameSize) {
        if (!gameSize) return;
        const W = gameSize.width;
        const H = gameSize.height;

        if (this._herbBar) this._herbBar.setPosition(W / 2, 14);
        if (this._buffBg) this._buffBg.setPosition(W / 2, H * 0.15);
        if (this._buffLabel) this._buffLabel.setPosition(W / 2, H * 0.15);
        if (this._portalFlash) this._portalFlash.setPosition(W / 2, H * 0.12);

        // Serca i Fullscreen
        this.hearts.forEach((h, i) => {
            h.setPosition(W - 14 - i * 34, 14);
        });
        if (this.fsBtn) this.fsBtn.setPosition(W - 14, 52);

        // Combo HUD
        if (this._comboText) this._comboText.setPosition(W / 2, H - 90);
        if (this._comboBarBg) this._comboBarBg.setPosition(W / 2, H - 58);
        if (this._comboBarFill) this._comboBarFill.setPosition(W / 2, H - 58);
    }

    // ─────────────────────────────────────────
    // Event Handlers
    // ─────────────────────────────────────────

    _onScore(value) {
        const prev = this._score;
        this._score = value;
        this.scoreText.setText(`Wynik: ${value}`);

        const diff = value - prev;
        if (diff > 0) {
            const popup = this.add.text(
                this.scoreText.x + 130, this.scoreText.y,
                `+${diff}`,
                { fontSize: '22px', color: '#00ff88', fontFamily: 'Arial Black', stroke: '#000', strokeThickness: 3 }
            ).setScrollFactor(0).setDepth(201);

            this.tweens.add({
                targets: popup,
                y: popup.y - 50, alpha: 0,
                duration: 900, ease: 'Power2',
                onComplete: () => popup.destroy()
            });

            this.tweens.add({
                targets: this.scoreText,
                scaleX: 1.3, scaleY: 1.3,
                duration: 100, yoyo: true
            });
        }
    }

    _onCoins(value) {
        this.coinText.setText(`🥨 ${value}`);
        this.tweens.add({
            targets: this.coinText,
            scaleX: 1.4, scaleY: 1.4,
            duration: 120, yoyo: true
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

    _onHerbs({ collected, total }) {
        this._herbs = { collected, total };
        this._herbBar.setText(`🌿 ${collected}/${total}`);

        this.tweens.add({
            targets: this._herbBar,
            scaleX: 1.3, scaleY: 1.3,
            duration: 150, yoyo: true, ease: 'Back.easeOut'
        });

        if (collected >= total && total > 0) {
            this._herbBar.setColor('#55dd44');
        }
    }

    _onPortal(active) {
        if (!active) return;
        this._portalFlash.setText('✨ PORTAL AKTYWNY!\nIdź do portalu!');
        this._portalFlash.setAlpha(1);
        this._herbBar.setColor('#55dd44');

        this.tweens.add({
            targets: this._portalFlash,
            scaleX: 1.2, scaleY: 1.2,
            duration: 300, yoyo: true, ease: 'Back.easeOut',
            onComplete: () => {
                this.time.delayedCall(2500, () => {
                    this.tweens.add({
                        targets: this._portalFlash,
                        alpha: 0, duration: 600
                    });
                });
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
                duration: 150, yoyo: true, ease: 'Elastic'
            });
        } else {
            this.tweens.add({
                targets: [this._buffBg, this._buffLabel],
                alpha: 0, duration: 300
            });
        }
    }

    // ─────────────────────────────────────────
    // Combo HUD
    // ─────────────────────────────────────────

    _onCombo({ multiplier, timerRatio }) {
        if (multiplier <= 1) {
            // Combo nieaktywne lub x1 — ukryj
            if (this._comboText.alpha > 0) {
                this.tweens.add({
                    targets: [this._comboText, this._comboBarBg, this._comboBarFill],
                    alpha: 0, duration: 300
                });
            }
            return;
        }

        // Pokaż mnożnik
        this._comboText.setText(`x${multiplier}`);
        this._comboText.setAlpha(1);
        this._comboBarBg.setAlpha(0.8);
        this._comboBarFill.setAlpha(1);

        // Pasek gaśnie (szerokość = 120 * timerRatio)
        const barWidth = Math.max(2, 120 * timerRatio);
        this._comboBarFill.setSize(barWidth, 8);

        // Kolor: zielony → żółty → czerwony
        let color;
        if (timerRatio > 0.6) {
            color = 0x00ff88; // zielony
        } else if (timerRatio > 0.3) {
            color = 0xffdd00; // żółty
        } else {
            color = 0xff4444; // czerwony
        }
        this._comboBarFill.setFillStyle(color, 1);

        // Pulse na nowym combo
        if (multiplier >= 3 && !this._comboPulseDone) {
            this._comboPulseDone = true;
            this.tweens.add({
                targets: this._comboText,
                scaleX: 1.4, scaleY: 1.4,
                duration: 120, yoyo: true
            });
        }
        // Reset pulse flag gdy timer wysoki (nowy piernik)
        if (timerRatio > 0.95) {
            this._comboPulseDone = false;
        }
    }
}
