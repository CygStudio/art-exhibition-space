# 熙望之間｜線上畫展

以 `refs/` 的照片與影片為參考，使用 Blender 製作展場，再透過 Three.js 顯示。依使用者標註平面圖配置白色梁架、方柱、展牆、服務台、獨立簽到桌與黑框落地窗；右上隔間保留入場門口與通道，進場後右側為服務台，前方柱子有含框約 145 公分高的落地畫作。場景沒有任何人物，21 件作品均為示意圖，其中 19 件可開啟詳情、2 張大型背板僅展示。

外框約 10.8 × 10.2 公尺，扣除右上房間後主空間約 98.6 平方公尺。入口依使用者補充確認，尺寸仍是推估，並非測量結果。詳見 [影片與平面圖修正依據](docs/scene-correction.md) 及 [重建判讀](docs/reconstruction.md)。

## 啟動

需要 Node.js 22.18+ 與 pnpm 10。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

開啟終端機顯示的本機網址（預設 `http://127.0.0.1:5173/`）。

手機測試時，讓手機與電腦連上同一個區域網路，停止原本的 dev server 後執行 `pnpm dev:lan`，再於手機開啟終端機顯示的 Network 網址。此指令監聽 `0.0.0.0:5173`；若連接埠已被占用會直接提示，避免測試網址悄悄變動。

```sh
pnpm build     # TypeScript 檢查與正式建置
pnpm preview   # 預覽 dist
pnpm test      # 碰撞、作品位置、GLB 與圖檔一致性
```

`dist/` 可以部署到靜態網站主機。正式建置只包含網頁與 `public/` 資產，不會打包 `refs/` 或 `.blend`。子路徑部署可使用 `pnpm exec vite build --base=/your-path/`，所有執行期模型與圖片網址均會遵守 base。

## 操作

- 滑鼠／單指拖曳環視，點擊畫作開啟原生 DOM `<dialog>` 燈箱。
- 點擊空曠地板後，攝影機會沿可通行路線平順前進；目的地以圓環標示，沿途避開柱子與桌子。
- 拖曳、使用方向鍵、切換展區、開啟燈箱或離開頁面焦點，會停止自動移動。無法到達的位置會顯示提示。
- 啟用系統「減少動態效果」時，點地板直接切換至可到達的目的地。
- 點一下場景或「開始探索」後，使用 WASD／方向鍵移動。
- 手機左下角方向按鈕可持續按住移動，支援 pointer cancel，放開即停止。
- 右下角提供主展牆、左側展牆、隔間外展牆、服務台、簽到簿、落地窗六個導覽站位。鏡頭垂直視角為 72°，平面圖從模型匯出的配置資料繪製，同步顯示位置與朝向。
- 作品目錄提供不依賴 3D 選取的鍵盤瀏覽方式。
- 燈箱支援上一件／下一件、左右方向鍵、Esc、背景點擊及焦點還原。
- 「前往作品位置」會關閉燈箱並定位到作品前方。
- 標準畫質限制 pixel ratio 為 1.25，高畫質上限為 2。

## Blender 模型

- `blender/gallery.blend`：可直接開啟編輯的 Blender 原始檔。
- `blender/build_gallery.py`：建模與資產匯出腳本。
- `public/models/gallery.glb`：Three.js 實際載入的 GLB，約 765 KiB。
- `public/gallery.json`：作品資料、安全定位點、碰撞範圍、場地邊界與平面配置。
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

建模腳本內以 Three.js 的 Y-up 座標定義尺寸，轉換至 Blender 的 Z-up 後建立物件。靜態建築依材質合併，作品保留 `artworkId` extras。視角會影響實際繪製量；先前落地窗版本的繪製量見驗證文件；門洞與作品更新後數值會不同。網頁透過 `src/environment.ts` 將建築材質轉為共用的 `MeshToonMaterial`，搭配三階明暗、奶油色牆面、灰紫色梁架／地板與細描邊。原始 GLB 的混凝土材質保留在資產內，網頁不使用其噪點貼圖；接觸陰影改為平塗色塊。作品圖片維持原色，落地窗保留透明玻璃及簡化窗外環境色。

## 調整導覽與風格

- `src/environment.ts`：共用色票、三階 gradient map、描邊與燈光。
- `src/artwork.ts`：作品資料契約與 `detailsEnabled` 詳情開關；背板不進入目錄或上下件切換。
- `src/stations.ts`：六個導覽站位與朝向。
- `src/floor-plan.ts`：以匯出的 `layout` 繪製平面圖與轉換目前位置。
- `src/navigation.mjs`：攝影機碰撞及地板移動路線；以障礙物外側轉折點建立可通行路線，檢查整段攝影機半徑。
- `src/main.ts`：點選、目的地標記、攝影機動畫及燈箱。

## 換成正式作品

1. 把圖片放到 `public/artworks/`，建議 WebP／JPEG、長邊約 1,024–2,048 px。
2. 更新 `public/gallery.json` 中對應作品的 `image`、`title`、`description`、`medium`。
3. `id` 必須與 GLB 中的 `artworkId` 相同；`detailsEnabled` 必須是 boolean。設為 `false` 時仍渲染且遮擋射線，但不顯示點擊提示、不開啟詳情，也不列入目錄或上下件切換。
4. 若改變畫框比例、位置或場地尺寸，修改建模腳本並重新匯出；目前前端會將圖片套到固定畫框比例。

若需要在重新建模後仍保留正式內容，應把正式作品資料從產生腳本抽成獨立來源；目前版本的產生器用於建立完整示意場景。

## 已知範圍

目前是依影像推估的簡化空間重建，沒有精確測繪、掃描材質、真實畫作與逐一燈光烘焙。標註的四個區域依使用者說明配置；入口位置已確認，家具細節與其他尺寸仍有推估。不是照片級還原。需要支援 WebGL 2 的瀏覽器；模型或 WebGL 載入失敗時顯示重試介面，若作品資料已載入，仍可從頁首瀏覽 DOM 作品目錄。

## 技術參考

- [Three.js 官方文件](https://threejs.org/docs/)
- [MeshToonMaterial 官方文件](https://threejs.org/docs/pages/MeshToonMaterial.html)
- [Blender glTF 匯出文件](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html)
