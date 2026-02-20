/**
 * levels.js — data-driven konfiguracja poziomów.
 *
 * Każdy poziom to obiekt z:
 *   mapWidth   — szerokość świata (px)
 *   mapHeight  — wysokość świata (px)
 *   background — klucz tekstury tła
 *   platforms  — tablica { x, y, key, scaleX? }
 *   herbs      — tablica { x, y }  (Magiczne Zioła — klucze do portalu)
 *   portal     — { x, y }
 *   pierniki   — tablica { x, y }  (waluta — brak wpływu na portal)
 *   enemies    — tablica { x, y, type, speed?, hp?, patrolDistance?, aggroRange?, bulletInterval? }
 */

export const LEVELS = [
    // ─── Poziom 1 — Lasy Torunia ───
    {
        mapWidth: 2400,
        mapHeight: 600,
        background: 'sky',

        platforms: [
            // Ziemia (pełna szerokość mapy, wielokrotność tile'a ground.png ~400px)
            { x: 200, y: 568, key: 'ground', scaleX: 2 },
            { x: 600, y: 568, key: 'ground', scaleX: 2 },
            { x: 1000, y: 568, key: 'ground', scaleX: 2 },
            { x: 1400, y: 568, key: 'ground', scaleX: 2 },
            { x: 1800, y: 568, key: 'ground', scaleX: 2 },
            { x: 2200, y: 568, key: 'ground', scaleX: 2 },

            // Platformy pośrednie
            { x: 300, y: 430, key: 'ground' },
            { x: 600, y: 330, key: 'ground' },
            { x: 900, y: 430, key: 'ground' },
            { x: 1100, y: 310, key: 'ground' },
            { x: 1350, y: 420, key: 'ground' },
            { x: 1600, y: 300, key: 'ground' },
            { x: 1850, y: 420, key: 'ground' },
            { x: 2050, y: 310, key: 'ground' },
            { x: 2250, y: 430, key: 'ground' },
        ],

        herbs: [
            { x: 305, y: 390 },
            { x: 600, y: 290 },
            { x: 1100, y: 270 },
            { x: 1600, y: 260 },
            { x: 2250, y: 390 },
        ],

        portal: { x: 2350, y: 500 },

        pierniki: [
            { x: 150, y: 520 },
            { x: 450, y: 520 },
            { x: 750, y: 520 },
            { x: 900, y: 390 },
            { x: 1050, y: 520 },
            { x: 1250, y: 380 },
            { x: 1450, y: 520 },
            { x: 1700, y: 260 },
            { x: 1900, y: 380 },
            { x: 2100, y: 270 },
        ],

        enemies: [
            // Patrulujący na ziemi
            { x: 500, y: 540, type: 'patrol', speed: 65, hp: 1 },
            { x: 1000, y: 540, type: 'patrol', speed: 65, hp: 1 },
            { x: 1700, y: 540, type: 'patrol', speed: 70, hp: 1 },

            // Patrulujący na platformach
            { x: 600, y: 300, type: 'patrol', speed: 60, hp: 1 },
            { x: 1350, y: 390, type: 'patrol', speed: 60, hp: 1 },
            { x: 2050, y: 280, type: 'patrol', speed: 60, hp: 1 },

            // Goniący
            { x: 1200, y: 540, type: 'chaser', speed: 90, hp: 2, aggroRange: 250 },
            { x: 1950, y: 540, type: 'chaser', speed: 90, hp: 2, aggroRange: 250 },

            // Latający + strzelający
            { x: 800, y: 180, type: 'flying', speed: 55, hp: 2, bulletInterval: 2500 },
            { x: 1700, y: 180, type: 'flying', speed: 55, hp: 2, bulletInterval: 2500 },
        ]
    },

    // ─── Poziom 2 — Wieże Zamku (szkielet — do uzupełnienia) ───
    {
        mapWidth: 2800,
        mapHeight: 600,
        background: 'sky',

        platforms: [
            { x: 200, y: 568, key: 'ground', scaleX: 2 },
            { x: 600, y: 568, key: 'ground', scaleX: 2 },
            { x: 1000, y: 568, key: 'ground', scaleX: 2 },
            { x: 1400, y: 568, key: 'ground', scaleX: 2 },
            { x: 1800, y: 568, key: 'ground', scaleX: 2 },
            { x: 2200, y: 568, key: 'ground', scaleX: 2 },
            { x: 2600, y: 568, key: 'ground', scaleX: 2 },

            { x: 350, y: 400, key: 'ground' },
            { x: 700, y: 300, key: 'ground' },
            { x: 1050, y: 420, key: 'ground' },
            { x: 1300, y: 290, key: 'ground' },
            { x: 1600, y: 380, key: 'ground' },
            { x: 1900, y: 270, key: 'ground' },
            { x: 2200, y: 390, key: 'ground' },
            { x: 2500, y: 290, key: 'ground' },
        ],

        herbs: [
            { x: 355, y: 360 },
            { x: 700, y: 260 },
            { x: 1300, y: 250 },
            { x: 1900, y: 230 },
            { x: 2500, y: 250 },
            { x: 1050, y: 380 },
            { x: 2200, y: 350 },
        ],

        portal: { x: 2700, y: 500 },

        pierniki: [
            { x: 150, y: 520 }, { x: 550, y: 520 }, { x: 900, y: 380 },
            { x: 1150, y: 380 }, { x: 1450, y: 340 }, { x: 1700, y: 340 },
            { x: 2050, y: 230 }, { x: 2300, y: 350 }, { x: 2600, y: 250 },
        ],

        enemies: [
            { x: 600, y: 540, type: 'patrol', speed: 70, hp: 1 },
            { x: 1200, y: 540, type: 'patrol', speed: 70, hp: 1 },
            { x: 1800, y: 540, type: 'patrol', speed: 75, hp: 1 },
            { x: 700, y: 270, type: 'patrol', speed: 65, hp: 1 },
            { x: 1900, y: 240, type: 'patrol', speed: 65, hp: 1 },
            { x: 1400, y: 540, type: 'chaser', speed: 95, hp: 2, aggroRange: 280 },
            { x: 2300, y: 540, type: 'chaser', speed: 95, hp: 2, aggroRange: 280 },
            { x: 1000, y: 180, type: 'flying', speed: 60, hp: 3, bulletInterval: 2200 },
            { x: 2100, y: 180, type: 'flying', speed: 60, hp: 3, bulletInterval: 2200 },
        ]
    }
];
