/**
 * main.js — entry point Przygody Wariacika v1.0 (refaktor mobile-first)
 *
 * Zmiany:
 *   - Scale.RESIZE zamiast FIT → gra wypełnia cały ekran (brak czarnych pasków)
 *   - Dodana VictoryScene
 */
import { TapToStartScene } from './scenes/TapToStartScene.js';
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
    parent: 'game-container',

    // RESIZE — canvas dostosowuje się do rodzica (game-container),
    // a game-container zarządza wcięciami na notcha (safe area) z poziomu CSS.
    scale: {
        mode: Phaser.Scale.RESIZE,
        parent: 'game-container',
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: '100%',
        height: '100%',
    },

    backgroundColor: '#1a1a2e',

    physics: {
        default: 'arcade',
        arcade: {
            // RETRO PHYSICS: 4× większa grawitacja — postac jest ciężka i szybko spada.
            // Skok wyrównany wysoką prędkością w Player.js.
            gravity: { y: 1200 },
            debug: false
        }
    },

    scene: [TapToStartScene, BootScene, PreloadScene, MenuScene, GameScene, UIScene, ShopScene, VictoryScene]
};

// ─── Inicjalizacja gry ───
const game = new Phaser.Game(config);

// ─── Overlay orientacji (DOM — niezależny od Phasera) ───
const orientationOverlay = new OrientationOverlay(game);

/**
 * orientationchange DEBOUNCE
 * Przeglądarki mobilne opuszczają zdarzenie zmiany rozmiaru okna z opóźnieniem
 * po obrocie ekranu (pasek adresu chowa się, viewport się zmienia).
 * Czekamy 250ms, żeby dokładne wymiary były już dostępne,
 * a następnie wymuszamy na Phaserze ponowne przeliczenie canvasa.
 */
let _orientationTimer = null;
window.addEventListener('orientationchange', () => {
    clearTimeout(_orientationTimer);
    _orientationTimer = setTimeout(() => {
        // Wymuś Phasera do odczytu aktualnego window.innerWidth/innerHeight
        game.scale.refresh();
        // Również bezpośrednio ustaw rozmiar na bieżący rozmiar okna
        game.scale.resize(window.innerWidth, window.innerHeight);
    }, 250);
});

// Dodatkowe zabezpieczenie: reaguj również na zwykły resize (przeglądarka desktop)
window.addEventListener('resize', () => {
    clearTimeout(_orientationTimer);
    _orientationTimer = setTimeout(() => {
        game.scale.refresh();
    }, 100);
});

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
