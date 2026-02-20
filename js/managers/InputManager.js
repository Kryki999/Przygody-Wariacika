/**
 * InputManager — uniwersalny menedżer wejścia.
 * Unifikuje sygnały z klawiatury i multi-touch dotyku.
 * 
 * Interfejs wyjściowy:
 *   inputManager.left   — boolean
 *   inputManager.right  — boolean
 *   inputManager.jump   — boolean (jednorazowy impuls)
 *   inputManager.attack — boolean (jednorazowy impuls)
 */
export class InputManager {
    constructor(scene) {
        this.scene = scene;

        // Stan logiczny — niezależny od źródła wejścia
        this.left = false;
        this.right = false;
        this.jump = false;
        this.attack = false;

        // Wewnętrzne — touch tracking
        this._touchLeft = false;
        this._touchRight = false;
        this._touchJump = false;
        this._touchAttack = false;

        // Śledzenie ekranów dotykowych wg pointerId
        this._activePointers = new Map();

        this._setupKeyboard();
        this._setupTouch();
        this._createMobileUI();
    }

    _setupKeyboard() {
        const kb = this.scene.input.keyboard;
        this.cursors = kb.createCursorKeys();
        this.wasd = kb.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });
        this.spaceKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.attackKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.X);
        this.attackKey2 = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    }

    _setupTouch() {
        const input = this.scene.input;

        // Włącz multi-touch (do 5 palców)
        input.addPointer(4);

        // Granica środka ekranu (lewa = ruch, prawa = akcja)
        const W = this.scene.scale.width;
        const H = this.scene.scale.height;

        // Strefy dotykowe jako rectangles w przestrzeni ekranu
        this._leftZone = new Phaser.Geom.Rectangle(0, 0, W * 0.5, H);
        this._rightZone = new Phaser.Geom.Rectangle(W * 0.5, 0, W * 0.5, H);

        // Aktualizuj strefy przy zmianie rozdzielczości
        this.scene.scale.on('resize', (gameSize) => {
            const nW = gameSize.width;
            const nH = gameSize.height;
            this._leftZone.setTo(0, 0, nW * 0.5, nH);
            this._rightZone.setTo(nW * 0.5, 0, nW * 0.5, nH);
        });

        input.on('pointerdown', this._onPointerDown, this);
        input.on('pointermove', this._onPointerMove, this);
        input.on('pointerup', this._onPointerUp, this);
        input.on('pointercancel', this._onPointerUp, this);
    }

    _onPointerDown(pointer) {
        this._activePointers.set(pointer.id, { x: pointer.x, y: pointer.y });
        this._processTouchState();
    }

    _onPointerMove(pointer) {
        if (!this._activePointers.has(pointer.id)) return;
        this._activePointers.set(pointer.id, { x: pointer.x, y: pointer.y });
        this._processTouchState();
    }

    _onPointerUp(pointer) {
        this._activePointers.delete(pointer.id);
        this._processTouchState();
    }

    /**
     * Przetwarza wszystkie aktywne palce i ustawia odpowiednie flagi.
     * Lewa strona → ruch (prawa/lewa połówka lewej strefy = kierunek)
     * Prawa strona → skok/atak
     */
    _processTouchState() {
        let touchLeft = false;
        let touchRight = false;
        let touchJump = false;
        let touchAttack = false;

        const W = this.scene.scale.width;

        for (const [, pos] of this._activePointers) {
            if (pos.x < W * 0.5) {
                // Lewa strefa: ćwiartka lewa/prawa decyduje o kierunku
                const leftQuarter = W * 0.25;
                if (pos.x < leftQuarter) {
                    touchLeft = true;
                } else {
                    touchRight = true;
                }
            } else {
                // Prawa strefa: górna połowa → skok, dolna → atak
                const H = this.scene.scale.height;
                if (pos.y < H * 0.5) {
                    touchJump = true;
                } else {
                    touchAttack = true;
                }
            }
        }

        this._touchLeft = touchLeft;
        this._touchRight = touchRight;
        this._touchJump = touchJump;
        this._touchAttack = touchAttack;
    }

    /**
     * Tworzy widoczne przyciski mobilne na canvasie gry (HUD touch).
     * Są transparentne i interaktywne — pomagają użytkownicy wiedzieć gdzie dotknąć.
     */
    _createMobileUI() {
        // Sprawdź czy to urządzenie dotykowe
        const isMobile = !this.scene.sys.game.device.os.desktop;

        if (!isMobile) return;

        const scene = this.scene;
        const cam = scene.cameras.main;
        const W = scene.scale.width;
        const H = scene.scale.height;

        const alpha = 0.25;

        // Pomocnik do tworzenia widocznego przycisku
        const makeBtn = (x, y, w, h, label, color) => {
            const rect = scene.add.rectangle(x, y, w, h, color, alpha)
                .setStrokeStyle(2, 0xffffff, 0.5)
                .setScrollFactor(0)
                .setDepth(100);

            const txt = scene.add.text(x, y, label, {
                fontSize: '28px', color: '#ffffff', alpha: 0.7
            }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

            return { rect, txt };
        };

        // Mniejsze przyciski: wys. = 22% ekranu, szer. = 20%
        const btnH = H * 0.22;
        const btnW = W * 0.20;
        const btnY = H - btnH / 2 - 8;

        // D-pad lewy
        makeBtn(W * 0.10, btnY, btnW, btnH, '◀', 0xffffff);
        // D-pad prawy
        makeBtn(W * 0.32, btnY, btnW, btnH, '▶', 0xffffff);
        // Skok (prawy górny)
        makeBtn(W * 0.82, H - btnH - 4, btnW, btnH * 0.9, '▲', 0x4fc3f7);
        // Atak (prawy dolny)
        makeBtn(W * 0.82, H - 8, btnW, btnH * 0.9, '⚡', 0xe94560);
    }

    /**
     * Wywołaj w update() sceny — aktualizuje stan na podstawie klawiatury i dotyku.
     */
    update() {
        const kb = this.cursors;
        const wasd = this.wasd;

        this.left = kb.left.isDown || (wasd && wasd.left.isDown) || this._touchLeft;
        this.right = kb.right.isDown || (wasd && wasd.right.isDown) || this._touchRight;

        const kbJump = Phaser.Input.Keyboard.JustDown(kb.up)
            || Phaser.Input.Keyboard.JustDown(this.spaceKey)
            || (wasd && Phaser.Input.Keyboard.JustDown(wasd.up));

        // Touch jump: aktywny gdy palec właśnie dotknął (edge-trigger)
        const prevTouchJump = this._prevTouchJump || false;
        const touchJumpEdge = this._touchJump && !prevTouchJump;
        this._prevTouchJump = this._touchJump;

        const prevTouchAttack = this._prevTouchAttack || false;
        const touchAttackEdge = this._touchAttack && !prevTouchAttack;
        this._prevTouchAttack = this._touchAttack;

        this.jump = kbJump || touchJumpEdge;

        // Atak: klawiatura (X lub Z) lub touch
        const kbAttack = Phaser.Input.Keyboard.JustDown(this.attackKey)
            || Phaser.Input.Keyboard.JustDown(this.attackKey2);
        this.attack = kbAttack || touchAttackEdge;
    }

    /**
     * Sprawdza czy gracz skacze (przytrzymanie — do ciągłego skoku jeśli potrzeba).
     */
    isJumpHeld() {
        return this.cursors.up.isDown || this.spaceKey.isDown || this._touchJump;
    }

    destroy() {
        this.scene.input.off('pointerdown', this._onPointerDown, this);
        this.scene.input.off('pointermove', this._onPointerMove, this);
        this.scene.input.off('pointerup', this._onPointerUp, this);
        this.scene.input.off('pointercancel', this._onPointerUp, this);
        this._activePointers.clear();
    }
}
