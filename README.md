# 熙望之間｜線上畫展

以 `refs/` 的照片與影片為參考，使用 Blender 製作展場，再透過 Three.js 顯示。保留白色梁架、管線、空調、方柱、展牆、黑色入口門與接待區。場景沒有任何人物，21 件作品均為示意圖。

空間約 10 × 12 公尺的配置是視覺推估，並非測量結果。詳見 [重建判讀](docs/reconstruction.md)。

## 啟動

需要 Node.js 22.12+ 與 pnpm 10。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

開啟終端機顯示的本機網址（預設 `http://127.0.0.1:5173/`）。

```sh
pnpm build     # TypeScript 檢查與正式建置
pnpm preview   # 預覽 dist
pnpm test      # 碰撞、作品位置、GLB 與圖檔一致性
```

`dist/` 可以部署到靜態網站主機。正式建置只包含網頁與 `public/` 資產，不會打包 `refs/` 或 `.blend`。子路徑部署可使用 `pnpm exec vite build --base=/your-path/`，所有執行期模型與圖片網址均會遵守 base。

## 操作

- 滑鼠／單指拖曳環視，點擊畫作開啟原生 DOM `<dialog>` 燈箱。
- 點一下場景或「開始探索」後，使用 WASD／方向鍵移動。
- 手機左下角方向按鈕可持續按住移動，支援 pointer cancel，放開即停止。
- 右下角導覽跳至各展區；平面圖同步顯示位置與朝向。
- 作品目錄提供不依賴 3D 選取的鍵盤瀏覽方式。
- 燈箱支援上一件／下一件、左右方向鍵、Esc、背景點擊及焦點還原。
- 「前往作品位置」會關閉燈箱並定位到作品前方。
- 標準畫質限制 pixel ratio 為 1.25，高畫質上限為 2。

## Blender 模型

- `blender/gallery.blend`：可直接開啟編輯的 Blender 原始檔。
- `blender/build_gallery.py`：建模與資產匯出腳本。
- `public/models/gallery.glb`：Three.js 實際載入的 GLB，約 712 KiB。
- `public/gallery.json`：作品資料、碰撞範圍及場地邊界。
- `public/artworks/*.svg`：本地抽象示意圖，DOM 燈箱與 3D 展品共用。

已使用 Blender 4.5.11 LTS 執行。重新產生：

```sh
pnpm model
```

若 PATH 沒有 Blender，macOS 可執行：

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python blender/build_gallery.py
```

這個指令會覆寫 `.blend`、GLB、`gallery.json` 與全部示意 SVG。若已手動修改模型或替換圖片，請先 commit，或先修改產生腳本再執行。

建模腳本內以 Three.js 的 Y-up 座標定義尺寸，轉換至 Blender 的 Z-up 後建立物件。靜態建築依材質合併，作品保留 `artworkId` extras。GLB 約 5,380 個三角形；入口視角測得約 24 次 draw call（視角會影響裁切結果）。使用小型內嵌混凝土材質、非即時陰影的燈光與簡化接觸陰影。

## 換成正式作品

1. 把圖片放到 `public/artworks/`，建議 WebP／JPEG、長邊約 1,024–2,048 px。
2. 更新 `public/gallery.json` 中對應作品的 `image`、`title`、`description`、`medium`。
3. `id` 必須與 GLB 中的 `artworkId` 相同。
4. 若改變畫框比例、位置或場地尺寸，修改建模腳本並重新匯出；目前前端會將圖片套到固定畫框比例。

若需要在重新建模後仍保留正式內容，應把正式作品資料從產生腳本抽成獨立來源；目前版本的產生器用於建立完整示意場景。

## 已知範圍

目前是依影像推估的簡化空間重建，沒有精確測繪、掃描材質、真實畫作與逐一燈光烘焙。未確認的區域位置採合理配置；不是照片級還原。需要支援 WebGL 2 的瀏覽器；模型或 WebGL 載入失敗時顯示重試介面，若作品資料已載入，仍可從頁首瀏覽 DOM 作品目錄。

## 技術參考

- [Three.js 官方文件](https://threejs.org/docs/)
- [Blender glTF 匯出文件](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html)
