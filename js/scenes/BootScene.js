import { SaveManager } from '../managers/SaveManager.js';
import { AudioManager } from '../managers/AudioManager.js';
import { ShopManager } from '../managers/ShopManager.js';

/**
 * BootScene — inicjalizuje globalne managery i przechodzi do PreloadScene.
 * Uruchamia się tylko raz przy starcie gry.
 */
export class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    create() {
        // Inicjalizacja SaveManager globalnie przez Phaser Registry
        const saveManager = new SaveManager();
        this.registry.set('saveManager', saveManager);

        // Inicjalizacja AudioManager (scena BootScene jako kontekst audio)
        const audioManager = new AudioManager(this, saveManager);
        this.registry.set('audioManager', audioManager);

        // Inicjalizacja ShopManager
        const shopManager = new ShopManager(saveManager);
        this.registry.set('shopManager', shopManager);

        // Przejście do ładowania assetów
        this.scene.start('PreloadScene');
    }
}
