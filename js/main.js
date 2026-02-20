/**
 * main.js — entry point Przygody Wariacika v1.0
 * Importuje sceny jako ES6 moduły, konfiguruje Phaser z mobile-first scaling.
 */
import { BootScene } from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';
import { ShopScene } from './scenes/ShopScene.js';
import { OrientationOverlay } from './ui/OrientationOverlay.js';

// ─── Konfiguracja Phaser ───
const config = {
    type: Phaser.AUTO,

    // Phaser ScaleManager — responsywne wypełnienie ekranu
    scale: {
        mode: Phaser.Scale.FIT,       // dopasuj proporcjonalnie
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 800,
        height: 500,
        // Minimalny / maksymalny rozmiar (dla bardzo starych lub bardzo długich ekranów)
        min: { width: 320, height: 200 },
        max: { width: 1920, height: 1200 }
    },

    backgroundColor: '#1a1a2e',

    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 300 },
            debug: false
        }
    },

    // Lista scen — kolejność ważna: Boot uruchamia się jako pierwsza
    scene: [BootScene, PreloadScene, MenuScene, GameScene, UIScene, ShopScene]
};

// ─── Inicjalizacja gry ───
const game = new Phaser.Game(config);

// ─── Overlay orientacji (DOM — niezależny od Phasera) ───
const orientationOverlay = new OrientationOverlay(game);

// ─── PWA: Install Prompt ───
let _deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredInstallPrompt = e;
    console.log('[PWA] Gra gotowa do instalacji na ekranie głównym.');
    // Pokaż przycisk instalacji (np. w MenuScene przez Phaser Events)
    game.events.emit('pwa:installable');
});

window.addEventListener('appinstalled', () => {
    console.log('[PWA] Gra zainstalowana!');
    _deferredInstallPrompt = null;
});

// Eksportuj prompt instalacji — sceny mogą go użyć przez game.events
game.installPromptTrigger = () => {
    if (_deferredInstallPrompt) {
        _deferredInstallPrompt.prompt();
        _deferredInstallPrompt.userChoice.then(result => {
            console.log('[PWA] Wynik instalacji:', result.outcome);
            _deferredInstallPrompt = null;
        });
    }
};

export { game };
