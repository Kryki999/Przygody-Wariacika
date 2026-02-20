/**
 * OrientationOverlay — DOM-based overlay wymuszający orientację landscape.
 * Działa niezależnie od silnika Phaser (manipuluje DOMem bezpośrednio).
 * 
 * Użycie: new OrientationOverlay(game)
 */
export class OrientationOverlay {
    constructor(game) {
        this.game = game;
        this._overlay = null;
        this._create();
        this._checkOrientation();
        window.addEventListener('orientationchange', () => this._checkOrientation());
        window.addEventListener('resize', () => this._checkOrientation());
    }

    _create() {
        const div = document.createElement('div');
        div.id = 'orientation-overlay';
        div.style.cssText = `
            display: none;
            position: fixed;
            top: 0; left: 0;
            width: 100vw; height: 100vh;
            background: #1a1a2e;
            z-index: 99999;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: white;
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 24px;
            box-sizing: border-box;
        `;

        div.innerHTML = `
            <div style="font-size: 72px; animation: spin 2s linear infinite;">📱</div>
            <h2 style="margin: 24px 0 12px; font-size: 26px; color: #ffd700;">Obróć urządzenie</h2>
            <p style="font-size: 16px; color: #aaaaaa; max-width: 280px; line-height: 1.5;">
                Przygody Wariacika działa<br>
                <strong>wyłącznie w trybie poziomym</strong> 🎮
            </p>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    50% { transform: rotate(-90deg); }
                    100% { transform: rotate(-90deg); }
                }
            </style>
        `;

        document.body.appendChild(div);
        this._overlay = div;
    }

    _checkOrientation() {
        const isPortrait = window.innerHeight > window.innerWidth;

        if (isPortrait) {
            this._overlay.style.display = 'flex';
            // Pauzuj pierwszą aktywną scenę gry
            if (this.game && this.game.scene) {
                const gameScene = this.game.scene.getScene('GameScene');
                if (gameScene && gameScene.scene.isActive()) {
                    gameScene.scene.pause();
                }
            }
        } else {
            this._overlay.style.display = 'none';
            // Wznów scenę gry
            if (this.game && this.game.scene) {
                const gameScene = this.game.scene.getScene('GameScene');
                if (gameScene && gameScene.scene.isPaused()) {
                    gameScene.scene.resume();
                }
            }
        }
    }

    destroy() {
        window.removeEventListener('orientationchange', this._checkOrientation);
        window.removeEventListener('resize', this._checkOrientation);
        if (this._overlay) this._overlay.remove();
    }
}
