/**
 * SaveManager — zarządza trwałym zapisem gry w localStorage.
 * Klucz: 'przygody_wariacika_save'
 */
export class SaveManager {
    static SAVE_KEY = 'przygody_wariacika_save';

    static DEFAULT_SAVE = {
        coins: 0,
        score: 0,
        unlockedLevels: [1],
        inventory: [],
        audioSettings: {
            musicMuted: false,
            sfxMuted: false
        }
    };

    constructor() {
        this.data = this.load();
    }

    load() {
        try {
            const raw = localStorage.getItem(SaveManager.SAVE_KEY);
            if (raw) {
                // Deep merge z defaultami — zabezpieczenie przed brakującymi kluczami
                return Object.assign({}, SaveManager.DEFAULT_SAVE, JSON.parse(raw));
            }
        } catch (e) {
            console.warn('[SaveManager] Błąd odczytu localStorage:', e);
        }
        return { ...SaveManager.DEFAULT_SAVE, audioSettings: { ...SaveManager.DEFAULT_SAVE.audioSettings } };
    }

    save() {
        try {
            localStorage.setItem(SaveManager.SAVE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.warn('[SaveManager] Błąd zapisu do localStorage:', e);
        }
    }

    get(key) {
        return this.data[key];
    }

    set(key, value) {
        this.data[key] = value;
        this.save();
    }

    addCoins(amount) {
        this.data.coins = (this.data.coins || 0) + amount;
        this.save();
    }

    spendCoins(amount) {
        if (this.data.coins < amount) return false;
        this.data.coins -= amount;
        this.save();
        return true;
    }

    unlockLevel(level) {
        if (!this.data.unlockedLevels.includes(level)) {
            this.data.unlockedLevels.push(level);
            this.save();
        }
    }

    addToInventory(itemId) {
        if (!this.data.inventory.includes(itemId)) {
            this.data.inventory.push(itemId);
            this.save();
        }
    }

    hasItem(itemId) {
        return this.data.inventory.includes(itemId);
    }

    setAudioSetting(key, value) {
        this.data.audioSettings[key] = value;
        this.save();
    }

    reset() {
        this.data = { ...SaveManager.DEFAULT_SAVE, audioSettings: { ...SaveManager.DEFAULT_SAVE.audioSettings } };
        this.save();
    }
}
