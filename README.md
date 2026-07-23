# ambientloop

`ambientloop` は、Webサイトのサイドバーや小さな余白に置くための軽量なBGMプレーヤーです。

音楽鑑賞用の大きなプレーヤーではなく、サイト閲覧中にBGMや環境音を静かに流す用途を想定しています。WordPressプラグインではなく、HTML、CSS、JavaScriptだけで動作します。

## 特徴

- Vanilla JavaScriptのみで動作
- ES Modules形式の `app.js` をビルドして `public/js/app.min.js` を生成
- WordPressのカスタムHTMLウィジェットに設置しやすい小型UI
- 登録済みの曲をセレクトボックスから選択
- `loopStartMs` と `loopEndMs` による区間ループ
- 2系統の `HTMLAudioElement` と Web Audio API によるクロスフェード
- 曲ごとの基準音量と利用者の音量設定を掛け合わせて再生
- 音量と最後に選択した曲を `localStorage` に保存
- 曲の説明、作者、ライセンス、配布元リンクを開閉式で表示
- 自動再生は行わず、利用者が再生ボタンを押してから再生

## ファイル構成

```text
ambientloop/
├─ public/
│  ├─ data/
│  │  ├─ Calm.mp3
│  │  └─ Calm.txt
│  ├─ index.html
│  ├─ js/
│  │  └─ app.min.js
│  ├─ src/
│  │  └─ app.js
│  └─ styles/
│     └─ app.css
├─ scripts/
│  ├─ package.build.js
│  ├─ package.test.js
│  └─ rollup.config.js
├─ package.json
└─ README.md
```

## 各ファイルの役割

| ファイル | 役割 |
| --- | --- |
| `public/index.html` | ローカル確認用のデモHTML |
| `public/src/app.js` | アプリ本体。曲データ、UI生成、再生制御を実装 |
| `public/js/app.min.js` | `npm run build` で生成される配布用JavaScript |
| `public/styles/app.css` | プレーヤーのデザイン |
| `public/data/` | 確認用の音声ファイルやライセンスメモ |
| `scripts/rollup.config.js` | `app.js` から `app.min.js` を生成するRollup設定 |

## ローカルでの確認

依存関係をインストールします。

```bash
npm install
```

開発中は `public/index.html` が `public/src/app.js` を直接読み込みます。ローカルサーバーを立てて `public/index.html` を開いてください。

```bash
npx serve public
```

配布用の `public/js/app.min.js` を生成する場合は、以下を実行します。

```bash
npm run build
```

ビルド後のファイルを確認したい場合は、`public/index.html` の読み込みを以下のように切り替えます。

```html
<script type="module" src="./js/app.min.js" charset="utf-8"></script>
```

## 基本的な設置方法

HTMLには、プレーヤーを表示したい位置に以下を置きます。

```html
<div class="ambientloop" data-ambientloop>
	<noscript>BGMプレーヤーを利用するにはJavaScriptが必要です。</noscript>
</div>
```

CSSとJavaScriptを読み込みます。

```html
<link rel="stylesheet" href="./styles/app.css" />
<script type="module" src="./js/app.min.js"></script>
```

`app.js` は読み込み時に `[data-ambientloop]` を探し、プレーヤー内部のHTMLを自動生成します。

## WordPressでの使い方

WordPressでは、子テーマなどに以下のように配置する想定です。

```text
your-child-theme/
├─ ambientloop/
│  ├─ app.min.js
│  └─ app.css
```

`functions.php` でCSSとJavaScriptを読み込みます。

```php
<?php
add_action('wp_enqueue_scripts', function () {
	$theme_uri = get_stylesheet_directory_uri();

	wp_enqueue_style(
		'ambientloop',
		$theme_uri . '/ambientloop/app.css',
		array(),
		'0.0.1'
	);

	wp_enqueue_script(
		'ambientloop',
		$theme_uri . '/ambientloop/app.min.js',
		array(),
		'0.0.1',
		true
	);
});
```

`app.min.js` はES Modules形式です。テーマやWordPressの出力に合わせて、必要な場合は `script` タグへ `type="module"` を付与してください。

```php
<?php
add_filter('script_loader_tag', function ($tag, $handle, $src) {
	if ($handle !== 'ambientloop') {
		return $tag;
	}

	return '<script type="module" src="' . esc_url($src) . '"></script>';
}, 10, 3);
```

カスタムHTMLウィジェットには以下だけを貼り付けます。

```html
<div class="ambientloop" data-ambientloop>
	<noscript>BGMプレーヤーを利用するにはJavaScriptが必要です。</noscript>
</div>
```

## 曲の追加方法

曲は `public/src/app.js` の `tracks` 配列に追加します。

```javascript
const tracks = [
	{
		id: "calm",
		title: "Calm",
		src: "./data/Calm.mp3",
		loopStartMs: 0,
		loopEndMs: 23800,
		crossfadeMs: 14150,
		volume: 0.45,
		description: "穏やかな雰囲気のBGM",
		author: "Kamyu",
		license: "DOVA-SYNDROME 音源利用ライセンス",
		sourceUrl: "https://dova-s.jp/bgm/detail/23651"
	}
];
```

変更後は配布用ファイルを再生成します。

```bash
npm run build
```

## 曲設定

| 項目 | 説明 |
| --- | --- |
| `id` | 曲を識別する一意なID |
| `title` | プレーヤーに表示する曲名 |
| `src` | 音声ファイルのURL |
| `loopStartMs` | ループ開始位置。ミリ秒で指定 |
| `loopEndMs` | ループ終了位置。ミリ秒で指定 |
| `crossfadeMs` | クロスフェード時間。ミリ秒で指定 |
| `volume` | 曲ごとの基準音量。`0` から `1` |
| `description` | 曲の説明。省略可 |
| `author` | 作者名。省略可 |
| `license` | ライセンス名。省略可 |
| `sourceUrl` | 配布元または詳細ページのURL。省略可 |

設定値は最低限以下の条件を満たす必要があります。

```text
loopStartMs >= 0
loopEndMs > loopStartMs
crossfadeMs >= 0
crossfadeMs < loopEndMs - loopStartMs
volume >= 0
volume <= 1
```

音声の長さが取得できた後、`loopEndMs` が実際の再生時間を超えている場合は再生を停止してメッセージを表示します。

## ループとクロスフェード

`ambientloop` は、同じ音声ファイルを2つの `HTMLAudioElement` で用意し、交互に再生します。

再生ボタンを押した直後の初回再生は、音声ファイルの先頭 `0ms` から始まります。`loopEndMs` へ近づいた後の繰り返し再生では、次の音声を `loopStartMs` から再生します。

クロスフェード開始位置は以下です。

```text
loopEndMs - crossfadeMs
```

たとえば以下の設定の場合、

```javascript
loopStartMs: 5000,
loopEndMs: 65000,
crossfadeMs: 2000
```

再生は次のようになります。

```text
63000ms:
次の音声を5000msから再生開始

63000msから65000ms:
現在の音声をフェードアウト
次の音声をフェードイン

65000ms:
古い音声を停止
次の音声を通常音量で継続
```

`crossfadeMs` が `0` の場合はクロスフェードせず、`loopEndMs` に到達した時点で `loopStartMs` へ戻ります。

## 音量

利用者はスライダーで音量を変更できます。最終的な音量は、曲ごとの基準音量と利用者の音量設定を掛け合わせます。

```javascript
finalVolume = track.volume * userVolume;
```

利用者の音量設定は `localStorage` に保存され、次回アクセス時に復元されます。

## UIとアクセシビリティ

- 横幅は親要素に合わせて `width: 100%`
- 小さなサイドバーでも崩れにくいレイアウト
- ボタン、セレクト、音量スライダーにラベルまたは `aria-label` を設定
- 再生中はボタン表示と `aria-label` を停止状態へ更新
- フォーカス状態を視認できるアウトラインを表示
- 曲の詳細は `details` と `summary` で開閉
- エラーは `alert()` ではなく小さなメッセージ領域に表示

CSSは `.ambientloop` の内側に限定しており、サイト全体の `button`、`select`、`input` へ影響しないようにしています。色はCSSカスタムプロパティで変更できます。

```css
.ambientloop {
	--ambientloop-text: #25231f;
	--ambientloop-accent: #2f7d6f;
}
```

## JavaScript API

通常は自動初期化だけで利用できます。

```html
<div class="ambientloop" data-ambientloop></div>
```

手動で生成する場合は、ES Moduleとして読み込んでください。

```javascript
import { Ambientloop, tracks } from "./app.js";

const element = document.querySelector("[data-ambientloop]");

if (element instanceof HTMLElement) {
	const player = new Ambientloop(element, {
		tracks
	});
}
```

プレーヤーを破棄する場合は `destroy()` を呼び出します。

```javascript
player.destroy();
```

## 対応形式とブラウザの注意

M4Aは拡張子だけで再生可否が決まるわけではありません。内部コーデックやブラウザの実装に依存します。

`ambientloop` では `canPlayType()` を使って、ブラウザが再生できる可能性を確認します。ただし、すべての環境で完全な再生を保証するものではありません。

Web Audio APIの `AudioContext` は、ブラウザの自動再生制限に従うため、ページ読み込み時には開始しません。利用者が再生ボタンを押したタイミングで作成または再開します。

## 自動再生しない理由

多くのブラウザでは、利用者の操作なしに音声を自動再生することが制限されています。

そのため `ambientloop` は、ページ表示時に前回の曲や音量を復元しても自動再生は行いません。必ず利用者が再生ボタンを押してから再生します。

## ビルド

`public/src/app.js` を編集した後は、以下を実行して配布用ファイルを更新します。

```bash
npm run build
```

出力先は以下です。

```text
public/js/app.min.js
```
