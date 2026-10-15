# 返信ひと言（reply-drafter-x）

気になる人の投稿を貼って、気持ち（6種）と距離感（3段階）を選ぶと、返信の下書きを型の違う3案で出す静的ページです（100日100プロダクト Day070）。

- 貼った投稿と入力はブラウザの中だけで処理し、サーバーには送信せず、保存もしません（通信は閲覧数の計測のみ）
- AIは使っていません（言葉拾いと部品の組み合わせだけ）
- 出力は句読点（。、）なしで、改行で区切ります。3案それぞれの文字数とユニット数を出します
- 相手の投稿の意味を理解して返しているのではありません。送る前に読み直して、自分の言葉に直してください

## 使い方
`index.html` をブラウザで開きます。ビルド不要。

## 開発用
- `index.template.html` と `source/width-table.txt` から `python source/build.py` で `index.html` を作ります
- `node source/run-checks.js`: 生成部分の検算
- `node source/ui-check.js`: Chrome headless での画面の動作確認
- `node source/shoot.js <out>`: 投稿カード用の画面撮影
- `source/gen-width-table.py` / `source/gen-units-fixture.py`: ユニット数の表と固定サンプル（Pythonのunicodedata基準）

運営: みちAIワークス https://michi-portfolio.vercel.app/
