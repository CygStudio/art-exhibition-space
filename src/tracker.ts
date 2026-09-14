import './tracker.css'
import { contactStatuses, contacts, contactTotalArtworkCount, type Contact, type ContactStatus } from './contact-data'

type SavedContactState = {
  notes?: string
  status?: ContactStatus
}

type SavedProgress = Record<string, SavedContactState>

const storageKey = 'cygnus-three-year-contact-tracker:v1'

const byId = <T extends HTMLElement>(id: string) => {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Missing required element: #${id}`)
  return element as T
}

const contactList = byId<HTMLElement>('contact-list')
const resultCount = byId<HTMLElement>('result-count')
const progressValue = byId<HTMLElement>('progress-value')
const progressBar = byId<HTMLElement>('progress-bar')
const statusSummary = byId<HTMLElement>('status-summary')
const searchInput = byId<HTMLInputElement>('search-input')
const statusFilter = byId<HTMLSelectElement>('status-filter')
const roleFilter = byId<HTMLSelectElement>('role-filter')
const resetButton = byId<HTMLButtonElement>('reset-button')
const toast = byId<HTMLElement>('toast')

let savedProgress = loadProgress()
let toastTimer: ReturnType<typeof window.setTimeout> | undefined

for (const status of contactStatuses) {
  const option = document.createElement('option')
  option.value = status.key
  option.textContent = status.label
  statusFilter.append(option)
}

function isContactStatus(value: unknown): value is ContactStatus {
  return contactStatuses.some((status) => status.key === value)
}

function loadProgress(): SavedProgress {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([id, entry]) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
        const candidate = entry as { notes?: unknown; status?: unknown }
        const state: SavedContactState = {}
        if (typeof candidate.notes === 'string') state.notes = candidate.notes
        if (isContactStatus(candidate.status)) state.status = candidate.status
        return [[id, state]]
      }),
    )
  } catch {
    return {}
  }
}

function saveProgress() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(savedProgress))
    return true
  } catch {
    showToast('目前無法寫入瀏覽器本機儲存，請檢查瀏覽器設定。')
    return false
  }
}

function statusOf(contact: Contact): ContactStatus {
  return savedProgress[contact.id]?.status ?? contact.defaultStatus ?? 'uncontacted'
}

function notesOf(contact: Contact) {
  return savedProgress[contact.id]?.notes ?? ''
}

function assetUrl(path: string) {
  return `${import.meta.env.BASE_URL}${path}`
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function messageFor(contact: Contact) {
  const fileNames = contact.artworks.map((artwork) => `「${artwork.sourceFile}」`).join('、')
  const relation = contact.role === '委託粉絲' ? '您先前委託提供的作品' : '您提供的作品'

  return `您好，我正在整理「熙歌三周年畫展」的展出候選作品。${relation}${fileNames}，想詢問是否同意用於本次非商業畫展展示？我們會保留原繪師署名與作品來源，不會另作商業使用或印製。若您同意，也想請您確認希望顯示的名稱／帳號；若不方便也完全沒問題，謝謝您。`
}

function renderCard(contact: Contact) {
  const currentStatus = statusOf(contact)
  const statusButtons = contactStatuses.map((status) => `
    <button class="status-button ${currentStatus === status.key ? 'is-active' : ''}" type="button" data-status="${status.key}" data-contact-id="${contact.id}" aria-pressed="${currentStatus === status.key}" title="${status.description}">
      ${status.label}
    </button>
  `).join('')

  const artworkThumbnails = contact.artworks.map((artwork) => `
    <figure class="artwork-thumb">
      <img src="${assetUrl(artwork.thumbnail)}" alt="${escapeHtml(contact.artist)} 的作品縮圖：${escapeHtml(artwork.sourceFile)}" loading="lazy" />
      <figcaption title="${escapeHtml(artwork.sourceFile)}">${escapeHtml(artwork.sourceFile)}</figcaption>
    </figure>
  `).join('')

  const contactAction = contact.xUrl && contact.xHandle
    ? `<a class="x-link" href="${contact.xUrl}" target="_blank" rel="noreferrer">開啟 X ${escapeHtml(contact.xHandle)} ↗</a>
       <button class="copy-message" type="button" data-copy-message="${contact.id}">複製詢問訊息</button>`
    : `<span class="unavailable-contact">尚未確認公開 X 帳號，請先補上聯絡方式。</span>`

  return `
    <article class="contact-card" data-contact="${contact.id}">
      <div class="contact-detail">
        <div class="card-heading">
          <div>
            <span class="role-badge" data-role="${contact.role}">${contact.role}</span>
            <h2 class="contact-name">${escapeHtml(contact.contactName)}</h2>
          </div>
          <p class="artwork-count">${contact.artworks.length} 件作品</p>
        </div>
        <dl class="person-grid">
          <div><dt>繪師</dt><dd>${escapeHtml(contact.artist)}</dd></div>
          <div><dt>提供者</dt><dd>${escapeHtml(contact.provider)}</dd></div>
        </dl>
        ${contact.contactNote ? `<p class="contact-note">${escapeHtml(contact.contactNote)}</p>` : ''}
        <div class="contact-actions">${contactAction}</div>
      </div>
      <div class="artwork-section">
        <div class="artwork-strip">${artworkThumbnails}</div>
        <section class="status-panel" aria-label="${escapeHtml(contact.contactName)} 的聯絡進度">
          <h3>聯絡進度</h3>
          <div class="status-buttons">${statusButtons}</div>
          <label class="notes-label">
            本機備註
            <textarea data-notes="${contact.id}" maxlength="1000" placeholder="例如：私訊日期、回覆內容…">${escapeHtml(notesOf(contact))}</textarea>
          </label>
        </section>
      </div>
    </article>
  `
}

function renderSummary() {
  const counts = Object.fromEntries(contactStatuses.map((status) => [status.key, 0])) as Record<ContactStatus, number>
  for (const contact of contacts) counts[statusOf(contact)] += 1

  const startedCount = counts.messaged + counts.approved + counts.declined
  progressValue.textContent = `${startedCount} / ${contacts.length}`
  progressBar.style.width = `${(startedCount / contacts.length) * 100}%`
  statusSummary.innerHTML = contactStatuses.map((status) => `
    <span class="summary-token" data-status="${status.key}"><b>${counts[status.key]}</b>${status.label}</span>
  `).join('')
}

function matchesSearch(contact: Contact, term: string) {
  if (!term) return true
  const searchText = [
    contact.contactName,
    contact.role,
    contact.artist,
    contact.provider,
    contact.xHandle,
    ...contact.artworks.map((artwork) => artwork.sourceFile),
  ].filter(Boolean).join(' ').toLocaleLowerCase()

  return searchText.includes(term)
}

function renderContacts() {
  const term = searchInput.value.trim().toLocaleLowerCase()
  const selectedStatus = statusFilter.value
  const selectedRole = roleFilter.value
  const visibleContacts = contacts.filter((contact) => (
    matchesSearch(contact, term)
    && (selectedStatus === 'all' || statusOf(contact) === selectedStatus)
    && (selectedRole === 'all' || contact.role === selectedRole)
  ))

  renderSummary()
  resultCount.textContent = `顯示 ${visibleContacts.length} 位聯絡對象／${contactTotalArtworkCount} 件作品`
  contactList.innerHTML = visibleContacts.length > 0
    ? visibleContacts.map(renderCard).join('')
    : '<p class="empty-state">沒有符合目前篩選條件的聯絡對象。</p>'
}

function updateState(contactId: string, update: SavedContactState) {
  const existing = savedProgress[contactId] ?? {}
  savedProgress = { ...savedProgress, [contactId]: { ...existing, ...update } }
  saveProgress()
}

function showToast(message: string) {
  toast.textContent = message
  toast.hidden = false
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toast.hidden = true }, 2600)
}

async function copyMessage(contactId: string) {
  const contact = contacts.find((item) => item.id === contactId)
  if (!contact) return

  const message = messageFor(contact)
  try {
    await navigator.clipboard.writeText(message)
    showToast('詢問訊息已複製，可直接貼到 X 私訊。')
  } catch {
    const fallback = document.createElement('textarea')
    fallback.value = message
    fallback.style.position = 'fixed'
    fallback.style.opacity = '0'
    document.body.append(fallback)
    fallback.select()
    const copied = document.execCommand('copy')
    fallback.remove()
    showToast(copied ? '詢問訊息已複製，可直接貼到 X 私訊。' : '複製失敗，請手動選取訊息。')
  }
}

contactList.addEventListener('click', (event) => {
  const element = event.target as Element
  const statusButton = element.closest<HTMLButtonElement>('button[data-status][data-contact-id]')
  if (statusButton) {
    const contactId = statusButton.dataset.contactId
    const status = statusButton.dataset.status
    if (!contactId || !isContactStatus(status)) return

    updateState(contactId, { status })
    renderContacts()
    contactList.querySelector<HTMLButtonElement>(`button[data-contact-id="${contactId}"][data-status="${status}"]`)?.focus()
    showToast('聯絡進度已儲存在這台裝置。')
    return
  }

  const copyButton = element.closest<HTMLButtonElement>('button[data-copy-message]')
  if (copyButton?.dataset.copyMessage) void copyMessage(copyButton.dataset.copyMessage)
})

contactList.addEventListener('change', (event) => {
  const textarea = event.target as HTMLTextAreaElement
  const contactId = textarea.dataset.notes
  if (!contactId) return
  updateState(contactId, { notes: textarea.value })
  showToast('備註已儲存在這台裝置。')
})

searchInput.addEventListener('input', renderContacts)
statusFilter.addEventListener('change', renderContacts)
roleFilter.addEventListener('change', renderContacts)

resetButton.addEventListener('click', () => {
  if (!window.confirm('要清除這台裝置上所有聯絡進度與備註嗎？此操作無法復原。')) return
  savedProgress = {}
  if (saveProgress()) showToast('本機進度與備註已重設。')
  renderContacts()
})

renderContacts()
