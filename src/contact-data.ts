export type ContactStatus = 'uncontacted' | 'messaged' | 'approved' | 'declined' | 'needs-info'

export type ContactRole = '繪師' | '委託粉絲' | '作品提供者'

export interface Artwork {
  id: string
  thumbnail: string
  sourceFile: string
}

export interface Contact {
  id: string
  contactName: string
  role: ContactRole
  artist: string
  provider: string
  xHandle?: string
  xUrl?: string
  contactNote?: string
  defaultStatus?: ContactStatus
  artworks: Artwork[]
}

export const contactStatuses: Array<{ key: ContactStatus; label: string; description: string }> = [
  { key: 'uncontacted', label: '未聯絡', description: '尚未發送詢問' },
  { key: 'messaged', label: '已私訊', description: '已送出詢問，等待回覆' },
  { key: 'approved', label: '已同意', description: '可保留署名後展示' },
  { key: 'declined', label: '婉拒', description: '不納入本次展示' },
  { key: 'needs-info', label: '待補資料', description: '需先確認聯絡方式' },
]

const xProfile = (handle: string) => `https://x.com/${handle.replace(/^@/, '')}`

const work = (id: string, sourceFile: string): Artwork => ({
  id,
  thumbnail: `contact-artworks/${id}.jpg`,
  sourceFile,
})

export const contacts: Contact[] = [
  {
    id: 'hwaguwu',
    contactName: '花故',
    role: '繪師',
    artist: '花故',
    provider: '繪師本人',
    xHandle: '@hwaguwu',
    xUrl: xProfile('@hwaguwu'),
    artworks: [work('hwaguwu', '花故_熙歌三週年.psd')],
  },
  {
    id: 'daikuu',
    contactName: '大空',
    role: '作品提供者',
    artist: '大空',
    provider: '大空',
    xHandle: '@shiro943871791',
    xUrl: xProfile('@shiro943871791'),
    contactNote: '「For Adam」資料夾的兩件作品，依指示只詢問大空。',
    artworks: [
      work('for-adam-01', 'For Adam/eea5876d3b073fdd.JPG'),
      work('for-adam-02', 'For Adam/oMai.png'),
    ],
  },
  {
    id: 'enruzero',
    contactName: '緣流',
    role: '繪師',
    artist: '緣流',
    provider: '繪師本人',
    xHandle: '@enruzero',
    xUrl: xProfile('@enruzero'),
    artworks: [work('enruzero', '緣流.jpg')],
  },
  {
    id: 'littlelin6425',
    contactName: '醬油煎蛋',
    role: '委託粉絲',
    artist: 'ZM敏',
    provider: '醬油煎蛋（委託粉絲）',
    xHandle: '@littlelin6425',
    xUrl: xProfile('@littlelin6425'),
    contactNote: '此件是粉絲委託作，請聯絡提供者，不聯絡檔名標示的繪師。',
    artworks: [work('zm', '方的/ZM敏.png')],
  },
  {
    id: 'bbibinbing',
    contactName: 'BBiBinBing',
    role: '繪師',
    artist: 'BBiBinBing',
    provider: '繪師本人',
    xHandle: '@bbibinbingART',
    xUrl: xProfile('@bbibinbingART'),
    artworks: [work('bbibinbing', '方的/BBiBinBing.jpg')],
  },
  {
    id: 'toyasan',
    contactName: '戶屋',
    role: '繪師',
    artist: '戶屋',
    provider: '繪師本人',
    xHandle: '@toyasan83',
    xUrl: xProfile('@toyasan83'),
    artworks: [
      work('toyasan-square', '方的/戶屋 - 2.png'),
      work('toyasan-portrait', '直式/戶屋 - 1.png'),
    ],
  },
  {
    id: 'qb',
    contactName: 'QB',
    role: '繪師',
    artist: 'QB',
    provider: '繪師本人',
    xHandle: '@QB07012',
    xUrl: xProfile('@QB07012'),
    artworks: [work('qb', '方的/QB.png')],
  },
  {
    id: 'yukimura',
    contactName: '雪村信',
    role: '繪師',
    artist: '雪村信',
    provider: '繪師本人',
    contactNote: '尚未確認可排除同名者的公開 X 帳號；請從交件對話或共同窗口補上。',
    defaultStatus: 'needs-info',
    artworks: [
      work('yukimura-portrait', '直式/雪村信 - 1.png'),
      work('yukimura-landscape', '橫式/雪村信 - 2.png'),
    ],
  },
  {
    id: 'bird',
    contactName: '鳥語',
    role: '繪師',
    artist: '鳥語',
    provider: '繪師本人',
    xHandle: '@bird09_art',
    xUrl: xProfile('@bird09_art'),
    artworks: [
      work('bird-01', '直式/鳥語 - 1.png'),
      work('bird-02', '直式/鳥語 - 2.png'),
    ],
  },
  {
    id: 'lllokkk',
    contactName: 'lllokkk',
    role: '繪師',
    artist: 'lllokkk',
    provider: '繪師本人',
    xHandle: '@lllokkk1128',
    xUrl: xProfile('@lllokkk1128'),
    artworks: [
      work('lllokkk-portrait', '直式/lllokkk - 2.png'),
      work('lllokkk-landscape', '橫式/lllokkk - 1.png'),
    ],
  },
  {
    id: 'jk5206',
    contactName: '玄米誇鬆',
    role: '委託粉絲',
    artist: '翔 kakult2017',
    provider: '玄米誇鬆（委託粉絲）',
    xHandle: '@jk5206',
    xUrl: xProfile('@jk5206'),
    contactNote: '此兩件是粉絲委託作，請聯絡提供者，不聯絡檔名標示的繪師。',
    artworks: [
      work('kakult-portrait', '直式/翔 kakult2017 - 2.png'),
      work('kakult-landscape', '橫式/翔 kakult2017 - 1.png'),
    ],
  },
  {
    id: 'css',
    contactName: '奶油醬油',
    role: '繪師',
    artist: '奶油醬油',
    provider: '繪師本人',
    xHandle: '@CSS74134570',
    xUrl: xProfile('@CSS74134570'),
    artworks: [
      work('css-portrait', '直式/奶油醬油 - 1.png'),
      work('css-landscape', '橫式/奶油醬油 - 2.png'),
    ],
  },
  {
    id: 'msn623456',
    contactName: '茄子阿光',
    role: '委託粉絲',
    artist: '維吉爾',
    provider: '茄子阿光（委託粉絲）',
    xHandle: '@msn623456',
    xUrl: xProfile('@msn623456'),
    contactNote: '此件是粉絲委託作，請聯絡提供者，不聯絡檔名標示的繪師。',
    artworks: [work('virgil', '直式/維吉爾.png')],
  },
  {
    id: 'chill',
    contactName: '超二流—ChillAru',
    role: '繪師',
    artist: '超二流—ChillAru',
    provider: '繪師本人',
    xHandle: '@chill_aru',
    xUrl: xProfile('@chill_aru'),
    artworks: [work('chill', '直式/超二流—ChillAru.jpg')],
  },
  {
    id: 'egg',
    contactName: '荷包蛋',
    role: '繪師',
    artist: '荷包蛋',
    provider: '繪師本人',
    contactNote: '尚未確認可排除同名者的公開 X 帳號；請從交件對話或共同窗口補上。',
    defaultStatus: 'needs-info',
    artworks: [
      work('egg-01', '直式/荷包蛋 - 1.png'),
      work('egg-02', '直式/荷包蛋 - 2.png'),
    ],
  },
  {
    id: 'keishinn-mola',
    contactName: 'シュ婚叫セン',
    role: '委託粉絲',
    artist: 'Shiris 惜霖',
    provider: 'シュ婚叫セン（委託粉絲）',
    xHandle: '@keishinn_mola',
    xUrl: xProfile('@keishinn_mola'),
    contactNote: '此件是粉絲委託作，請聯絡提供者，不聯絡檔名標示的繪師。',
    artworks: [work('shiris', '橫式/Shiris 惜霖.png')],
  },
  {
    id: 'sapphire3345678',
    contactName: '少荻聿aka薯條',
    role: '委託粉絲',
    artist: 'JENˇ荏',
    provider: '少荻聿aka薯條（委託粉絲）',
    xHandle: '@sapphire3345678',
    xUrl: xProfile('@sapphire3345678'),
    contactNote: '此件是粉絲委託作，請聯絡提供者，不聯絡檔名標示的繪師。',
    artworks: [work('jen', '橫式/JENˇ荏.png')],
  },
  {
    id: 'chejan',
    contactName: '成江',
    role: '繪師',
    artist: '成江',
    provider: '繪師本人',
    xHandle: '@CHEJAN1219',
    xUrl: xProfile('@CHEJAN1219'),
    artworks: [work('chejan', '橫式/成江.png')],
  },
  {
    id: 'wz',
    contactName: '花子',
    role: '繪師',
    artist: '花子',
    provider: '繪師本人',
    xHandle: '@wz_EAG',
    xUrl: xProfile('@wz_EAG'),
    artworks: [work('wz', '橫式/花子.png')],
  },
  {
    id: 'medo',
    contactName: 'MEDO',
    role: '繪師',
    artist: 'MEDO',
    provider: '繪師本人',
    contactNote: '尚未確認可排除同名者的公開 X 帳號；請從交件對話或共同窗口補上。',
    defaultStatus: 'needs-info',
    artworks: [work('medo', '橫式/MEDO.png')],
  },
  {
    id: 'didi',
    contactName: 'DiDi',
    role: '繪師',
    artist: 'DiDi',
    provider: '繪師本人',
    xHandle: '@DiDi_2u6',
    xUrl: xProfile('@DiDi_2u6'),
    artworks: [work('didi', '橫式/DiDi.png')],
  },
]

export const contactTotalArtworkCount = contacts.reduce((count, contact) => count + contact.artworks.length, 0)
