// @ts-check

/**
 * localStorage保存キーの接頭辞
 * @type {string}
 */
const STORAGE_PREFIX = "ambientloop";

/**
 * 利用者音量の初期値
 * @type {number}
 */
const DEFAULT_USER_VOLUME = 0.8;

/**
 * フェード予約時刻の微小オフセット秒
 * @type {number}
 */
const FADE_SCHEDULE_OFFSET_SECONDS = 0.01;

/**
 * BGM曲情報
 * @typedef {object} BgmTrack
 * @property {string} id 曲ID
 * @property {string} title 曲名
 * @property {string} src 音声ファイルURL
 * @property {number} loopStartMs ループ開始位置
 * @property {number} loopEndMs ループ終了位置
 * @property {number} crossfadeMs クロスフェード時間
 * @property {number} volume 基準音量
 * @property {string} [description] 曲の説明
 * @property {string} [author] 作者名
 * @property {string} [license] ライセンス名
 * @property {string} [sourceUrl] 配布元URL
 */

/**
 * プレーヤー設定
 * @typedef {object} AmbientloopOptions
 * @property {BgmTrack[]} tracks 曲一覧
 * @property {string} [storageKey] 保存キー
 */

/**
 * 再生中の音声ノード
 * @typedef {object} PlaybackVoice
 * @property {AudioBufferSourceNode} source 再生ノード
 * @property {GainNode} gain 音量ノード
 * @property {number} startTime 再生開始時刻
 * @property {number} offsetMs 再生開始位置
 */

/**
 * プレーヤー要素群
 * @typedef {object} PlayerElements
 * @property {HTMLButtonElement} playButton 再生ボタン
 * @property {HTMLSelectElement} trackSelect 曲選択
 * @property {HTMLInputElement} volumeInput 音量入力
 * @property {HTMLDetailsElement} details 詳細
 * @property {HTMLDivElement} detailList 詳細一覧
 * @property {HTMLDivElement} message メッセージ
 */

/**
 * 登録曲
 * @type {BgmTrack[]}
 */
const tracks = [
	{
		id: "dark4",
		title: "Dark 4",
		src: "./data/Threshold_of_the_Quiet_Room_1.m4a",
		loopStartMs: 0,
		loopEndMs: 134500,
		crossfadeMs: 1000,
		volume: 1.0,
		author: "maruya328",
		sourceUrl: "https://www.aibgm.jp/search_list_pure.php?q=Threshold+of+the+Quiet+Room"
	},
	{
		id: "sokoniiru",
		title: "そこに、いる",
		src: "./data/sokoni-iru.m4a",
		loopStartMs: 9895,
		loopEndMs: 99867,
		crossfadeMs: 3000,
		volume: 0.5,
		author: "ハシマミ",
		sourceUrl: "https://hashimamiweb.com/freebgm-sokoniiru/"
	},
	{
		id: "norowaretapiano",
		title: "呪われたピアノ",
		src: "./data/norowaretapiano.m4a",
		loopStartMs: 587,
		loopEndMs: 132048,
		crossfadeMs: 10,
		volume: 0.8,
		author: "甘茶",
		sourceUrl: "https://amachamusic.chagasi.com/music_norowaretapiano.html"
	},
	{
		id: "calm",
		title: "Calm",
		src: "./data/Calm.m4a",
		loopStartMs: 4773,
		loopEndMs: 14319 + 100,
		crossfadeMs: 100,
		volume: 0.8,
		description: "穏やかな雰囲気のBGM",
		author: "Kamyu",
		license: "DOVA-SYNDROME 音源利用ライセンス",
		sourceUrl: "https://dova-s.jp/bgm/detail/23651"
	}
];

class Ambientloop {
	/**
	 * アクティブなプレーヤー
	 * @type {Ambientloop | null}
	 */
	static activePlayer = null;

	/**
	 * BGMプレーヤーの生成
	 * @param {HTMLElement} root ルート要素
	 * @param {AmbientloopOptions} options プレーヤー設定
	 */
	constructor(root, options) {
		this.root = root;
		this.tracks = Array.isArray(options.tracks) ? options.tracks.filter((track) => this.isValidTrack(track)) : [];
		this.storageKey = options.storageKey || STORAGE_PREFIX;
		this.audioContext = null;
		this.masterGain = null;
		this.audioBuffer = null;
		this.audioBufferTrackId = "";
		/** @type {PlaybackVoice[]} */
		this.activeVoices = [];
		/** @type {number[]} */
		this.loopTimeoutIds = [];
		this.isPlaying = false;
		this.isCrossfading = false;
		this.playGeneration = 0;
		this.userVolume = this.loadNumber(`${this.storageKey}:volume`, DEFAULT_USER_VOLUME);
		this.selectedTrackId = this.loadText(`${this.storageKey}:trackId`);
		this.selectedTrack = this.findInitialTrack();
		this.elements = this.render();
		this.bindEvents();
		this.updateUi();
	}

	/**
	 * 初期曲の取得
	 * @returns {BgmTrack | null}
	 */
	findInitialTrack() {
		const savedTrack = this.tracks.find((track) => track.id === this.selectedTrackId);
		return savedTrack || this.tracks[0] || null;
	}

	/**
	 * UIの描画
	 * @returns {PlayerElements}
	 */
	render() {
		this.root.textContent = "";

		const inner = this.createElement("div", "ambientloop__inner");
		const trackField = this.createElement("div", "ambientloop__field");
		const trackLabel = this.createElement("label", "ambientloop__label");
		const trackSelect = /** @type {HTMLSelectElement} */ (this.createElement("select", "ambientloop__select"));
		const controls = this.createElement("div", "ambientloop__controls");
		const playButton = /** @type {HTMLButtonElement} */ (this.createElement("button", "ambientloop__button"));
		const volumeField = this.createElement("div", "ambientloop__field");
		const volumeLabel = this.createElement("label", "ambientloop__label");
		const volumeInput = /** @type {HTMLInputElement} */ (this.createElement("input", "ambientloop__volume"));
		const details = /** @type {HTMLDetailsElement} */ (this.createElement("details", "ambientloop__details"));
		const summary = this.createElement("summary", "ambientloop__summary");
		const detailList = /** @type {HTMLDivElement} */ (this.createElement("div", "ambientloop__detail-list"));
		const message = /** @type {HTMLDivElement} */ (this.createElement("div", "ambientloop__message"));
		const controlId = this.createId();
		const volumeId = this.createId();

		trackLabel.textContent = "曲を選択";
		trackLabel.setAttribute("for", controlId);
		trackSelect.id = controlId;
		trackSelect.setAttribute("aria-label", "曲を選択");
		playButton.type = "button";
		volumeLabel.textContent = "音量";
		volumeLabel.setAttribute("for", volumeId);
		volumeInput.id = volumeId;
		volumeInput.type = "range";
		volumeInput.min = "0";
		volumeInput.max = "1";
		volumeInput.step = "0.01";
		volumeInput.value = String(this.userVolume);
		volumeInput.setAttribute("aria-label", "音量");
		summary.textContent = "曲の詳細";
		message.setAttribute("role", "status");
		message.setAttribute("aria-live", "polite");

		this.tracks.forEach((track) => {
			const option = document.createElement("option");
			option.value = track.id;
			option.textContent = track.title;
			trackSelect.append(option);
		});

		trackField.append(trackLabel, trackSelect);
		volumeField.append(volumeLabel, volumeInput);
		controls.append(playButton, volumeField);
		details.append(summary, detailList);
		inner.append(trackField, controls, details, message);
		this.root.append(inner);

		return {
			playButton,
			trackSelect,
			volumeInput,
			details,
			detailList,
			message
		};
	}

	/**
	 * 要素の生成
	 * @param {string} tagName タグ名
	 * @param {string} className クラス名
	 * @returns {HTMLElement}
	 */
	createElement(tagName, className) {
		const element = document.createElement(tagName);
		element.className = className;
		return element;
	}

	/**
	 * IDの生成
	 * @returns {string}
	 */
	createId() {
		return `${this.storageKey}-${Math.random().toString(36).slice(2, 9)}`;
	}

	/**
	 * イベントの登録
	 * @returns {void}
	 */
	bindEvents() {
		this.elements.playButton.addEventListener("click", async () => {
			if (this.isPlaying) {
				this.stop();
				return;
			}
			await this.play();
		});

		this.elements.trackSelect.addEventListener("change", async () => {
			const nextTrack = this.tracks.find((track) => track.id === this.elements.trackSelect.value) || null;
			const shouldResume = this.isPlaying;
			this.stop();
			this.selectedTrack = nextTrack;
			if (nextTrack) {
				this.saveText(`${this.storageKey}:trackId`, nextTrack.id);
			}
			this.updateUi();
			if (shouldResume) {
				await this.play();
			}
		});

		this.elements.volumeInput.addEventListener("input", () => {
			this.userVolume = this.clamp(Number(this.elements.volumeInput.value), 0, 1);
			this.saveNumber(`${this.storageKey}:volume`, this.userVolume);
			this.applyUserVolume();
		});
	}

	/**
	 * 音声再生の開始
	 * @returns {Promise<void>}
	 */
	async play() {
		const track = this.selectedTrack;
		if (!track) {
			this.showMessage("再生できる曲がありません。");
			return;
		}
		if (!this.canPlayTrack(track)) {
			this.showMessage("このブラウザでは選択した音声を再生できない可能性があります。");
			return;
		}

		const generation = ++this.playGeneration;
		try {
			Ambientloop.stopOtherPlayers(this);
			await this.prepareAudioContext();
			if (generation !== this.playGeneration) {
				return;
			}
			this.elements.playButton.disabled = true;
			const audioBuffer = await this.loadAudioBuffer(track);
			if (generation !== this.playGeneration) {
				return;
			}
			this.validateBufferDuration(track, audioBuffer);
			this.stopVoices();
			this.isPlaying = true;
			this.isCrossfading = false;
			Ambientloop.activePlayer = this;
			this.applyUserVolume();
			const startTime = this.audioContext.currentTime + FADE_SCHEDULE_OFFSET_SECONDS;
			const voice = this.createVoice(audioBuffer, 0, this.trackVolume(track), startTime);
			await this.scheduleNextLoop(generation, track, voice);
			this.elements.playButton.disabled = false;
			this.clearMessage();
			this.updateUi();
		} catch (error) {
			this.stop();
			this.showMessage("音声の再生を開始できませんでした。");
			console.error(error);
		}
	}

	/**
	 * 音声再生の停止
	 * @returns {void}
	 */
	stop() {
		this.playGeneration += 1;
		this.isPlaying = false;
		this.isCrossfading = false;
		this.clearLoopTimeouts();
		this.stopVoices();
		if (Ambientloop.activePlayer === this) {
			Ambientloop.activePlayer = null;
		}
		this.elements.playButton.disabled = false;
		this.updateUi();
	}

	/**
	 * プレーヤーの破棄
	 * @returns {void}
	 */
	destroy() {
		this.stop();
		this.root.textContent = "";
		this.audioBuffer = null;
		this.audioBufferTrackId = "";
		if (this.audioContext) {
			this.audioContext.close().catch(() => {});
		}
	}

	/**
	 * 他プレーヤーの停止
	 * @param {Ambientloop} player 再生予定プレーヤー
	 * @returns {void}
	 */
	static stopOtherPlayers(player) {
		if (Ambientloop.activePlayer && Ambientloop.activePlayer !== player) {
			Ambientloop.activePlayer.stop();
		}
	}

	/**
	 * AudioContextの準備
	 * @returns {Promise<void>}
	 */
	async prepareAudioContext() {
		const AudioContextClass = window.AudioContext || window.webkitAudioContext;
		if (!AudioContextClass) {
			throw new Error("AudioContext is not supported.");
		}
		if (!this.audioContext) {
			this.audioContext = new AudioContextClass();
			this.masterGain = this.audioContext.createGain();
			this.masterGain.gain.value = this.userVolume;
			this.masterGain.connect(this.audioContext.destination);
		}
		if (this.audioContext.state === "suspended") {
			await this.audioContext.resume();
		}
	}

	/**
	 * 音声データの読込
	 * @param {BgmTrack} track 曲情報
	 * @returns {Promise<AudioBuffer>}
	 */
	async loadAudioBuffer(track) {
		if (this.audioBuffer && this.audioBufferTrackId === track.id) {
			return this.audioBuffer;
		}
		if (!this.audioContext) {
			throw new Error("AudioContext is not ready.");
		}
		const response = await window.fetch(track.src);
		if (!response.ok) {
			throw new Error(`Audio fetch failed: ${response.status}`);
		}
		const arrayBuffer = await response.arrayBuffer();
		const audioBuffer = await this.decodeAudioData(arrayBuffer);
		this.audioBuffer = audioBuffer;
		this.audioBufferTrackId = track.id;
		return audioBuffer;
	}

	/**
	 * 音声データのデコード
	 * @param {ArrayBuffer} arrayBuffer 音声データ
	 * @returns {Promise<AudioBuffer>}
	 */
	decodeAudioData(arrayBuffer) {
		if (!this.audioContext) {
			return Promise.reject(new Error("AudioContext is not ready."));
		}
		return new Promise((resolve, reject) => {
			const decodeResult = this.audioContext.decodeAudioData(arrayBuffer, resolve, reject);
			if (decodeResult) {
				decodeResult.then(resolve).catch(reject);
			}
		});
	}

	/**
	 * 音声長の検証
	 * @param {BgmTrack} track 曲情報
	 * @param {AudioBuffer} audioBuffer 音声データ
	 * @returns {void}
	 */
	validateBufferDuration(track, audioBuffer) {
		const durationMs = audioBuffer.duration * 1000;
		if (track.loopEndMs > durationMs + 200) {
			throw new Error("Loop end exceeds audio duration.");
		}
	}

	/**
	 * 音声ノードの作成
	 * @param {AudioBuffer} audioBuffer 音声データ
	 * @param {number} offsetMs 再生開始位置
	 * @param {number} volume 音量
	 * @param {number} startTime 再生開始時刻
	 * @returns {PlaybackVoice}
	 */
	createVoice(audioBuffer, offsetMs, volume, startTime) {
		if (!this.audioContext) {
			throw new Error("AudioContext is not ready.");
		}
		const source = this.audioContext.createBufferSource();
		const gain = this.audioContext.createGain();
		source.buffer = audioBuffer;
		gain.gain.setValueAtTime(this.clamp(volume, 0, 1), startTime);
		source.connect(gain);
		gain.connect(this.masterGain || this.audioContext.destination);
		source.start(startTime, Math.max(0, offsetMs / 1000));
		const voice = {
			source,
			gain,
			startTime,
			offsetMs
		};
		this.activeVoices.push(voice);
		source.onended = () => {
			this.removeVoice(voice);
		};
		return voice;
	}

	/**
	 * 次回ループの予約
	 * @param {number} generation 再生世代
	 * @param {BgmTrack} track 曲情報
	 * @param {PlaybackVoice} currentVoice 現在の音声ノード
	 * @returns {Promise<void>}
	 */
	async scheduleNextLoop(generation, track, currentVoice) {
		if (!this.audioContext || !this.audioBuffer || generation !== this.playGeneration) {
			return;
		}
		const trackVolume = this.trackVolume(track);
		const loopEndTime = currentVoice.startTime + (track.loopEndMs - currentVoice.offsetMs) / 1000;
		const fadeStartTime =
			track.crossfadeMs > 0
				? currentVoice.startTime + (track.loopEndMs - track.crossfadeMs - currentVoice.offsetMs) / 1000
				: loopEndTime;
		if (fadeStartTime <= this.audioContext.currentTime) {
			this.stop();
			this.showMessage("ループ開始の予約が間に合いませんでした。");
			return;
		}
		if (track.crossfadeMs > 0) {
			const nextVoice = this.createVoice(this.audioBuffer, track.loopStartMs, 0, fadeStartTime);
			this.scheduleEqualPowerFade(currentVoice.gain, trackVolume, 0, fadeStartTime, track.crossfadeMs / 1000);
			this.scheduleEqualPowerFade(nextVoice.gain, 0, trackVolume, fadeStartTime, track.crossfadeMs / 1000);
			currentVoice.source.stop(loopEndTime + FADE_SCHEDULE_OFFSET_SECONDS);
			this.setLoopTimeout(() => {
				if (generation === this.playGeneration) {
					this.isCrossfading = true;
				}
			}, fadeStartTime);
			this.setLoopTimeout(() => {
				if (generation !== this.playGeneration) {
					return;
				}
				this.isCrossfading = false;
				this.scheduleNextLoop(generation, track, nextVoice).catch((error) => {
					this.stop();
					this.showMessage("ループ再生中に問題が発生しました。");
					console.error(error);
				});
			}, loopEndTime);
			return;
		}
		const nextVoice = this.createVoice(this.audioBuffer, track.loopStartMs, trackVolume, loopEndTime);
		currentVoice.source.stop(loopEndTime + FADE_SCHEDULE_OFFSET_SECONDS);
		this.setLoopTimeout(() => {
			if (generation !== this.playGeneration) {
				return;
			}
			this.scheduleNextLoop(generation, track, nextVoice).catch((error) => {
				this.stop();
				this.showMessage("ループ再生中に問題が発生しました。");
				console.error(error);
			});
		}, loopEndTime);
	}

	/**
	 * イコールパワー風フェードの予約
	 * @param {GainNode | null} gain 音量ノード
	 * @param {number} from 開始音量
	 * @param {number} to 終了音量
	 * @param {number} startTime 開始時刻
	 * @param {number} duration 所要時間
	 * @returns {void}
	 */
	scheduleEqualPowerFade(gain, from, to, startTime, duration) {
		if (!gain) {
			return;
		}
		gain.gain.cancelScheduledValues(0);
		gain.gain.setValueAtTime(from, startTime);
		const steps = 16;
		for (let step = 1; step <= steps; step += 1) {
			const ratio = step / steps;
			const curveRatio = to > from ? Math.sin((ratio * Math.PI) / 2) : Math.cos((ratio * Math.PI) / 2);
			const value = to > from ? to * curveRatio : from * curveRatio;
			gain.gain.linearRampToValueAtTime(value, startTime + duration * ratio);
		}
	}

	/**
	 * ループタイマーの予約
	 * @param {() => void} callback 処理
	 * @param {number} targetTime 実行時刻
	 * @returns {void}
	 */
	setLoopTimeout(callback, targetTime) {
		if (!this.audioContext) {
			return;
		}
		const delayMs = Math.max(0, (targetTime - this.audioContext.currentTime) * 1000);
		const timeoutId = window.setTimeout(() => {
			this.loopTimeoutIds = this.loopTimeoutIds.filter((id) => id !== timeoutId);
			callback();
		}, delayMs);
		this.loopTimeoutIds.push(timeoutId);
	}

	/**
	 * ループタイマーの解除
	 * @returns {void}
	 */
	clearLoopTimeouts() {
		this.loopTimeoutIds.forEach((timeoutId) => {
			window.clearTimeout(timeoutId);
		});
		this.loopTimeoutIds = [];
	}

	/**
	 * 音声ノードの停止
	 * @returns {void}
	 */
	stopVoices() {
		this.activeVoices.forEach((voice) => {
			voice.gain.gain.cancelScheduledValues(0);
			try {
				voice.source.stop();
			} catch (_error) {}
		});
		this.activeVoices = [];
	}

	/**
	 * 音声ノードの削除
	 * @param {PlaybackVoice} voice 音声ノード
	 * @returns {void}
	 */
	removeVoice(voice) {
		this.activeVoices = this.activeVoices.filter((activeVoice) => activeVoice !== voice);
	}

	/**
	 * 利用者音量の適用
	 * @returns {void}
	 */
	applyUserVolume() {
		if (!this.audioContext || !this.masterGain) {
			return;
		}
		this.masterGain.gain.cancelScheduledValues(0);
		this.masterGain.gain.setValueAtTime(this.userVolume, this.audioContext.currentTime);
	}

	/**
	 * 曲の内部音量の取得
	 * @param {BgmTrack} track 曲情報
	 * @returns {number}
	 */
	trackVolume(track) {
		return this.clamp(track.volume, 0, 1);
	}

	/**
	 * UIの更新
	 * @returns {void}
	 */
	updateUi() {
		const track = this.selectedTrack;
		this.elements.playButton.textContent = this.isPlaying ? "■ 停止" : "▶ 再生";
		this.elements.playButton.setAttribute("aria-label", this.isPlaying ? "BGMを停止" : "BGMを再生");
		this.elements.playButton.disabled = this.elements.playButton.disabled || !track;
		this.elements.trackSelect.value = track ? track.id : "";
		this.elements.trackSelect.disabled = this.tracks.length === 0;
		this.renderDetails(track);
	}

	/**
	 * 詳細情報の描画
	 * @param {BgmTrack | null} track 曲情報
	 * @returns {void}
	 */
	renderDetails(track) {
		this.elements.detailList.textContent = "";
		if (!track) {
			this.elements.details.hidden = true;
			return;
		}
		this.elements.details.hidden = false;
		this.appendDetail("曲名", track.title);
		this.appendDetail("説明", track.description || "");
		this.appendDetail("作者", track.author || "");
		this.appendDetail("ライセンス", track.license || "");
		if (track.sourceUrl && this.isSafeUrl(track.sourceUrl)) {
			const link = document.createElement("a");
			link.className = "ambientloop__link";
			link.href = track.sourceUrl;
			link.target = "_blank";
			link.rel = "noopener noreferrer";
			link.textContent = "詳細ページ";
			this.appendDetailElement("配布元", link);
		}
	}

	/**
	 * 詳細行の追加
	 * @param {string} term 項目名
	 * @param {string} value 値
	 * @returns {void}
	 */
	appendDetail(term, value) {
		if (!value) {
			return;
		}
		const text = document.createElement("span");
		text.textContent = value;
		this.appendDetailElement(term, text);
	}

	/**
	 * 詳細要素の追加
	 * @param {string} term 項目名
	 * @param {HTMLElement} valueElement 値要素
	 * @returns {void}
	 */
	appendDetailElement(term, valueElement) {
		const row = this.createElement("div", "ambientloop__detail-row");
		const termElement = this.createElement("span", "ambientloop__detail-term");
		const value = this.createElement("p", "ambientloop__detail-value");
		termElement.textContent = term;
		value.append(valueElement);
		row.append(termElement, value);
		this.elements.detailList.append(row);
	}

	/**
	 * 曲データの検証
	 * @param {unknown} track 曲候補
	 * @returns {track is BgmTrack}
	 */
	isValidTrack(track) {
		if (!track || typeof track !== "object") {
			return false;
		}
		const data = /** @type {BgmTrack} */ (track);
		const loopLength = data.loopEndMs - data.loopStartMs;
		return (
			typeof data.id === "string" &&
			data.id.length > 0 &&
			typeof data.title === "string" &&
			data.title.length > 0 &&
			typeof data.src === "string" &&
			this.isSafeUrl(data.src) &&
			Number.isFinite(data.loopStartMs) &&
			Number.isFinite(data.loopEndMs) &&
			Number.isFinite(data.crossfadeMs) &&
			Number.isFinite(data.volume) &&
			data.loopStartMs >= 0 &&
			data.loopEndMs > data.loopStartMs &&
			data.crossfadeMs >= 0 &&
			data.crossfadeMs < loopLength &&
			data.volume >= 0 &&
			data.volume <= 1
		);
	}

	/**
	 * URLの検証
	 * @param {string} url URL
	 * @returns {boolean}
	 */
	isSafeUrl(url) {
		try {
			const parsedUrl = new URL(url, window.location.href);
			return ["http:", "https:", "file:"].includes(parsedUrl.protocol);
		} catch (_error) {
			return false;
		}
	}

	/**
	 * 再生可否の確認
	 * @param {BgmTrack} track 曲情報
	 * @returns {boolean}
	 */
	canPlayTrack(track) {
		const audio = document.createElement("audio");
		const extension = track.src.split("?")[0].split(".").pop();
		if (extension === "m4a") {
			return audio.canPlayType("audio/mp4") !== "";
		}
		if (extension === "mp3") {
			return audio.canPlayType("audio/mpeg") !== "";
		}
		return true;
	}

	/**
	 * 数値の範囲制限
	 * @param {number} value 値
	 * @param {number} min 最小値
	 * @param {number} max 最大値
	 * @returns {number}
	 */
	clamp(value, min, max) {
		if (!Number.isFinite(value)) {
			return min;
		}
		return Math.min(max, Math.max(min, value));
	}

	/**
	 * 数値の読込
	 * @param {string} key キー
	 * @param {number} fallback 既定値
	 * @returns {number}
	 */
	loadNumber(key, fallback) {
		try {
			const value = Number(window.localStorage.getItem(key));
			return Number.isFinite(value) ? this.clamp(value, 0, 1) : fallback;
		} catch (_error) {
			return fallback;
		}
	}

	/**
	 * 文字列の読込
	 * @param {string} key キー
	 * @returns {string}
	 */
	loadText(key) {
		try {
			return window.localStorage.getItem(key) || "";
		} catch (_error) {
			return "";
		}
	}

	/**
	 * 数値の保存
	 * @param {string} key キー
	 * @param {number} value 値
	 * @returns {void}
	 */
	saveNumber(key, value) {
		try {
			window.localStorage.setItem(key, String(value));
		} catch (_error) {}
	}

	/**
	 * 文字列の保存
	 * @param {string} key キー
	 * @param {string} value 値
	 * @returns {void}
	 */
	saveText(key, value) {
		try {
			window.localStorage.setItem(key, value);
		} catch (_error) {}
	}

	/**
	 * メッセージの表示
	 * @param {string} message メッセージ
	 * @returns {void}
	 */
	showMessage(message) {
		this.elements.message.textContent = message;
	}

	/**
	 * メッセージの消去
	 * @returns {void}
	 */
	clearMessage() {
		this.elements.message.textContent = "";
	}
}

document.querySelectorAll("[data-ambientloop]").forEach((element) => {
	if (element instanceof HTMLElement) {
		new Ambientloop(element, {
			tracks
		});
	}
});

export { Ambientloop, tracks };
