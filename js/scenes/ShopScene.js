/**
 * ShopScene — sklep z przedmiotami. Używa ShopManager i SaveManager.
 */
export class ShopScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ShopScene' });
    }

    create() {
        const W = this.scale.width;
        const H = this.scale.height;
        const saveManager = this.registry.get('saveManager');
        const shopManager = this.registry.get('shopManager');

        // Tło
        this.add.rectangle(0, 0, W, H, 0x1a1a2e).setOrigin(0);

        // Tytuł wjazd z góry
        const title = this.add.text(W / 2, -50, '🛒 SKLEP', {
            fontSize: '38px', color: '#ffd700',
            fontFamily: 'Arial Black', stroke: '#000', strokeThickness: 5
        }).setOrigin(0.5);

        this.tweens.add({ targets: title, y: 48, duration: 500, ease: 'Back.easeOut' });

        // Saldo monet (aktualizowane po zakupie)
        let coins = saveManager.get('coins');
        const coinDisplay = this.add.text(W / 2, 88, `💰 Monety: ${coins}`, {
            fontSize: '22px', color: '#ffd700', fontFamily: 'Arial'
        }).setOrigin(0.5);

        // ─── Lista przedmiotów ───
        const items = shopManager.getItems();
        const startY = 145;
        const rowH = 78;

        items.forEach((item, i) => {
            const y = startY + i * rowH;
            const delay = 200 + i * 80;
            const owned = shopManager.isOwned(item.id);

            const card = this.add.rectangle(W / 2, y, W - 40, 66, owned ? 0x2d5a1b : 0x2c2c54, 0.95)
                .setStrokeStyle(1, owned ? 0x4caf50 : 0x7c7cff, 1)
                .setAlpha(0).setScale(0.9);

            const nameText = this.add.text(W / 2 - W * 0.37, y - 10, item.name, {
                fontSize: '17px', color: '#ffffff', fontFamily: 'Arial Black'
            }).setAlpha(0);

            const descText = this.add.text(W / 2 - W * 0.37, y + 12, item.description, {
                fontSize: '13px', color: '#aaaaaa', fontFamily: 'Arial'
            }).setAlpha(0);

            const statusText = owned
                ? this.add.text(W / 2 + W * 0.32, y, '✓ TWOJE', { fontSize: '16px', color: '#4caf50', fontFamily: 'Arial Black' }).setOrigin(1, 0.5).setAlpha(0)
                : this.add.text(W / 2 + W * 0.32, y, `💰 ${item.cost}`, { fontSize: '18px', color: '#ffd700', fontFamily: 'Arial Black' }).setOrigin(1, 0.5).setAlpha(0);

            // Animacja wjazdu (stagger)
            this.tweens.add({
                targets: [card, nameText, descText, statusText],
                alpha: 1,
                scaleX: 1,
                scaleY: 1,
                duration: 350,
                delay,
                ease: 'Back.easeOut'
            });

            // Klik na kartę (zakup)
            if (!owned) {
                card.setInteractive({ useHandCursor: true });

                card.on('pointerover', () => {
                    this.tweens.add({ targets: card, scaleX: 1.02, scaleY: 1.02, duration: 80 });
                });
                card.on('pointerout', () => {
                    this.tweens.add({ targets: card, scaleX: 1, scaleY: 1, duration: 80 });
                });

                card.on('pointerdown', () => {
                    const result = shopManager.purchase(item.id);
                    if (result.success) {
                        coins = saveManager.get('coins');
                        coinDisplay.setText(`💰 Monety: ${coins}`);

                        // Feedback sukcesu
                        card.setFillStyle(0x2d5a1b).setStrokeStyle(1, 0x4caf50);
                        statusText.setText('✓ TWOJE').setColor('#4caf50');
                        card.disableInteractive();

                        this.tweens.add({
                            targets: [card, nameText, descText, statusText],
                            scaleX: 1.05, scaleY: 1.05,
                            duration: 150,
                            yoyo: true
                        });

                        // Pulsowanie salda
                        this.tweens.add({ targets: coinDisplay, scaleX: 1.3, scaleY: 1.3, duration: 150, yoyo: true });

                    } else {
                        // Feedback błędu — potrząśnięcie karty
                        this.tweens.add({
                            targets: card,
                            x: card.x + 8,
                            duration: 60,
                            yoyo: true,
                            repeat: 3,
                            onComplete: () => { card.x = W / 2; }
                        });

                        const errMsg = this.add.text(W / 2, H - 60, result.reason, {
                            fontSize: '16px', color: '#ff6b6b', fontFamily: 'Arial'
                        }).setOrigin(0.5).setDepth(10);
                        this.tweens.add({ targets: errMsg, alpha: 0, duration: 1500, delay: 600, onComplete: () => errMsg.destroy() });
                    }
                });
            }
        });

        // ─── Przycisk powrotu ───
        const backBtn = this.add.text(W / 2, H - 32, '← POWRÓT DO MENU', {
            fontSize: '20px', color: '#ffffff', fontFamily: 'Arial',
            backgroundColor: '#333333',
            padding: { x: 16, y: 8 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setAlpha(0);

        this.tweens.add({ targets: backBtn, alpha: 1, duration: 400, delay: 600 });

        backBtn.on('pointerover', () => backBtn.setColor('#ffd700'));
        backBtn.on('pointerout', () => backBtn.setColor('#ffffff'));
        backBtn.on('pointerdown', () => this.scene.start('MenuScene'));
    }
}
