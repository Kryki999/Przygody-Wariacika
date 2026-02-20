/**
 * InputManager — uniwersalny menedżer wejścia (mobile-first refaktor).
 *
 * Mobilne sterowanie:
 *   - Wirtualny joystick (lewy dolny róg) — BINARNE D-pad (nie analogowe!)
 *     Wychyl joystick w dowolną stronę > DEADZONE_PX → pełna prędkość lewo/prawo.
 *   - Przycisk JUMP (prawy dolny róg)
 *   - Przycisk SUPERMOC/ATAK (poniżej skoku)
 *
 * Każdy element śledzi osobny pointerId → multi-touch.
 *
 * Interfejs wyjściowy:
 *   left, right  — boolean (kompatybilność wsteczna)
 *   joystickX    — -1 | 0 | +1  (binarne, jak D-pad)
 *   joystickY    — -1 | 0 | +1  (binarne)
 *   jump         — boolean (jednorazowy impuls)
 *   attack       — boolean (jednorazowy impuls)
 */
export class InputManager {
    // Strefa martwa joysticka w pikselach (nie w znormalizowanych jednostkach)
    // Wychylenie > DEADZONE_PX → sygnał binarny ±1
    static DEADZONE_PX = 12;

    constructor(scene) {
        this.scene = scene;

        // Stan wyjściowy
        this.left = false;
        this.right = false;
        this.joystickX = 0;
        this.joystickY = 0;
        this.jump = false;
        this.attack = false;

        // Wewnętrzny stan zdarzeń
        this._jumpFired = false;
        this._attackFired = false;

        // Wirtualny joystick — dane
        this._joystick = {
            active: false,
            pointerId: -1,
            baseX: 0, baseY: 0,    // centrum bazy na ekranie
            curX: 0, curY: 0,
            radius: 60             // max wychylenie w px
        };

        // Przyciski mobilne — dane
        this._jumpBtn = { active: false, pointerId: -1 };
        this._attackBtn = { active: false, pointerId: -1 };

        // Wizualne obiekty Phasera
        this._graphics = null;
        this._jumpBtnGfx = null;
        this._attackBtnGfx = null;
        this._jumpBtnTxt = null;
        this._attackBtnTxt = null;

        this._setupKeyboard();
        this._setupTouch();

        const isMobile = !scene.sys.game.device.os.desktop;
        if (isMobile) {
            this._createMobileUI();
        }

        // Re-pozycjonowanie przy zmianie rozmiaru
        scene.scale.on('resize', this._onResize, this);
    }

    // ─────────────────────────────────────────
    // Konfiguracja wejścia
    // ─────────────────────────────────────────

    _setupKeyboard() {
        const kb = this.scene.input.keyboard;
        this.cursors = kb.createCursorKeys();
        this.wasd = kb.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });
        this.spaceKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.attackKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.X);
        this.attackKey2 = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    }

    _setupTouch() {
        const input = this.scene.input;
        input.addPointer(4); // Multi-touch do 5 palców

        input.on('pointerdown', this._onPointerDown, this);
        input.on('pointermove', this._onPointerMove, this);
        input.on('pointerup', this._onPointerUp, this);
        input.on('pointercancel', this._onPointerUp, this);
    }

    // ─────────────────────────────────────────
    // Touch events
    // ─────────────────────────────────────────

    _onPointerDown(pointer) {
        const W = this.scene.scale.width;
        const H = this.scene.scale.height;

        // Strefy przycisków (prawa strona)
        const jumpRect = this._getJumpBtnRect(W, H);
        const attackRect = this._getAttackBtnRect(W, H);
        const joystickZone = this._getJoystickZone(W, H);

        const px = pointer.x;
        const py = pointer.y;

        if (Phaser.Geom.Rectangle.Contains(jumpRect, px, py) && !this._jumpBtn.active) {
            this._jumpBtn.active = true;
            this._jumpBtn.pointerId = pointer.id;
            this._jumpFired = true;
            this._animateBtn(this._jumpBtnGfx, true);
            return;
        }

        if (Phaser.Geom.Rectangle.Contains(attackRect, px, py) && !this._attackBtn.active) {
            this._attackBtn.active = true;
            this._attackBtn.pointerId = pointer.id;
            this._attackFired = true;
            this._animateBtn(this._attackBtnGfx, true);
            return;
        }

        if (Phaser.Geom.Rectangle.Contains(joystickZone, px, py) && !this._joystick.active) {
            this._joystick.active = true;
            this._joystick.pointerId = pointer.id;
            this._joystick.baseX = px;
            this._joystick.baseY = py;
            this._joystick.curX = px;
            this._joystick.curY = py;
            this._updateJoystickGraphics();
        }
    }

    _onPointerMove(pointer) {
        if (this._joystick.active && pointer.id === this._joystick.pointerId) {
            this._joystick.curX = pointer.x;
            this._joystick.curY = pointer.y;
            this._updateJoystickGraphics();
        }
    }

    _onPointerUp(pointer) {
        if (pointer.id === this._joystick.pointerId) {
            this._joystick.active = false;
            this._joystick.pointerId = -1;
            this.joystickX = 0;
            this.joystickY = 0;
            this._updateJoystickGraphics();
        }
        if (pointer.id === this._jumpBtn.pointerId) {
            this._jumpBtn.active = false;
            this._jumpBtn.pointerId = -1;
            this._animateBtn(this._jumpBtnGfx, false);
        }
        if (pointer.id === this._attackBtn.pointerId) {
            this._attackBtn.active = false;
            this._attackBtn.pointerId = -1;
            this._animateBtn(this._attackBtnGfx, false);
        }
    }

    // ─────────────────────────────────────────
    // Obliczenie wychylenia joysticka
    // ─────────────────────────────────────────

    /**
     * BINARNE D-PAD: ignorujemy siłę wychylenia.
     * Liczy się tylko KIERUNEK i czy przekroczono DEADZONE_PX.
     * joystickX = -1 | 0 | +1  (jak lewo/prawy klawisz klawiatury)
     */
    _computeJoystick() {
        if (!this._joystick.active) {
            this.joystickX = 0;
            this.joystickY = 0;
            return;
        }

        const dx = this._joystick.curX - this._joystick.baseX;
        const dy = this._joystick.curY - this._joystick.baseY;
        const dz = InputManager.DEADZONE_PX;

        // Tylko kierunek — brak pośrednich wartości
        this.joystickX = dx > dz ? 1 : dx < -dz ? -1 : 0;
        this.joystickY = dy > dz ? 1 : dy < -dz ? -1 : 0;
    }

    // ─────────────────────────────────────────
    // Główna pętla update
    // ─────────────────────────────────────────

    update() {
        const kb = this.cursors;
        const wasd = this.wasd;

        // Klawiatura — binarne ±1 (taka sama logika jak joystick)
        let kbX = 0;
        if (kb.left.isDown || (wasd && wasd.left.isDown)) kbX = -1;
        else if (kb.right.isDown || (wasd && wasd.right.isDown)) kbX = 1;

        this._computeJoystick();

        // Joystick dotykowy ma priorytet nad klawiaturą
        if (!this._joystick.active) {
            this.joystickX = kbX;
            this.joystickY = 0;
        }

        // Kompatybilność wsteczna: left/right (deadzone: 0 = wystarczy, bo wartości są -1/0/+1)
        this.left = this.joystickX < 0;
        this.right = this.joystickX > 0;

        // Jump
        const kbJump = Phaser.Input.Keyboard.JustDown(kb.up)
            || Phaser.Input.Keyboard.JustDown(this.spaceKey)
            || (wasd && Phaser.Input.Keyboard.JustDown(wasd.up));

        this.jump = kbJump || this._jumpFired;
        this._jumpFired = false;

        // Attack
        const kbAttack = Phaser.Input.Keyboard.JustDown(this.attackKey)
            || Phaser.Input.Keyboard.JustDown(this.attackKey2);
        this.attack = kbAttack || this._attackFired;
        this._attackFired = false;
    }

    isJumpHeld() {
        return this.cursors.up.isDown || this.spaceKey.isDown || this._jumpBtn.active;
    }

    // ─────────────────────────────────────────
    // Wizualny UI mobilny
    // ─────────────────────────────────────────

    _createMobileUI() {
        const scene = this.scene;

        // Graphics na joystick (baza + kursor)
        this._graphics = scene.add.graphics().setDepth(150).setScrollFactor(0);

        // Przyciski
        this._jumpBtnGfx = scene.add.graphics().setDepth(150).setScrollFactor(0);
        this._jumpBtnTxt = scene.add.text(0, 0, '▲', {
            fontSize: '30px', color: '#ffffff'
        }).setOrigin(0.5).setDepth(151).setScrollFactor(0).setAlpha(0.85);

        this._attackBtnGfx = scene.add.graphics().setDepth(150).setScrollFactor(0);
        this._attackBtnTxt = scene.add.text(0, 0, '⚡', {
            fontSize: '26px'
        }).setOrigin(0.5).setDepth(151).setScrollFactor(0).setAlpha(0.85);

        this._drawStaticUI();
    }

    _drawStaticUI() {
        const W = this.scene.scale.width;
        const H = this.scene.scale.height;

        // ─── Strefa joysticka (baza — rysowana jako wskazówka) ───
        const jZ = this._getJoystickZone(W, H);
        if (this._graphics) {
            this._graphics.clear();
            // Delikatna strefa w tle
            this._graphics.fillStyle(0xffffff, 0.06);
            this._graphics.fillRoundedRect(jZ.x, jZ.y, jZ.width, jZ.height, 16);
            // Wskaźnik centrum joysticka
            const cx = jZ.x + jZ.width / 2;
            const cy = jZ.y + jZ.height / 2;
            this._graphics.lineStyle(2, 0xffffff, 0.3);
            this._graphics.strokeCircle(cx, cy, 36);
            this._graphics.fillStyle(0xffffff, 0.15);
            this._graphics.fillCircle(cx, cy, 18);
        }

        // ─── Przycisk JUMP ───
        const jR = this._getJumpBtnRect(W, H);
        if (this._jumpBtnGfx) {
            this._jumpBtnGfx.clear();
            this._jumpBtnGfx.fillStyle(0x4fc3f7, 0.3);
            this._jumpBtnGfx.fillRoundedRect(jR.x, jR.y, jR.width, jR.height, 12);
            this._jumpBtnGfx.lineStyle(2, 0x4fc3f7, 0.6);
            this._jumpBtnGfx.strokeRoundedRect(jR.x, jR.y, jR.width, jR.height, 12);
        }
        if (this._jumpBtnTxt) {
            this._jumpBtnTxt.setPosition(jR.x + jR.width / 2, jR.y + jR.height / 2);
        }

        // ─── Przycisk ATAK ───
        const aR = this._getAttackBtnRect(W, H);
        if (this._attackBtnGfx) {
            this._attackBtnGfx.clear();
            this._attackBtnGfx.fillStyle(0xe94560, 0.3);
            this._attackBtnGfx.fillRoundedRect(aR.x, aR.y, aR.width, aR.height, 12);
            this._attackBtnGfx.lineStyle(2, 0xe94560, 0.6);
            this._attackBtnGfx.strokeRoundedRect(aR.x, aR.y, aR.width, aR.height, 12);
        }
        if (this._attackBtnTxt) {
            this._attackBtnTxt.setPosition(aR.x + aR.width / 2, aR.y + aR.height / 2);
        }
    }

    /** Rysuje ruchomy kursor joysticka */
    _updateJoystickGraphics() {
        if (!this._graphics) return;
        const W = this.scene.scale.width;
        const H = this.scene.scale.height;

        this._graphics.clear();

        // Strefa / tło joysticka
        const jZ = this._getJoystickZone(W, H);
        this._graphics.fillStyle(0xffffff, 0.06);
        this._graphics.fillRoundedRect(jZ.x, jZ.y, jZ.width, jZ.height, 16);

        if (this._joystick.active) {
            const bx = this._joystick.baseX;
            const by = this._joystick.baseY;

            // Baza (duże kółko)
            this._graphics.lineStyle(3, 0xffffff, 0.5);
            this._graphics.strokeCircle(bx, by, this._joystick.radius);
            this._graphics.fillStyle(0xffffff, 0.1);
            this._graphics.fillCircle(bx, by, this._joystick.radius);

            // Kursor (małe kółko wewnątrz)
            const dx = this._joystick.curX - bx;
            const dy = this._joystick.curY - by;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const r = this._joystick.radius;
            const cx = dist > r ? bx + (dx / dist) * r : this._joystick.curX;
            const cy = dist > r ? by + (dy / dist) * r : this._joystick.curY;

            this._graphics.fillStyle(0xffffff, 0.8);
            this._graphics.fillCircle(cx, cy, 20);
        } else {
            // Statyczny wskaźnik środka
            const cx = jZ.x + jZ.width / 2;
            const cy = jZ.y + jZ.height / 2;
            this._graphics.lineStyle(2, 0xffffff, 0.25);
            this._graphics.strokeCircle(cx, cy, 36);
            this._graphics.fillStyle(0xffffff, 0.1);
            this._graphics.fillCircle(cx, cy, 18);
        }
    }

    _animateBtn(gfx, pressed) {
        if (!gfx) return;
        const W = this.scene.scale.width;
        const H = this.scene.scale.height;
        const isJump = gfx === this._jumpBtnGfx;
        const rect = isJump ? this._getJumpBtnRect(W, H) : this._getAttackBtnRect(W, H);
        const color = isJump ? 0x4fc3f7 : 0xe94560;
        const alpha = pressed ? 0.55 : 0.3;

        gfx.clear();
        gfx.fillStyle(color, alpha);
        gfx.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 12);
        gfx.lineStyle(2, color, pressed ? 1 : 0.6);
        gfx.strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, 12);
    }

    // ─────────────────────────────────────────
    // Definicje stref (relatywne do ekranu)
    // ─────────────────────────────────────────

    _getJoystickZone(W, H) {
        const btnW = Math.min(W * 0.38, 200);
        const btnH = Math.min(H * 0.35, 180);
        return new Phaser.Geom.Rectangle(8, H - btnH - 8, btnW, btnH);
    }

    _getJumpBtnRect(W, H) {
        const bW = Math.min(W * 0.18, 110);
        const bH = Math.min(H * 0.16, 80);
        return new Phaser.Geom.Rectangle(W - bW - 10, H - bH * 2 - 16, bW, bH);
    }

    _getAttackBtnRect(W, H) {
        const bW = Math.min(W * 0.18, 110);
        const bH = Math.min(H * 0.16, 80);
        return new Phaser.Geom.Rectangle(W - bW - 10, H - bH - 8, bW, bH);
    }

    // ─────────────────────────────────────────
    // Obsługa resize
    // ─────────────────────────────────────────

    _onResize() {
        // Reset joysticka (baza mogła wyjść poza ekran)
        this._joystick.active = false;
        this._joystick.pointerId = -1;
        this.joystickX = 0;
        this.joystickY = 0;

        this._drawStaticUI();
        this._updateJoystickGraphics();
    }

    // ─────────────────────────────────────────
    // Sprzątanie
    // ─────────────────────────────────────────

    destroy() {
        this.scene.scale.off('resize', this._onResize, this);
        this.scene.input.off('pointerdown', this._onPointerDown, this);
        this.scene.input.off('pointermove', this._onPointerMove, this);
        this.scene.input.off('pointerup', this._onPointerUp, this);
        this.scene.input.off('pointercancel', this._onPointerUp, this);

        if (this._graphics) this._graphics.destroy();
        if (this._jumpBtnGfx) this._jumpBtnGfx.destroy();
        if (this._attackBtnGfx) this._attackBtnGfx.destroy();
        if (this._jumpBtnTxt) this._jumpBtnTxt.destroy();
        if (this._attackBtnTxt) this._attackBtnTxt.destroy();
    }
}
