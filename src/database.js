import Dexie from 'dexie'

export const db = new Dexie('ruang-iman-pak')
db.version(1).stores({
  profiles: '++id, name, role',
  topics: '++id, title, grade',
  questions: '++id, topicId, type, grade',
  wordChains: '++id, topicId, startWord',
  secrets: '++id, topicId, answer',
  crosswords: '++id, topicId, title',
  exams: '++id, title, grade',
  examSessions: '++id, examId, profileId, status',
  attempts: '++id, profileId, examId, createdAt',
  gameHistory: '++id, profileId, game, createdAt',
})
db.version(2).stores({
  profiles: '++id, name, role, [name+role]',
})
db.version(3).stores({
  examSessions: '++id, examId, profileId, status, [profileId+status]',
})

const topics = [
  { id: 1, title: 'Iman dan kehidupan', grade: 'X', description: 'Memahami iman yang diwujudkan dalam kehidupan sehari-hari.' },
  { id: 2, title: 'Kasih dan pengampunan', grade: 'XI', description: 'Belajar tentang kasih, pengampunan, dan relasi dengan sesama.' },
  { id: 3, title: 'Gereja dan masyarakat', grade: 'XII', description: 'Peran warga gereja dalam membangun masyarakat.' },
]

const questions = [
  { id: 1, topicId: 1, grade: 'X', type: 'choice', prompt: 'Sikap yang menunjukkan iman dalam kehidupan sehari-hari adalah …', options: ['Mengasihi dan menolong sesama', 'Mementingkan diri sendiri', 'Menghindari tanggung jawab', 'Membalas kesalahan orang lain'], answer: 'Mengasihi dan menolong sesama', explanation: 'Iman dapat diwujudkan melalui kasih dan kepedulian kepada sesama.' },
  { id: 2, topicId: 1, grade: 'X', type: 'choice', prompt: 'Apa yang dimaksud dengan doa?', options: ['Komunikasi dengan Tuhan', 'Kegiatan untuk memperoleh pujian', 'Kewajiban tanpa makna', 'Perlombaan antarumat'], answer: 'Komunikasi dengan Tuhan', explanation: 'Doa merupakan bentuk komunikasi dan relasi manusia dengan Tuhan.' },
  { id: 3, topicId: 2, grade: 'XI', type: 'choice', prompt: 'Pengampunan dalam relasi dengan sesama mendorong kita untuk …', options: ['Membuka kesempatan untuk berdamai', 'Menyimpan dendam', 'Mempermalukan orang lain', 'Mengabaikan semua orang'], answer: 'Membuka kesempatan untuk berdamai', explanation: 'Pengampunan menolong memulihkan relasi dan membuka jalan bagi perdamaian.' },
  { id: 4, topicId: 2, grade: 'XI', type: 'short', prompt: 'Sebutkan satu sikap yang dapat membangun kerukunan di sekolah.', answer: 'toleransi', acceptedAnswers: ['menghormati perbedaan', 'kerja sama', 'saling menolong'], explanation: 'Menghormati perbedaan, bekerja sama, dan saling menolong juga membangun kerukunan.' },
  { id: 5, topicId: 3, grade: 'XII', type: 'choice', prompt: 'Salah satu kontribusi positif warga gereja di masyarakat adalah …', options: ['Melayani dan bekerja sama demi kebaikan bersama', 'Menciptakan perpecahan', 'Menolak dialog', 'Mengabaikan lingkungan'], answer: 'Melayani dan bekerja sama demi kebaikan bersama', explanation: 'Warga gereja dapat menjadi pembawa damai melalui pelayanan dan kerja sama.' },
]

const wordChains = [
  { id: 1, topicId: 1, startWord: 'IMAN', words: ['nyata', 'anugerah', 'harapan', 'nasihat', 'tanggung jawab', 'bukti', 'iman', 'nabi', 'ibadah', 'hidup', 'percaya'], explanation: 'Iman bertumbuh dan dinyatakan dalam tindakan nyata.' },
  { id: 2, topicId: 2, startWord: 'KASIH', words: ['hormat', 'tulus', 'syukur', 'rukun', 'nasihat', 'toleransi'], explanation: 'Kasih terlihat dalam sikap saling menghormati dan membangun kerukunan.' },
]
const secrets = [
  { id: 1, topicId: 1, answer: 'DOA', clue: 'Komunikasi manusia dengan Tuhan.', hints: ['Dapat dilakukan sendiri atau bersama.', 'Dimulai dengan huruf D.'], explanation: 'Doa adalah ungkapan komunikasi dan relasi dengan Tuhan.' },
  { id: 2, topicId: 2, answer: 'KASIH', clue: 'Sikap peduli dan mengutamakan kebaikan bagi sesama.', hints: ['Menjadi dasar relasi yang baik.', 'Terdiri dari lima huruf.'], explanation: 'Kasih mendorong kepedulian, penghormatan, dan tindakan baik.' },
  { id: 3, topicId: 3, answer: 'DAMAI', clue: 'Keadaan tenteram yang dibangun melalui sikap saling menghormati.', hints: ['Lawan dari pertikaian.', 'Terdiri dari lima huruf.'], explanation: 'Damai dapat dibangun melalui dialog dan kerja sama.' },
]
const crosswords = [
  { id: 1, topicId: 2, title: 'Kasih & Iman', size: 5, placements: [
    { id: 1, direction: 'across', row: 2, col: 0, answer: 'KASIH', clue: 'Sikap peduli dan mengutamakan kebaikan sesama.' },
    { id: 2, direction: 'down', row: 0, col: 2, answer: 'YESUS', clue: 'Tokoh sentral dalam iman Kristen.' },
  ], explanation: 'Kasih dan teladan Yesus mengajarkan kepedulian serta pelayanan.' },
]

let seedPromise

export function seedDatabase() {
  if (!seedPromise) {
    seedPromise = seedInitialData().finally(() => { seedPromise = undefined })
  }
  return seedPromise
}

async function seedInitialData() {
  if (await db.topics.count()) return
  await db.transaction('rw', db.topics, db.questions, db.wordChains, db.secrets, db.crosswords, db.exams, async () => {
    await db.topics.bulkAdd(topics)
    await db.questions.bulkAdd(questions)
    await db.wordChains.bulkAdd(wordChains)
    await db.secrets.bulkAdd(secrets)
    await db.crosswords.bulkAdd(crosswords)
    await db.exams.add({ id: 1, title: 'Latihan PAK SMA', grade: 'Semua kelas', duration: 10, questionIds: questions.map((question) => question.id), passScore: 60, showExplanation: true })
  })
}

export async function exportDatabase() {
  const tables = ['profiles', 'topics', 'questions', 'wordChains', 'secrets', 'crosswords', 'exams', 'attempts', 'gameHistory']
  const data = {}
  for (const table of tables) data[table] = await db[table].toArray()
  return { format: 'ruang-iman-backup', version: 1, exportedAt: new Date().toISOString(), data }
}

function validateBackupData(data) {
  const invalid = (table, index) => new Error(`Data ${table} nomor ${index + 1} tidak valid.`)
  for (const table of ['topics', 'questions', 'wordChains', 'secrets', 'crosswords', 'exams']) {
    const ids = new Set()
    for (const [index, item] of data[table].entries()) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw invalid(table, index)
      if (item.id !== undefined) {
        if (!Number.isSafeInteger(item.id) || ids.has(item.id)) throw invalid(table, index)
        ids.add(item.id)
      }
    }
  }

  const topicIds = new Set(data.topics.map((topic) => topic.id).filter((id) => id !== undefined))
  const questionIds = new Set(data.questions.map((question) => question.id).filter((id) => id !== undefined))
  const validTopic = (item) => item.topicId === undefined || topicIds.has(item.topicId)
  const validText = (value) => typeof value === 'string' && value.trim().length > 0
  const normalize = (value) => value.trim().toLocaleLowerCase('id-ID').replace(/\s+/g, ' ')

  data.topics.forEach((item, index) => {
    if (!validText(item.title) || !validText(item.grade)) throw invalid('topics', index)
  })
  data.questions.forEach((item, index) => {
    if (!validText(item.prompt) || !validText(item.answer) || !['choice', 'short'].includes(item.type) || !validTopic(item)) throw invalid('questions', index)
    if (item.type === 'choice' && (!Array.isArray(item.options) || item.options.length < 2 || !item.options.every(validText) || new Set(item.options.map(normalize)).size !== item.options.length || !item.options.some((option) => normalize(option) === normalize(item.answer)))) throw invalid('questions', index)
    if (item.acceptedAnswers !== undefined && (!Array.isArray(item.acceptedAnswers) || !item.acceptedAnswers.every(validText))) throw invalid('questions', index)
  })
  data.wordChains.forEach((item, index) => {
    if (!validText(item.startWord) || !Array.isArray(item.words) || !item.words.length || !item.words.every(validText) || !validTopic(item)) throw invalid('wordChains', index)
    let previous = item.startWord
    for (const word of item.words) {
      if (!normalize(word).startsWith(normalize(previous).slice(-1))) throw invalid('wordChains', index)
      previous = word
    }
  })
  data.secrets.forEach((item, index) => {
    if (!validText(item.answer) || !validText(item.clue) || !validTopic(item) || (item.hints !== undefined && !Array.isArray(item.hints))) throw invalid('secrets', index)
  })
  data.crosswords.forEach((item, index) => {
    if (!validText(item.title) || !Number.isInteger(item.size) || item.size < 2 || item.size > 12 || !Array.isArray(item.placements) || item.placements.length < 2 || !validTopic(item)) throw invalid('crosswords', index)
    const occupied = new Map()
    let intersects = false
    for (const word of item.placements) {
      if (!word || !['across', 'down'].includes(word.direction) || !Number.isInteger(word.row) || !Number.isInteger(word.col) || word.row < 0 || word.col < 0 || !/^[A-Za-z]{2,12}$/.test(word.answer) || !validText(word.clue)) throw invalid('crosswords', index)
      for (const [offset, letter] of [...word.answer.toUpperCase()].entries()) {
        const row = word.row + (word.direction === 'down' ? offset : 0)
        const col = word.col + (word.direction === 'across' ? offset : 0)
        if (row >= item.size || col >= item.size) throw invalid('crosswords', index)
        const key = `${row},${col}`
        if (occupied.has(key)) {
          if (occupied.get(key).letter !== letter || occupied.get(key).direction === word.direction) throw invalid('crosswords', index)
          intersects = true
        } else occupied.set(key, { letter, direction: word.direction })
      }
    }
    if (!intersects) throw invalid('crosswords', index)
  })
  data.exams.forEach((item, index) => {
    if (!validText(item.title) || !validText(item.grade) || !Number.isFinite(item.duration) || item.duration < 1 || !Number.isFinite(item.passScore) || item.passScore < 0 || item.passScore > 100 || !Array.isArray(item.questionIds) || !item.questionIds.length || item.questionIds.some((id) => !questionIds.has(id))) throw invalid('exams', index)
  })
}

export async function importDatabase(payload) {
  const expected = ['topics', 'questions', 'wordChains', 'secrets', 'crosswords', 'exams']
  if (payload?.format !== 'ruang-iman-backup' || payload.version !== 1 || !payload.data || expected.some((table) => !Array.isArray(payload.data[table]))) {
    throw new Error('Berkas bukan cadangan Ruang Iman yang valid.')
  }
  validateBackupData(payload.data)
  await db.transaction('rw', ...expected.map((table) => db[table]), async () => {
    for (const table of expected) {
      await db[table].clear()
      if (payload.data[table].length) await db[table].bulkAdd(payload.data[table])
    }
  })
}
