/**
 * Enemy — klasa wrogie z State Machine.
 * 
 * Stany: PATROL, CHASE, ATTACK, FLYING, DEAD
 * 
 * Typy wrogów (sterowane parametrem `type`):
 *   'patrol'  — chodzi od krawędzi do krawędzi
 *   'chaser'  — jak patrol, ale gdy gracz w aggroRange → goni
 *   'flying'  — ruch sinusoidal + strzela pociskami
 */
export class Enemy {
    static STATES = {
        PATROL: 'PATROL',
        CHASE: 'CHASE',
        ATTACK: 'ATTACK',
        FLYING: 'FLYING',
        DEAD: 'DEAD'
    };

    /**
     * @param {Phaser.Scene} scene
     * @param {number} x
     * @param {number} y
     * @param {object} options
     *   type: 'patrol' | 'chaser' | 'flying'
     *   aggroRange: number (px) — zasięg detekcji gracza
     *   speed: number
     *   hp: number
     *   patrolDistance: number — dystans patrolu od punktu startowego
     *   bulletInterval: number (ms) — interwał strzelania (tylko flying)
     *   bullets: Phaser.Physics.Arcade.Group — współdzielona grupa pocisków
     */
    constructor(scene, x, y, options = {}) {
        this.scene = scene;
        this.type = options.type || 'patrol';
        this.aggroRange = options.aggroRange || 200;
        this.speed = options.speed || 80;
        this.hp = options.hp || 2;
        this.startX = x;
        this.patrolDist = options.patrolDistance || 120;
        this.bullets = options.bullets || null;
        this.bulletInterval = options.bulletInterval || 2000;

        // Sprite (używa 'bomb' jako placeholder, można podmienić na dedykowany)
        this.sprite = scene.physics.add.sprite(x, y, 'bomb');
        this.sprite.setCollideWorldBounds(true);
        this.sprite.setBounce(0.2);

        // Koloryzacja wg typu
        if (this.type === 'chaser') this.sprite.setTint(0xff4444);
        if (this.type === 'flying') { this.sprite.setTint(0xaa44ff); this.sprite.body.allowGravity = false; }

        this.state = this.type === 'flying' ? Enemy.STATES.FLYING : Enemy.STATES.PATROL;
        this._patrolDir = 1; // 1 = prawo, -1 = lewo
        this._sinOffset = 0;
        this._bulletTimer = 0;
        this._dead = false;

        // Referencja do grupy dla fizyki (ustawiana przez GameScene)
        this.group = null;
    }

    get x() { return this.sprite.x; }
    get y() { return this.sprite.y; }

    /**
     * Wywołuj w GameScene.update() dla każdego wroga.
     * @param {Player} player
     * @param {number} delta — czas od ostatniej klatki (ms)
     */
    update(player, delta) {
        if (this._dead) return;

        switch (this.state) {
            case Enemy.STATES.PATROL: this._updatePatrol(player); break;
            case Enemy.STATES.CHASE: this._updateChase(player); break;
            case Enemy.STATES.FLYING: this._updateFlying(player, delta); break;
        }
    }

    _updatePatrol(player) {
        const sprite = this.sprite;

        // Zmień kierunek przy krawędziach zasięgu patrolu
        if (sprite.x > this.startX + this.patrolDist) {
            this._patrolDir = -1;
        } else if (sprite.x < this.startX - this.patrolDist) {
            this._patrolDir = 1;
        }

        sprite.setVelocityX(this.speed * this._patrolDir);

        // Sprawdź aggro (tylko dla chasera)
        if (this.type === 'chaser' && player) {
            const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, player.x, player.y);
            if (dist < this.aggroRange) {
                this.state = Enemy.STATES.CHASE;
            }
        }
    }

    _updateChase(player) {
        const sprite = this.sprite;
        if (!player) return;

        const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, player.x, player.y);

        // Wróć do patrolu jeśli gracz uciekł za daleko
        if (dist > this.aggroRange * 1.5) {
            this.state = Enemy.STATES.PATROL;
            return;
        }

        // Goń gracza
        const dir = player.x < sprite.x ? -1 : 1;
        sprite.setVelocityX(this.speed * dir * 1.4); // chaser jest szybszy

        // Skok jeśli gracz jest wyżej i wróg stoi na ziemi
        if (player.y < sprite.y - 50 && sprite.body.touching.down) {
            sprite.setVelocityY(-280);
        }
    }

    _updateFlying(player, delta) {
        const sprite = this.sprite;
        this._sinOffset += delta * 0.003;

        // Ruch sinusoidal (w pionie)
        sprite.setVelocityY(Math.sin(this._sinOffset) * 80);

        // Poruszaj się powoli ku graczowi (oś X)
        if (player) {
            const dir = player.x < sprite.x ? -1 : 1;
            sprite.setVelocityX(dir * (this.speed * 0.5));

            // Strzelanie pociskami
            this._bulletTimer += delta;
            if (this._bulletTimer > this.bulletInterval && this.bullets) {
                this._shoot(player);
                this._bulletTimer = 0;
            }
        }
    }

    _shoot(player) {
        const bullet = this.bullets.create(this.sprite.x, this.sprite.y, 'fx_dot_spark');
        if (!bullet) return;

        bullet.setActive(true).setVisible(true);
        bullet.body.allowGravity = false;
        bullet.setScale(2);
        bullet.setTint(0xff6600);

        const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, player.x, player.y);
        const speed = 200;
        bullet.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

        // Auto-destroy po 3 sekundach
        this.scene.time.delayedCall(3000, () => {
            if (bullet && bullet.active) bullet.destroy();
        });
    }

    /**
     * Zadaj obrażenia wrogowi.
     * @returns {boolean} true jeśli wróg zginął
     */
    takeDamage(amount, effectsManager) {
        if (this._dead) return false;
        this.hp -= amount;

        // Mignięcie przy trafieniu
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
            onComplete: () => this.sprite.destroy()
        });
    }

    isDead() { return this._dead; }
}
