# 2DAction.bench

`prompt.md` を複数のモデルに実装させた、ブラウザ向け2Dアクションゲームのベンチマーク集です。

## 結果ギャラリー

ルートの `index.html` をブラウザで開くと、全モデルのゲーム画面と評価ステータスを一覧できます。各カードからゲームを起動し、`Pass` / `Partial` / `Fail` / `未評価` の変更とテストメモの入力ができます。

- 評価の変更はブラウザのローカルストレージへ自動保存されます。
- 「JSONを書き出す」で現在の結果を `benchmarks.json` として保存できます。
- 「JSONを読み込む」で別の評価結果を復元できます。
- ローカルWebサーバー経由では `benchmarks.json` を自動で読み込みます。`index.html` を直接開いた場合も、組み込みの初期データで動作します。

各モデルのゲーム自体は、それぞれのディレクトリにある `index.html` を直接開いてプレイできます。

## モデルを追加する

新しいモデルのディレクトリに `index.html` と `game.js` を配置し、ルートで次を実行します。

```bash
python3 sync_benchmarks.py
```

スクリプトがモデル用ディレクトリを自動検出し、HTMLのタイトル、ゲームへのリンク、不足しているスクリーンショットを追加して `benchmarks.json` と `benchmarks-data.js` を更新します。既存モデルの評価ステータスとメモは保持されます。

全スクリーンショットを撮り直す場合は `python3 sync_benchmarks.py --refresh-screenshots`、メタデータだけを更新する場合は `python3 sync_benchmarks.py --no-screenshots` を使います。スクリーンショットの自動生成はmacOSの `qlmanage` を利用します。

## 備考

- モデルに思考量の設定がある場合は、全てミディアムで実行しています。
