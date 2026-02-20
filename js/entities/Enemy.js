/**
 * Enemy — klasa wrogów z State Machine i patrol edge-detection.
 *
 * Typy:
 *   'patrol'  — chodzi po platformach; wykrywa krawędzie i ściany → odwraca się
 *   'chaser'  — patroluje, po wejściu gracza w aggroRange goni go
 *   'flying'  — ruch sinusoidal + strzelanie pociskami
 *
 * NOWOŚĆ: _updatePatrol() sprawdza body.blocked.left/right (ściana)
 *         oraz brak podłoża przed wrogiem (probe point).
 */
export class Enemy {
    static STATES = {
        PATROL: 'PATROL',
        CHASE: 'CHASE',
        FLYING: 'FLYING',
        DEAD: 'DEAD'
    };

    /**
     * @param {Phaser.Scene} scene
     * @param {number} x
     * @param {number} y
     * @param {object} options
     *   type: 'patrol' | 'chaser' | 'flying'
     *   aggroRange: number (px)
     *   speed: number
     *   hp: number
     *   bulletInterval: number (ms)
     *   bullets: Phaser.Physics.Arcade.Group
     *   platforms: Phaser.Physics.Arcade.StaticGroup  ← nowy parametr dla edge probe
     */
    constructor(scene, x, y, options = {}) {
        this.scene = scene;
        this.type = options.type || 'patrol';
        this.aggroRange = options.aggroRange || 200;
        this.speed = options.speed || 80;
        this.hp = options.hp || 2;
        this.bullets = options.bullets || null;
        this.bulletInterval = options.bulletInterval || 2000;
        this.platforms = options.platforms || null;

        // Sprite (placeholder 'bomb')
        this.sprite = scene.physics.add.sprite(x, y, 'bomb');
        this.sprite.setCollideWorldBounds(true);
        this.sprite.setBounce(0);

        // Koloryzacja wg typu
        if (this.type === 'chaser') this.sprite.setTint(0xff4444);
        if (this.type === 'flying') {
            this.sprite.setTint(0xaa44ff);
            this.sprite.body.allowGravity = false;
        }

        this.state = this.type === 'flying' ? Enemy.STATES.FLYING : Enemy.STATES.PATROL;
        this._patrolDir = 1;        // 1 = prawo, -1 = lewo
        this._sinOffset = 0;
        this._bulletTimer = 0;
        this._dead = false;

        // Edge detection — cooldown by zapobiec oscylacji
        this._edgeCooldown = 0;
    }

    get x() { return this.sprite.x; }
    get y() { return this.sprite.y; }

    // ─────────────────────────────────────────
    // Główna pętla update
    // ─────────────────────────────────────────

    update(player, delta) {
        if (this._dead) return;
        if (this._edgeCooldown > 0) this._edgeCooldown -= delta;

        switch (this.state) {
            case Enemy.STATES.PATROL: this._updatePatrol(player, delta); break;
            case Enemy.STATES.CHASE: this._updateChase(player); break;
            case Enemy.STATES.FLYING: this._updateFlying(player, delta); break;
        }
    }

    // ─────────────────────────────────────────
    // Patrol z wykrywaniem krawędzi i ścian
    // ─────────────────────────────────────────

    _updatePatrol(player, delta) {
        const sprite = this.sprite;
        const body = sprite.body;

        // Sprawdź kolizję ze ścianą (physic body)
        const hitWall = (this._patrolDir === 1 && body.blocked.right)
            || (this._patrolDir === -1 && body.blocked.left);

        // Sprawdź brak podłoża przed wrogiem (probe)
        const edgeAhead = this._edgeCooldown <= 0 && this._lacksGroundAhead();

        if (hitWall || edgeAhead) {
            this._patrolDir *= -1;
            this._edgeCooldown = 300; // ~300ms cooldown by nie drgać
        }

        sprite.setVelocityX(this.speed * this._patrolDir);

        // Sprite flip by postać patrzyła w kierunku ruchu
        if (this._patrolDir === -1) sprite.setFlipX(true);
        else sprite.setFlipX(false);

        // Dla chasera: sprawdź aggro
        if (this.type === 'chaser' && player) {
            const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, player.x, player.y);
            if (dist < this.aggroRange) {
                this.state = Enemy.STATES.CHASE;
            }
        }
    }

    /**
     * Zwraca true gdy pod przyszłą pozycją wroga (30px przed nim) nie ma platformy.
     * Używa getTilesWithinWorldXY lub iteruje po grupie platform jako AABB probe.
     */
    _lacksGroundAhead() {
        if (!this.platforms) return false;

        const sprite = this.sprite;
        // Punkt sprawdzenia: stopki wroga + 1px niżej + 30px w kierunku ruchu
        const probeX = sprite.x + this._patrolDir * (sprite.width * 0.6 + 8);
        const probeY = sprite.y + sprite.height / 2 + 4; // tuż pod stopami

        // Iteruj po platformach — czy jest jakakolwiek w pobliżu probeX, probeY
        let found = false;
        this.platforms.getChildren().forEach(tile => {
            if (found) return;
            const tb = tile.getBounds ? tile.getBounds() : tile.body;
            if (!tb) return;
            // Sprawdź czy punkt probe jest nad platformą (±10px w X, platforma tuż pod)
            const inX = probeX >= tb.x && probeX <= tb.x + (tb.width || tb.halfWidth * 2);
            const inY = probeY >= tb.y && probeY <= tb.y + (tb.height || tb.halfHeight * 2) + 6;
            if (inX && inY) found = true;
        });

        return !found;
    }

    // ─────────────────────────────────────────
    // Chase (goniący)
    // ─────────────────────────────────────────

    _updateChase(player) {
        const sprite = this.sprite;
        if (!player) return;

        const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, player.x, player.y);

        // Wróć do patrolu gdy gracz za daleko
        if (dist > this.aggroRange * 1.5) {
            this.state = Enemy.STATES.PATROL;
            return;
        }

        const dir = player.x < sprite.x ? -1 : 1;
        sprite.setVelocityX(this.speed * dir * 1.4);
        sprite.setFlipX(dir === -1);

        // Skok w stronę gracza jeśli wyżej
        if (player.y < sprite.y - 50 && sprite.body.blocked.down) {
            sprite.setVelocityY(-280);
        }
    }

    // ─────────────────────────────────────────
    // Flying (latający + strzelający)
    // ─────────────────────────────────────────

    _updateFlying(player, delta) {
        const sprite = this.sprite;
        this._sinOffset += delta * 0.003;

        sprite.setVelocityY(Math.sin(this._sinOffset) * 80);

        if (player) {
            const dir = player.x < sprite.x ? -1 : 1;
            sprite.setVelocityX(dir * this.speed * 0.5);

            this._bulletTimer += delta;
            if (this._bulletTimer > this.bulletInterval && this.bullets) {
                this._shoot(player);
                this._bulletTimer = 0;
            }
        }
    }

    _shoot(player) {
        if (!this.scene.textures.exists('fx_dot_spark')) return;
        const bullet = this.bullets.create(this.sprite.x, this.sprite.y, 'fx_dot_spark');
        if (!bullet) return;

        bullet.setActive(true).setVisible(true);
        bullet.body.allowGravity = false;
        bullet.setScale(2).setTint(0xff6600);

        const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, player.x, player.y);
        const speed = 200;
        bullet.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

        this.scene.time.delayedCall(3000, () => {
            if (bullet && bullet.active) bullet.destroy();
        });
    }

    // ─────────────────────────────────────────
    // Obrażenia i śmierć
    // ─────────────────────────────────────────

    takeDamage(amount, effectsManager) {
        if (this._dead) return false;
        this.hp -= amount;

        this.scene.tweens.add({
            targets: this.sprite,
            alpha: 0.3,
            duration: 80,
            yoyo: true
        });

        if (effectsManager) effectsManager.shakeHitEnemy();

        if (this.hp <= 0) {
            this._die(effectsManager);
            return true;
        }
        return false;
    }

    _die(effectsManager) {
        this._dead = true;
        this.state = Enemy.STATES.DEAD;

        if (effectsManager) {
            effectsManager.flashOnEnemyDefeat(this.sprite.x, this.sprite.y);
        }

        this.scene.tweens.add({
            targets: this.sprite,
            alpha: 0,
            y: this.sprite.y - 30,
            duration: 400,
            onComplete: () => { if (this.sprite.active) this.sprite.destroy(); }
        });
    }

    isDead() { return this._dead; }
}
