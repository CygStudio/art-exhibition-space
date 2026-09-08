# 規格與 commitlint 規則

需要驗證 commit message、解釋違規原因或區分強制規格與工具限制時，讀取本文件。

## Conventional Commits 1.0.0

### 必要結構

- commit 必須以 `type` 開頭，後接選填的 `scope`、選填的 `!`，以及必要的 `: `。
- 新功能必須使用 `feat`；錯誤修正必須使用 `fix`。
- `scope` 必須是括號內描述程式碼區域的名詞。
- `description` 必須緊接在 `: ` 後。
- body 為選填，若存在，必須與 description 相隔一個空白行。
- footer 為選填，若存在，必須與 body 相隔一個空白行；沒有 body 時則與 description 相隔一個空白行。
- footer token 後接 `: ` 或 ` #`，token 內的空白以 `-` 取代。
- breaking change 必須透過冒號前的 `!` 或 footer 中的 `BREAKING CHANGE: ` 表示。
- `BREAKING CHANGE` 必須大寫；`BREAKING-CHANGE` 在 footer token 中具有相同意義。
- `feat` 對應 SemVer `MINOR`、`fix` 對應 `PATCH`、breaking change 對應 `MAJOR`。
- 規格允許 `feat`、`fix` 以外的 type，但這些 type 本身不隱含 SemVer 版本影響。

規格沒有要求使用英文撰寫 description、body 或 footer value。

## @commitlint/config-conventional 預設規則

以下內容依官方 README 的 Problems 清單整理。

| 規則 | 等級 | 條件 |
|------|------|------|
| `type-enum` | error | `type` 必須是 `build`、`chore`、`ci`、`docs`、`feat`、`fix`、`perf`、`refactor`、`revert`、`style`、`test` 其中之一 |
| `type-case` | error | `type` 必須使用小寫 |
| `type-empty` | error | `type` 不得空白 |
| `subject-case` | error | subject 不得使用 `sentence-case`、`start-case`、`pascal-case` 或 `upper-case` |
| `subject-empty` | error | subject 不得空白 |
| `subject-full-stop` | error | subject 不得以英文句點 `.` 結尾 |
| `header-max-length` | error | header 最多 100 個字元 |
| `body-leading-blank` | warning | body 前必須有空白行 |
| `body-max-line-length` | error | body 每行最多 100 個字元 |
| `footer-leading-blank` | warning | footer 前必須有空白行 |
| `footer-max-line-length` | error | footer 每行最多 100 個字元 |

注意：Conventional Commits 規格要求 body 與 footer 前的空白行；`@commitlint/config-conventional` 對應的兩條規則預設只列為 warning。檢查時應分別說明規格要求與工具等級。

## 判斷順序

1. 解析 header 的 `type`、`scope`、`!` 與 subject。
2. 檢查 body 與 footer 是否以空白行分隔。
3. 檢查 `BREAKING CHANGE:` 或 `BREAKING-CHANGE:` 的位置、大小寫與說明。
4. 套用 commitlint 的 type、subject 與行長規則。
5. 最後檢查語意：`feat` 是否真為新功能、`fix` 是否真為錯誤修正、breaking change 是否確實不相容。

## 常見錯誤

```text
feature(member): 新增會員編輯功能
```

- 違反 `type-enum`；改用 `feat(member): 新增會員編輯功能`。

```text
FIX: 修正登入問題
```

- 違反 `type-case`；改用 `fix: 修正登入問題`。

```text
fix: 修正登入問題.
```

- 違反 `subject-full-stop`；移除結尾英文句點。

```text
feat(api): 移除舊版端點
BREAKING CHANGE: 呼叫端必須改用新版端點
```

- 缺少 footer 前的空白行；Conventional Commits 規格要求空白行，commitlint 的 `footer-leading-blank` 會提出 warning。

## 官方來源

- [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
- [`@commitlint/config-conventional` README](https://raw.githubusercontent.com/conventional-changelog/commitlint/refs/heads/master/%40commitlint/config-conventional/README.md)
