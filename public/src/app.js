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
 * 音声系統
 * @typedef {object} AudioDeck
 * @property {HTMLAudioElement} audio 音声要素
 * @property {MediaElementAudioSourceNode | null} source 音声ソース
 * @property {GainNode | null} gain 音量ノード
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
		this.decks = [this.createDeck(), this.createDeck()];
		this.activeDeckIndex = 0;
		this.isPlaying = false;
		this.isCrossfading = false;
		this.animationFrameId = 0;
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
	 * 音声系統の生成
	 * @returns {AudioDeck}
	 */
	createDeck() {
		const audio = new Audio();
		audio.preload = "auto";
		audio.crossOrigin = "anonymous";
		return {
			audio,
			source: null,
			gain: null
		};
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
			this.applyCurrentVolume();
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
			this.resetDecks(track);
			this.setDeckGain(0, this.finalVolume(track));
			this.setDeckGain(1, 0);
			this.activeDeckIndex = 0;
			this.isPlaying = true;
			this.isCrossfading = false;
			Ambientloop.activePlayer = this;
			this.elements.playButton.disabled = true;
			await this.startDeck(this.decks[0], 0);
			if (generation !== this.playGeneration) {
				return;
			}
			this.elements.playButton.disabled = false;
			this.clearMessage();
			this.updateUi();
			this.startLoopMonitor(generation);
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
		this.stopLoopMonitor();
		this.decks.forEach((deck) => {
			deck.audio.pause();
			this.seekDeck(deck, this.selectedTrack ? this.selectedTrack.loopStartMs : 0);
			if (deck.gain) {
				deck.gain.gain.cancelScheduledValues(0);
				deck.gain.gain.setValueAtTime(0, this.audioContext ? this.audioContext.currentTime : 0);
			}
		});
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
		this.decks.forEach((deck) => {
			deck.audio.removeAttribute("src");
			deck.audio.load();
		});
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
			this.decks.forEach((deck) => {
				deck.source = this.audioContext.createMediaElementSource(deck.audio);
				deck.gain = this.audioContext.createGain();
				deck.gain.gain.value = 0;
				deck.source.connect(deck.gain);
				deck.gain.connect(this.audioContext.destination);
			});
		}
		if (this.audioContext.state === "suspended") {
			await this.audioContext.resume();
		}
	}

	/**
	 * デッキの曲設定
	 * @param {BgmTrack} track 曲情報
	 * @returns {void}
	 */
	resetDecks(track) {
		this.decks.forEach((deck) => {
			deck.audio.pause();
			if (deck.audio.src !== new URL(track.src, window.location.href).href) {
				deck.audio.src = track.src;
				deck.audio.load();
			}
			this.seekDeck(deck, track.loopStartMs);
		});
	}

	/**
	 * デッキ再生の開始
	 * @param {AudioDeck} deck 音声系統
	 * @param {number} startMs 開始位置
	 * @returns {Promise<void>}
	 */
	async startDeck(deck, startMs) {
		this.seekDeck(deck, startMs);
		await deck.audio.play();
	}

	/**
	 * デッキ位置の変更
	 * @param {AudioDeck} deck 音声系統
	 * @param {number} positionMs 再生位置
	 * @returns {void}
	 */
	seekDeck(deck, positionMs) {
		const positionSeconds = Math.max(0, positionMs / 1000);
		try {
			deck.audio.currentTime = positionSeconds;
		} catch (_error) {}
	}

	/**
	 * ループ監視の開始
	 * @param {number} generation 再生世代
	 * @returns {void}
	 */
	startLoopMonitor(generation) {
		const monitor = () => {
			if (!this.isPlaying || generation !== this.playGeneration || !this.selectedTrack) {
				return;
			}
			this.checkLoop(generation).catch((error) => {
				this.stop();
				this.showMessage("ループ再生中に問題が発生しました。");
				console.error(error);
			});
			this.animationFrameId = window.requestAnimationFrame(monitor);
		};
		this.stopLoopMonitor();
		this.animationFrameId = window.requestAnimationFrame(monitor);
	}

	/**
	 * ループ監視の停止
	 * @returns {void}
	 */
	stopLoopMonitor() {
		if (this.animationFrameId) {
			window.cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = 0;
		}
	}

	/**
	 * ループ状態の確認
	 * @param {number} generation 再生世代
	 * @returns {Promise<void>}
	 */
	async checkLoop(generation) {
		const track = this.selectedTrack;
		if (!track || this.isCrossfading) {
			return;
		}

		const activeDeck = this.decks[this.activeDeckIndex];
		const currentMs = activeDeck.audio.currentTime * 1000;
		if (Number.isFinite(activeDeck.audio.duration)) {
			const durationMs = activeDeck.audio.duration * 1000;
			if (track.loopEndMs > durationMs + 200) {
				this.stop();
				this.showMessage("ループ終了位置が音声の長さを超えています。");
				return;
			}
		}

		const crossfadeStartMs = track.loopEndMs - track.crossfadeMs;
		if (track.crossfadeMs > 0 && currentMs >= crossfadeStartMs) {
			await this.crossfade(generation, track);
			return;
		}
		if (track.crossfadeMs === 0 && currentMs >= track.loopEndMs) {
			this.seekDeck(activeDeck, track.loopStartMs);
		}
	}

	/**
	 * クロスフェードの実行
	 * @param {number} generation 再生世代
	 * @param {BgmTrack} track 曲情報
	 * @returns {Promise<void>}
	 */
	async crossfade(generation, track) {
		if (!this.audioContext) {
			return;
		}
		this.isCrossfading = true;
		const currentIndex = this.activeDeckIndex;
		const nextIndex = currentIndex === 0 ? 1 : 0;
		const currentDeck = this.decks[currentIndex];
		const nextDeck = this.decks[nextIndex];
		const finalVolume = this.finalVolume(track);
		const now = this.audioContext.currentTime + FADE_SCHEDULE_OFFSET_SECONDS;
		const duration = track.crossfadeMs / 1000;
		this.setDeckGain(nextIndex, 0);
		await this.startDeck(nextDeck, track.loopStartMs);
		if (generation !== this.playGeneration) {
			return;
		}
		this.scheduleEqualPowerFade(currentDeck.gain, finalVolume, 0, now, duration);
		this.scheduleEqualPowerFade(nextDeck.gain, 0, finalVolume, now, duration);
		window.setTimeout(() => {
			if (generation !== this.playGeneration) {
				return;
			}
			currentDeck.audio.pause();
			this.seekDeck(currentDeck, track.loopStartMs);
			this.setDeckGain(currentIndex, 0);
			this.setDeckGain(nextIndex, finalVolume);
			this.activeDeckIndex = nextIndex;
			this.isCrossfading = false;
		}, track.crossfadeMs + 80);
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
	 * 現在音量の適用
	 * @returns {void}
	 */
	applyCurrentVolume() {
		if (!this.selectedTrack) {
			return;
		}
		const finalVolume = this.finalVolume(this.selectedTrack);
		this.decks.forEach((deck, index) => {
			if (index === this.activeDeckIndex && this.isPlaying && !this.isCrossfading) {
				this.setDeckGain(index, finalVolume);
			}
		});
	}

	/**
	 * デッキ音量の設定
	 * @param {number} index デッキ番号
	 * @param {number} volume 音量
	 * @returns {void}
	 */
	setDeckGain(index, volume) {
		const deck = this.decks[index];
		if (!deck.gain || !this.audioContext) {
			return;
		}
		deck.gain.gain.cancelScheduledValues(0);
		deck.gain.gain.setValueAtTime(this.clamp(volume, 0, 1), this.audioContext.currentTime);
	}

	/**
	 * 最終音量の取得
	 * @param {BgmTrack} track 曲情報
	 * @returns {number}
	 */
	finalVolume(track) {
		return this.clamp(track.volume * this.userVolume, 0, 1);
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
