/**
 * ShopManager — logika sklepu i katalog przedmiotów.
 * Sprawdza saldo, potrąca walutę, aktualizuje ekwipunek, zapisuje stan.
 */

export const SHOP_ITEMS = [
    {
        id: 'skin_blue',
        name: 'Niebieska Skórka',
        description: 'Wariacik w odcieniu błękitu',
        cost: 30,
        type: 'skin',
        effect: { tint: 0x4fc3f7 }
    },
    {
        id: 'skin_green',
        name: 'Zielona Skórka',
        description: 'Wariacik w odcieniu zieleni',
        cost: 30,
        type: 'skin',
        effect: { tint: 0x81c784 }
    },
    {
        id: 'skin_gold',
        name: 'Złota Skórka',
        description: 'Prestiżowa złota wersja',
        cost: 100,
        type: 'skin',
        effect: { tint: 0xffd54f }
    },
    {
        id: 'stat_hp',
        name: '+1 Maksymalne Życie',
        description: 'Zwiększa maksymalne HP o 1',
        cost: 50,
        type: 'stat',
        effect: { stat: 'maxHP', value: 1 }
    },
    {
        id: 'stat_speed',
        name: '+Szybkość Ruchu',
        description: 'Stała premia do prędkości biegu',
        cost: 40,
        type: 'stat',
        effect: { stat: 'speed', value: 20 }
    }
];

export class ShopManager {
    constructor(saveManager) {
        this.saveManager = saveManager;
    }

    getItems() {
        return SHOP_ITEMS;
    }

    isOwned(itemId) {
        return this.saveManager.hasItem(itemId);
    }

    /**
     * Próba zakupu przedmiotu.
     * @returns {{ success: boolean, reason: string | null }}
     */
    purchase(itemId) {
        const item = SHOP_ITEMS.find(i => i.id === itemId);
        if (!item) return { success: false, reason: 'Nieznany przedmiot.' };
        if (this.isOwned(itemId)) return { success: false, reason: 'Już posiadasz ten przedmiot.' };

        const currentCoins = this.saveManager.get('coins');
        if (currentCoins < item.cost) {
            return { success: false, reason: `Za mało monet. Potrzebujesz ${item.cost}, masz ${currentCoins}.` };
        }

        this.saveManager.spendCoins(item.cost);
        this.saveManager.addToInventory(itemId);
        // saveManager.save() jest wywoływany automatycznie przez addToInventory i spendCoins

        return { success: true, reason: null };
    }

    /**
     * Zwraca aktywne ulepszenia statystyk z ekwipunku gracza.
     */
    getActiveStatBoosts() {
        const inventory = this.saveManager.get('inventory') || [];
        return SHOP_ITEMS.filter(item => item.type === 'stat' && inventory.includes(item.id));
    }

    /**
     * Zwraca aktywną skórkę (ostatnia kupiona).
     */
    getActiveSkin() {
        const inventory = this.saveManager.get('inventory') || [];
        const ownedSkins = SHOP_ITEMS.filter(item => item.type === 'skin' && inventory.includes(item.id));
        return ownedSkins.length > 0 ? ownedSkins[ownedSkins.length - 1] : null;
    }
}
