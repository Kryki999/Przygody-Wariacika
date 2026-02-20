/**
 * Enemy — klasa wrogów z kinematycznym (tween-based) patrolem.
 *
 * ARCHITEKTURA: Wrogowie NIE podlegają grawitacji silnika ani nie kolidują
 * z platformami. Ich ruch jest czysto matematyczny (tweeny/transformacje).
 * Hitbox (body) służy wyłącznie do detekcji overlap z graczem / dashem.
 *
 * Typy:
 *   'patrol'  — tween liniowy A↔B w poziomie na stałej wysokości Y
 *   'chaser'  — patroluje, po aggro goni gracza (tween do pozycji gracza)
 *   'flying'  — sinusoidal Y + drift w stronę gracza + strzelanie
 *
 * Korzyść: zero zacinania się na szwach/łączeniach platform.
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
     *   speed: number
     *   hp: number
     *   patrolDist: number (px, default 120)
     *   aggroRange: number (only for chaser)
     *   bulletInterval: number (only for flying)
     *   bullets: Phaser.Physics.Arcade.Group
     */
    constructor(scene, x, y, options = {}) {
        this.scene = scene;
        this.type = options.type || 'patrol';
        this.aggroRange = options.aggroRange || 200;
        this.speed = options.speed || 80;
        this.hp = options.hp || 2;
        this.bullets = options.bullets || null;
        this.bulletInterval = options.bulletInterval || 2000;
        this.patrolDist = options.patrolDist || 120;

        // Pozycja startowa (do patrolu)
        this._startX = x;
        this._startY = y;

        // Sprite (placeholder 'bomb')
        this.sprite = scene.physics.add.sprite(x, y, 'bomb');
        this.sprite.setCollideWorldBounds(false);
        this.sprite.setBounce(0);

        // KINEMATYCZNY: żadna grawitacja, żadne kolizje z platformami
        this.sprite.body.allowGravity = false;
        // Body nadal aktywny — do overlap detection
        this.sprite.body.setImmovable(true);

        // Koloryzacja wg typu
        if (this.type === 'chaser') this.sprite.setTint(0xff4444);
        if (this.type === 'flying') this.sprite.setTint(0xaa44ff);

        this.state = this.type === 'flying' ? Enemy.STATES.FLYING : Enemy.STATES.PATROL;
        this._patrolDir = 1;
        this._sinOffset = 0;
        this._bulletTimer = 0;
        this._dead = false;
        this._patrolTween = null;

        // Uruchom odpowiedni tryb
        if (this.state === Enemy.STATES.PATROL) {
            this._startPatrolTween();
        }
    }

    get x() { return this.sprite.x; }
    get y() { return this.sprite.y; }

    // ─────────────────────────────────────────
    // Tween-based Patrol
    // ─────────────────────────────────────────

    _startPatrolTween() {
        const leftX = this._startX - this.patrolDist;
        const rightX = this._startX + this.patrolDist;
        const durationOneLeg = (this.patrolDist * 2) / this.speed * 1000;

        this.sprite.setFlipX(false);

        this._patrolTween = this.scene.tweens.add({
            targets: this.sprite,
            x: rightX,
            duration: durationOneLeg / 2,
            ease: 'Linear',
            yoyo: true,
            repeat: -1,
            onYoyo: () => {
                this._patrolDir = -1;
                this.sprite.setFlipX(true);
            },
            onRepeat: () => {
                this._patrolDir = 1;
                this.sprite.setFlipX(false);
            }
        });
    }

    _stopPatrolTween() {
        if (this._patrolTween) {
            this._patrolTween.stop();
            this._patrolTween = null;
        }
    }

    // ─────────────────────────────────────────
    // Główna pętla update
    // ─────────────────────────────────────────

    update(player, delta) {
        if (this._dead) return;

        switch (this.state) {
            case Enemy.STATES.PATROL:
                this._updatePatrol(player, delta);
                break;
            case Enemy.STATES.CHASE:
                this._updateChase(player, delta);
                break;
            case Enemy.STATES.FLYING:
                this._updateFlying(player, delta);
                break;
        }
    }

    // ─────────────────────────────────────────
    // Patrol (tween handles movement; check aggro only)
    // ─────────────────────────────────────────

    _updatePatrol(player, delta) {
        // Tween zarządza pozycją X — tu tylko sprawdzamy aggro (dla chaser)
        if (this.type === 'chaser' && player) {
            const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, player.x, player.y);
            if (dist < this.aggroRange) {
                this._stopPatrolTween();
                this.state = Enemy.STATES.CHASE;
            }
        }
    }

    // ─────────────────────────────────────────
    // Chase (goniący — ruch bezpośredni)
    // ─────────────────────────────────────────

    _updateChase(player, delta) {
        if (!player) return;

        const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, player.x, player.y);

        // Wróć do patrolu gdy gracz za daleko
        if (dist > this.aggroRange * 1.8) {
            this.state = Enemy.STATES.PATROL;
            // Resetuj pozycję startową na obecną (żeby nie teleportował do spawnu)
            this._startX = this.sprite.x;
            this._startPatrolTween();
            return;
        }

        // Poruszaj się w stronę gracza (kinematycznie, bez fizyki)
        const dir = player.x < this.sprite.x ? -1 : 1;
        const chaseSpeed = this.speed * 1.4;
        this.sprite.x += dir * chaseSpeed * (delta / 1000);
        this.sprite.setFlipX(dir === -1);
    }

    // ─────────────────────────────────────────
    // Flying (sinusoidal + strzelanie)
    // ─────────────────────────────────────────

    _updateFlying(player, delta) {
        this._sinOffset += delta * 0.003;

        // Sinusoidal Y offset od pozycji startowej
        this.sprite.y = this._startY + Math.sin(this._sinOffset) * 40;

        if (player) {
            const dir = player.x < this.sprite.x ? -1 : 1;
            this.sprite.x += dir * this.speed * 0.5 * (delta / 1000);

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

    /**
     * @param {number} amount
     * @param {object} effectsManager
     * @param {object} [knockbackOpts] — { dirX, force } dla efektu knockback (dash attack)
     */
    takeDamage(amount, effectsManager, knockbackOpts) {
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
            this._die(effectsManager, knockbackOpts);
            return true;
        }
        return false;
    }

    _die(effectsManager, knockbackOpts) {
        this._dead = true;
        this.state = Enemy.STATES.DEAD;
        this._stopPatrolTween();

        if (effectsManager) {
            effectsManager.flashOnEnemyDefeat(this.sprite.x, this.sprite.y);
        }

        // Knockback animation (dash attack) lub standardowy fade
        const targetX = knockbackOpts
            ? this.sprite.x + (knockbackOpts.dirX || 1) * (knockbackOpts.force || 80)
            : this.sprite.x;
        const targetY = knockbackOpts
            ? this.sprite.y - 20
            : this.sprite.y - 30;

        this.scene.tweens.add({
            targets: this.sprite,
            alpha: 0,
            x: targetX,
            y: targetY,
            duration: knockbackOpts ? 300 : 400,
            ease: knockbackOpts ? 'Power2' : 'Linear',
            onComplete: () => { if (this.sprite.active) this.sprite.destroy(); }
        });
    }

    isDead() { return this._dead; }
}
