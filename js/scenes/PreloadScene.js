/**
 * PreloadScene — ładuje wszystkie assety z paskiem postępu.
 */
export class PreloadScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PreloadScene' });
    }

    preload() {
        const W = this.scale.width;
        const H = this.scale.height;

        // ─── Pasek postępu ───
        const barBg = this.add.rectangle(W / 2, H / 2, 320, 30, 0x333333).setStrokeStyle(2, 0xffffff);
        const bar = this.add.rectangle(W / 2 - 159, H / 2, 1, 26, 0xe94560);
        const label = this.add.text(W / 2, H / 2 - 30, 'Ładowanie...', {
            fontSize: '20px', color: '#fff', fontFamily: 'Arial'
        }).setOrigin(0.5);

        this.load.on('progress', (value) => {
            bar.width = 318 * value;
            bar.x = (W / 2 - 159) + bar.width / 2;
        });

        // ─── Assety obrazkowe ───
        this.load.image('sky', 'assets/sky.png');
        this.load.image('ground', 'assets/platform.png');
        this.load.image('star', 'assets/star.png');
        this.load.image('bomb', 'assets/bomb.png');
        this.load.spritesheet('dude', 'assets/dude.png', { frameWidth: 32, frameHeight: 48 });

        // ─── Audio (graceful: jeśli pliki nie istnieją → brak błędu) ───
        // this.load.audio('music_main', 'assets/audio/main_theme.ogg');
        // this.load.audio('sfx_collect', 'assets/audio/collect.ogg');
        // this.load.audio('sfx_jump',    'assets/audio/jump.ogg');
        // this.load.audio('sfx_hurt',    'assets/audio/hurt.ogg');
        // Odkomentuj gdy dodasz pliki audio do assets/audio/
    }

    create() {
        this.scene.start('MenuScene');
    }
}
