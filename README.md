# 熙望之間｜線上畫展

以 `refs/` 的照片與影片為參考，使用 Blender 製作展場，再透過 Three.js 顯示。依使用者標註平面圖配置白色梁架、方柱、展牆、服務台、獨立簽到桌與黑框落地窗；右上隔間保留入場門口與通道，進場後右側為服務台，門洞位於服務台旁的隔間左側牆。前方柱子懸掛長條無框畫，旁有黃色身高尺；畫作上緣約 180 公分、中心約 145 公分。場景不加入人物模型；27 件掛畫使用原始圖檔，依現場照片與影片校正順序、比例及位置，均可開啟詳情。簽到桌紅旗與服務台背板使用現場影像對位，僅作展示。另有 2 件 For Adam 素材尚無可確認的位置，未任意放入場景。

外框約 10.8 × 10.2 公尺，扣除右上房間後主空間約 98.6 平方公尺。入口依使用者補充確認，尺寸仍是推估，並非測量結果。本次作品比對與短牆修正詳見 [原始作品配置](docs/artwork-placement.md)。早期模型紀錄見 [影片與平面圖修正依據](docs/scene-correction.md) 及 [重建判讀](docs/reconstruction.md)。

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
- `public/models/gallery.glb`：Three.js 實際載入的 GLB，約 1.05 MB，內嵌作品小預覽；清晰貼圖不阻塞進場。
- `public/gallery.json`：作品資料、安全定位點、碰撞範圍、場地邊界與平面配置。
- `blender/artwork-layout.json`：作品來源、繪師、尺寸、基準配置與比對依據；建模腳本依加深後的牆面轉換 Z 座標，柱畫不移動。
- `blender/artwork-assets.json`：原始檔 SHA-256、像素尺寸、色彩轉換及衍生圖紀錄。
- `blender/textures/`：完整模型貼圖，打包進可編輯的 `.blend`。
- `blender/previews/`：長邊最多 128 px 的作品預覽，打包進網站 GLB；另有三張小型桌上展示圖。
- `public/artworks/scene/`：長邊最多 1,024 px 的場景貼圖，通常為品質 88／90 的 WebP；紅色細線較多的 lllokkk 直幅保留 JPEG 4:4:4。
- `public/artworks/thumbnails/`：長邊最多 320 px 的作品目錄縮圖。場景圖及縮圖檔名包含內容雜湊。
- `public/artworks/*.webp`：長邊最多 2,048 px 的詳情圖，維持原始比例。
- `public/artworks/guestbook-flag.svg`：依參考簡化的紅黑平面旗幟，不含光影；`service-backdrop.webp` 為已校正四角的背板影格。
- `refs/column-reference.png`：先前使用的柱畫參考照片，移回參考資料，不再打包至網站。

已使用 Blender 4.5.11 LTS 執行。重新產生：

```sh
pnpm model
```

若 PATH 沒有 Blender，macOS 可執行：

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python blender/build_gallery.py
```

這個指令會依作品配置清單與既有貼圖，覆寫 `.blend`、GLB 與 `gallery.json`；不會重新產生示意圖。若已手動修改模型或替換圖片，請先 commit，或先修改產生腳本再執行。

建模腳本內以 Three.js 的 Y-up 座標定義尺寸，轉換至 Blender 的 Z-up 後建立物件。靜態建築依材質合併，作品保留 `artworkId` extras。網頁透過 `src/environment.ts` 將建築材質轉為共用的 `MeshToonMaterial`，搭配三階明暗、奶油色牆面、灰紫色梁架／地板與細描邊。混凝土噪點只保留在 `.blend`，不匯出至網站；接觸陰影使用平塗色塊。作品與桌上展示圖維持原色，落地窗保留透明玻璃及簡化窗外環境色。

## 調整導覽與風格

- `src/environment.ts`：共用色票、三階 gradient map、描邊與燈光。
- `src/artwork.ts`：作品資料契約與 `detailsEnabled` 詳情開關；背板不進入目錄或上下件切換。
- `src/artwork-textures.ts`：以視野及距離排序清晰貼圖，每次最多三個請求；失敗保留預覽並退避重試，成功後釋放預覽資源。
- `src/stations.ts`：六個導覽站位與朝向。
- `src/floor-plan.ts`：以匯出的 `layout` 繪製平面圖與轉換目前位置。
- `src/navigation.mjs`：攝影機碰撞及地板移動路線；以障礙物外側轉折點建立可通行路線，檢查整段攝影機半徑。
- `src/main.ts`：點選、目的地標記、攝影機動畫及燈箱。

## 更新作品與重新匯出

1. 在 `blender/artwork-layout.json` 更新作品來源、署名、比例、位置與比對依據。
2. 原始素材變更時，使用含 Pillow、ImageCms 的 Python 執行 `scripts/prepare-artworks.py`，唯一參數為原始素材資料夾路徑；另需 ffmpeg。PNG 透明區域以白底呈現，內嵌 ICC 轉為 sRGB，PSD 讀取合成圖層。原始檔保持不變。旗幟修改後執行 `node scripts/render-flag.mjs`（需可解析的 `sharp` 套件），再執行圖片處理腳本；桌上展示圖可執行 `python3 scripts/prepare-desk-displays.py` 重新擷取。
3. 執行 `pnpm model`，再執行 `pnpm test` 與 `pnpm build`。配置與網頁資料由同一來源產生，重新建模不會遺失正式圖片。
4. `detailsEnabled=false` 的兩張背板仍渲染、遮擋射線，但不進入目錄或上下件切換。

Three.js 先顯示 GLB 的預覽，展間可操作後依視野載入 `texture`；目錄使用 `thumbnail`，作品燈箱才使用 `image` 詳情圖。GLB 單獨開啟只會顯示小預覽，完整品質保留在 Blender 編輯檔及獨立貼圖。作品名稱沿用檔名，未宣稱為繪師正式命名。

## 已知範圍

目前是依影像推估的簡化空間重建，沒有精確測繪、掃描建築材質與逐一燈光烘焙；作品本身使用提供的真實圖片。標註的四個區域依使用者說明配置；入口位置已確認，家具細節與其他尺寸仍有推估。不是照片級還原。需要支援 WebGL 2 的瀏覽器；模型或 WebGL 載入失敗時顯示重試介面，若作品資料已載入，仍可從頁首瀏覽 DOM 作品目錄。

## 技術參考

- [Three.js 官方文件](https://threejs.org/docs/)
- [MeshToonMaterial 官方文件](https://threejs.org/docs/pages/MeshToonMaterial.html)
- [Blender glTF 匯出文件](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html)

所有作品為厚約 3.5 公分的無框畫，正面與四個包覆側面共用圖像；側面頂點顏色稍暗以呈現折角，平面 SVG 旗幟則不加側面明暗。`depth` 由建模腳本匯出。柱畫使用維吉爾原圖與完整 UV，服務台背板先校正照片四角再使用完整 UV。
