# 返信ひと言（reply-drafter-x）

気になる人の投稿を貼って、気持ち（6種）と距離感（3段階）を選ぶと、返信の下書きを型の違う3案で出す静的ページです（100日100プロダクト Day070）。

- 標準では、貼った投稿と入力はブラウザの中だけで処理し、サーバーには送信せず、保存もしません（通信は閲覧数の計測のみ）
- 標準の下書きはAIを使いません（言葉拾いと部品の組み合わせだけ）
- 任意機能: PCのOllamaが使える環境では「AIで作り直す」が出ます（下の「Ollama強化モード」）
- 出力は句読点（。、）なしで、改行で区切ります。3案それぞれの文字数とユニット数を出します
- 相手の投稿の意味を理解して返しているのではありません。送る前に読み直して、自分の言葉に直してください

## Ollama強化モード（任意・PC向け）
- 画面を開いたとき `http://localhost:11434/api/tags` を2秒だけ試し、使えれば「AIで作り直す」とモデル選択（既定 qwen2.5:7b）を出す。使えなければ折りたたみの案内（許可設定 `OLLAMA_ORIGINS` に **このページのアドレスだけ** を入れる手順）を出す
- 1回の呼び出しで3案を作り、後処理（句読点・記号の除去／NG語／数字と「」の語が元の投稿・メモ・言葉入力にあるかの事実ガード／長さ／距離感の簡易判定）を通った案だけ「AIの案」として出す。不合格が2案以上なら1回だけ再生成し、それでも不合格の案はルールベースの同じ型の案に差し替える
- 通信先は localhost:11434 だけ。履歴は保存しない。経過秒数の表示・中止ボタン・1回60秒で打ち切り
- Safari・iPhone・Androidでは動かない可能性が高い（https のページから http://localhost への通信）。モデルの文の品質は保証しない

## 使い方
`index.html` をブラウザで開きます。ビルド不要。

## 開発用
- `index.template.html` と `source/width-table.txt` から `python source/build.py` で `index.html` を作ります
- `node source/run-checks.js`: 生成部分の検算
- `node source/ui-check.js`: Chrome headless での画面の動作確認（Ollamaなしの従来動作）
- `node source/ui-check-ollama.js [--skip-timeout]`: 偽のOllamaサーバー（`source/fake-ollama.js`）での強化モードの画面確認。60秒打ち切りの確認は実時間で約1分かかる
- `node source/real-model-check.js [モデル名]`: 本物のOllamaで後処理の通過率と所要時間を記録（Originなしで直接呼ぶ。Ollamaの設定は変更しない）
- `node source/shoot.js <out>`: 投稿カード用の画面撮影
- `source/gen-width-table.py` / `source/gen-units-fixture.py`: ユニット数の表と固定サンプル（Pythonのunicodedata基準）

運営: みちAIワークス https://michi-portfolio.vercel.app/
