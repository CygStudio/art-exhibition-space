---
name: commit-message-conventional
description: 依 Conventional Commits 1.0.0 與 @commitlint/config-conventional 規則產生、檢查及修正 commit message。當使用者要求撰寫 commit message、判斷訊息是否合規、選擇 type 或 scope、描述 breaking change、整理 body/footer，或修正 commitlint 錯誤時使用。
---

# Conventional Commit 訊息規範

依程式碼變更的實際意圖，產生可供人員閱讀、也能由工具解析的 commit message。遵守 Conventional Commits 1.0.0，並以 `@commitlint/config-conventional` 的預設規則作為檢查基準。

## 工作流程

1. 讀取使用者提供的變更說明、diff 或 commit message。
2. 需要從儲存庫判斷變更時，優先檢查 staged diff，再參考未 staged 的變更、相關文件與近期 commit；不要把未納入本次 commit 的內容寫進訊息。
3. 判斷主要意圖並選擇 `type`。若變更包含多個可獨立提交的意圖，建議拆成多個 commit。
4. 只有在能提供穩定且有意義的脈絡時才加入 `scope`。
5. 以簡短 `description` 組成 header；必要時補充 body 與 footer。
6. 檢查格式、空行、大小寫、長度與 breaking change 標示。
7. 除非使用者要求解釋，僅以純文字程式碼區塊輸出可直接使用的 commit message。不要自行執行 `git commit`。

## 訊息結構

```text
<type>[optional scope][optional !]: <description>

[optional body]

[optional footer(s)]
```

遵守以下核心規則：

- 必須提供 `type`、冒號、半形空格與非空白的 `description`。
- `scope` 為選填，使用括號包住描述程式碼範圍的名詞，例如 `feat(parser): ...`。
- `!` 為選填；若使用，必須緊接在 `type` 或 `scope` 後、冒號前。
- body 與 header 之間必須保留一個空白行。
- footer 與 body 之間必須保留一個空白行；沒有 body 時，footer 與 header 之間仍須保留一個空白行。
- 每個 footer 使用 `<token>: <value>` 或 `<token> #<value>`。token 中的空白以 `-` 取代，但 `BREAKING CHANGE` 例外。
- 需要逐項核對 commitlint 規則或說明錯誤等級時，讀取 [references/rules.md](references/rules.md)。

## 選擇 type

只能使用 `@commitlint/config-conventional` 預設允許的 type：

| type | 使用時機 |
|------|----------|
| `feat` | 新增使用者或呼叫端可用的功能 |
| `fix` | 修正錯誤行為 |
| `perf` | 改善效能且不改變預期行為 |
| `refactor` | 重構程式碼，沒有新增功能或修正錯誤 |
| `docs` | 僅修改文件 |
| `style` | 僅調整格式、空白或其他不影響行為的樣式 |
| `test` | 新增、修正或重構測試 |
| `build` | 修改建置系統或外部相依性 |
| `ci` | 修改 CI 設定或腳本 |
| `chore` | 其他不屬於上述類別的維護工作 |
| `revert` | 還原先前的 commit |

將 `type` 寫成小寫。不要使用未列出的同義詞，例如 `feature`、`bugfix` 或 `maintenance`。同時符合多個 type 時，優先建議拆分；無法拆分時，選擇最能描述主要意圖的 type。

## 撰寫 scope 與 description

- 沿用儲存庫既有的 scope 命名；沒有既有慣例時，使用簡短且穩定的模組、套件或功能名稱。
- 不要為了填滿格式而加入含糊 scope，例如 `app`、`misc` 或 `changes`。
- `description` 描述這次變更帶來的結果，不要只列出檔名或使用「更新內容」「修正問題」等空泛語句。
- 沿用專案既有語言；無法判斷時使用台灣正體中文，保留 API、函式、套件與程式碼識別字的英文原文。
- 不要以英文句點 `.` 結尾；為保持一致，中文句號 `。` 也省略。
- 整個 header 不得超過 100 個字元。
- 不要捏造 issue 編號、需求背景、效能數據或未出現在變更中的影響。

## 撰寫 body 與 footer

只在 header 無法充分說明時加入 body。使用 body 說明變更動機、重要實作脈絡、行為差異或必要限制，不要逐檔重述 diff。body 每行不得超過 100 個字元。

只在有可驗證資訊時加入 footer，例如：

```text
Refs: #123
Reviewed-by: Mei
```

footer 每行不得超過 100 個字元。不要自行加入 `Co-authored-by`、issue 編號或審查者。

## 標示 breaking change

當既有使用者、API 呼叫端或資料需要不相容的遷移時，使用下列一種或兩種方式：

```text
feat(api)!: 移除舊版驗證端點
```

```text
feat(api): 移除舊版驗證端點

BREAKING CHANGE: 呼叫端必須改用 /v2/auth 端點
```

- `!` 已足以表示 breaking change，但若遷移方式不適合放入 header，仍加入 `BREAKING CHANGE:` footer。
- `BREAKING CHANGE:` 必須大寫，後接半形冒號、空格與非空白說明。
- `BREAKING-CHANGE:` 在 footer 中視為同義格式；產生新訊息時優先使用 `BREAKING CHANGE:`。
- 任一允許的 type 都可以包含 breaking change。
- 不要只因重構規模大就標示 breaking change；必須確實存在不相容影響。

## 檢查與修正

檢查既有訊息時：

1. 先判斷是否符合 Conventional Commits 的結構與語意要求。
2. 再套用 `@commitlint/config-conventional` 的 error 與 warning 規則。
3. 明確列出違反的規則名稱、原因與最小修正版本。
4. 區分「規格不允許」「commitlint 會報錯」「commitlint 只會警告」與「本技能建議」，不要把建議誤稱為強制規則。
5. 保留原意；除非現有訊息與變更內容矛盾，否則不要擴寫未提供的背景。

## 範例

只有 header：

```text
feat(member): 新增會員資料編輯功能
```

包含 body 與多個 footer：

```text
fix(request): 避免過期回應覆寫最新資料

為每次請求保留識別碼，只接受最近一次請求的回應。

Refs: #123
Reviewed-by: Mei
```

包含 breaking change：

```text
feat(api)!: 統一使用新版驗證端點

移除已淘汰的 v1 驗證流程，所有請求改由 v2 處理。

BREAKING CHANGE: 呼叫端必須改用 /v2/auth 端點
```
