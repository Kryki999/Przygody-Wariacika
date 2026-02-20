/**
 * main.js — entry point Przygody Wariacika v1.0 (refaktor mobile-first)
 *
 * Zmiany:
 *   - Scale.RESIZE zamiast FIT → gra wypełnia cały ekran (brak czarnych pasków)
 *   - Dodana VictoryScene
 */
import { BootScene } from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';
import { ShopScene } from './scenes/ShopScene.js';
import { VictoryScene } from './scenes/VictoryScene.js';
import { OrientationOverlay } from './ui/OrientationOverlay.js';

// ─── Konfiguracja Phaser ───
const config = {
    type: Phaser.AUTO,

    // RESIZE — canvas zawsze równy rozmiarowi okna przeglądarki
    // Kamera GameScene używa setBounds do ograniczenia widoku mapy
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        // Punkt startowy (przed pierwszym resize); ScaleManager nadpisze przy starcie
        width: window.innerWidth,
        height: window.innerHeight,
    },

    backgroundColor: '#1a1a2e',

    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 320 },
            debug: false
        }
    },

    scene: [BootScene, PreloadScene, MenuScene, GameScene, UIScene, ShopScene, VictoryScene]
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
    game.events.emit('pwa:installable');
});

window.addEventListener('appinstalled', () => {
    console.log('[PWA] Gra zainstalowana!');
    _deferredInstallPrompt = null;
});

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
