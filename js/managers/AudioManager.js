/**
 * AudioManager — globalny menedżer dźwięku.
 * Obsługuje muzykę i SFX z osobnymi przełącznikami mute.
 * Stan wyciszenia ładuje z SaveManager i zapisuje przy każdej zmianie.
 */
export class AudioManager {
    constructor(scene, saveManager) {
        this.scene = scene;
        this.saveManager = saveManager;
        this.musicTrack = null;
        this.sounds = {};

        const settings = saveManager.get('audioSettings') || {};
        this.musicMuted = settings.musicMuted ?? false;
        this.sfxMuted = settings.sfxMuted ?? false;
    }

    /**
     * Odtwarza muzykę w pętli. Jeśli ta sama gra → nic nie robi.
     */
    playMusic(key) {
        if (!this.scene.cache.audio.exists(key)) return;
        if (this.musicTrack && this.musicTrack.key === key) return;
        if (this.musicTrack) this.musicTrack.stop();

        this.musicTrack = this.scene.sound.add(key, { loop: true, volume: 0.5 });
        if (!this.musicMuted) {
            this.musicTrack.play();
        }
        this.musicTrack.key = key;
    }

    stopMusic() {
        if (this.musicTrack) {
            this.musicTrack.stop();
            this.musicTrack = null;
        }
    }

    /**
     * Odtwarza efekt dźwiękowy. Graceful degradation — brak crasha gdy asset nie istnieje.
     */
    playSFX(key, config = {}) {
        if (this.sfxMuted) return;
        if (!this.scene.cache.audio.exists(key)) return;
        this.scene.sound.play(key, { volume: 0.8, ...config });
    }

    toggleMusicMute() {
        this.musicMuted = !this.musicMuted;
        this.saveManager.setAudioSetting('musicMuted', this.musicMuted);

        if (this.musicTrack) {
            if (this.musicMuted) {
                this.musicTrack.pause();
            } else {
                this.musicTrack.resume();
            }
        }
        return this.musicMuted;
    }

    toggleSFXMute() {
        this.sfxMuted = !this.sfxMuted;
        this.saveManager.setAudioSetting('sfxMuted', this.sfxMuted);
        return this.sfxMuted;
    }

    isMusicMuted() { return this.musicMuted; }
    isSFXMuted() { return this.sfxMuted; }
}
