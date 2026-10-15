import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, ChevronDown, Clock3, Download,
  Gamepad2, GraduationCap, Grid2X2, HelpCircle, Home, Lightbulb, ListChecks, LogOut,
  Menu, Plus, RotateCcw, Settings2, ShieldCheck, Sparkles, Trophy, Upload, UserRound, X,
} from 'lucide-react'
import { db, exportDatabase, importDatabase, seedDatabase } from './database'
import { checkChainWord, isAnswerCorrect, isValidSecretGuess, normalize, scoreAnswers } from './gameLogic'

const navItems = [
  { id: 'home', label: 'Beranda', icon: Home },
  { id: 'games', label: 'Permainan', icon: Gamepad2 },
  { id: 'exam', label: 'Ujian CBT', icon: ListChecks },
  { id: 'history', label: 'Riwayat', icon: Clock3 },
  { id: 'admin', label: 'Kelola konten', icon: Settings2 },
]

const games = [
  { id: 'chain', title: 'Sambung Kata', description: 'Rangkai istilah dan latih pemahamanmu.', icon: ArrowRight, color: 'bg-violet-100 text-violet-700', tag: 'Kosakata' },
  { id: 'secret', title: 'Kata Rahasia', description: 'Tebak kata dari petunjuk yang tersedia.', icon: HelpCircle, color: 'bg-amber-100 text-amber-700', tag: 'Tebak kata' },
  { id: 'crossword', title: 'Teka-Teki Silang', description: 'Isi kotak dan pecahkan petunjuk PAK.', icon: Grid2X2, color: 'bg-emerald-100 text-emerald-700', tag: 'Teka-teki' },
]

function App() {
  const [ready, setReady] = useState(false)
  const [dbError, setDbError] = useState('')
  const [page, setPage] = useState('home')
  const [profile, setProfile] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [content, setContent] = useState({ topics: [], questions: [], wordChains: [], secrets: [], crosswords: [], exams: [], attempts: [], gameHistory: [] })
  const [activeGame, setActiveGame] = useState('')
  const [examRun, setExamRun] = useState(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [toast, setToast] = useState('')

  const refresh = async () => {
    const [topics, questions, wordChains, secrets, crosswords, exams, attempts, gameHistory, savedProfiles] = await Promise.all([
      db.topics.toArray(), db.questions.toArray(), db.wordChains.toArray(), db.secrets.toArray(),
      db.crosswords.toArray(), db.exams.toArray(), db.attempts.orderBy('createdAt').reverse().toArray(),
      db.gameHistory.orderBy('createdAt').reverse().toArray(), db.profiles.toArray(),
    ])
    setContent({ topics, questions, wordChains, secrets, crosswords, exams, attempts, gameHistory })
    setProfiles(savedProfiles)
  }

  useEffect(() => {
    seedDatabase().then(async () => {
      await refresh()
      const saved = localStorage.getItem('ruang-iman-profile')
      if (saved) {
        const savedProfile = JSON.parse(saved)
        setProfile(savedProfile)
        const session = await db.examSessions.where({ profileId: savedProfile.id, status: 'in-progress' }).first()
        if (session) {
          setExamRun(session)
          setPage('exam-run')
        }
      }
      setReady(true)
    }).catch((error) => {
      console.error('Gagal menyiapkan database lokal.', error)
      setDbError('Penyimpanan lokal gagal dibuka. Periksa dukungan IndexedDB browser, lalu muat ulang aplikasi.')
    })
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 3000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const showToast = (message) => setToast(message)
  const chooseProfile = async (name, role) => {
    const user = { name: name.trim(), role }
    if (!user.name) return
    const existing = await db.profiles.where({ name: user.name, role }).first()
    if (!existing) await db.profiles.add(user)
    else user.id = existing.id
    localStorage.setItem('ruang-iman-profile', JSON.stringify(user))
    setProfile(user)
    await refresh()
  }
  const signOut = () => {
    localStorage.removeItem('ruang-iman-profile')
    setProfile(null)
    setPage('home')
  }
  const navigate = (next) => { setPage(next); setActiveGame(''); setMobileNav(false) }

  if (!ready && !dbError) return <div className="grid min-h-screen place-items-center text-sm font-semibold text-muted">Menyiapkan ruang belajar…</div>
  if (dbError) return <main className="grid min-h-screen place-items-center p-6"><div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-card"><ShieldCheck className="mx-auto mb-4 text-rose-500" size={36} /><h1 className="text-xl font-extrabold">Penyimpanan tidak tersedia</h1><p className="mt-3 text-sm text-muted">{dbError}</p></div></main>
  if (!profile) return <ProfilePicker profiles={profiles} onSelect={chooseProfile} />

  const startExam = async (exam) => {
    const questions = await db.questions.bulkGet(exam.questionIds || [])
    const valid = questions.filter(Boolean)
    if (!valid.length) { showToast('Ujian ini belum memiliki soal.'); return }
    const selectedQuestions = exam.shuffle ? [...valid].sort(() => Math.random() - 0.5) : valid
    const randomizedQuestions = exam.shuffleOptions ? selectedQuestions.map((question) => ({ ...question, options: question.options ? [...question.options].sort(() => Math.random() - 0.5) : [] })) : selectedQuestions
    const session = { examId: exam.id, exam, questions: randomizedQuestions, answers: {}, index: 0, startedAt: Date.now(), profileId: profile.id, status: 'in-progress' }
    await db.examSessions.where({ profileId: profile.id, status: 'in-progress' }).delete()
    await db.examSessions.add({ ...session, status: 'in-progress' })
    setExamRun(session)
    setPage('exam-run')
  }
  const submitExam = async (run) => {
    try {
      const result = scoreAnswers(run.questions, run.answers)
      await db.attempts.add({ profileId: profile.id, profileName: profile.name, examId: run.exam.id, examTitle: run.exam.title, ...result, answers: run.answers, questionIds: run.questions.map((q) => q.id), createdAt: new Date().toISOString() })
      await db.examSessions.where({ profileId: profile.id, status: 'in-progress' }).delete()
      await refresh()
      setExamRun({ ...run, result })
      return true
    } catch (error) {
      console.error('Gagal menyimpan hasil ujian.', error)
      showToast('Hasil ujian gagal disimpan. Periksa ruang penyimpanan lalu coba lagi.')
      return false
    }
  }

  return (
    <div className="min-h-screen">
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-[250px] flex-col border-r border-slate-100 bg-white px-5 py-6 transition-transform lg:translate-x-0 ${mobileNav ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-10 flex items-center gap-3 px-2">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-brand text-white shadow-lg shadow-violet-200"><BookOpen size={21} /></div>
          <div><div className="font-extrabold tracking-tight">Ruang Iman</div><div className="text-[11px] font-semibold text-muted">BELAJAR PAK · SMA</div></div>
          <button className="ml-auto rounded-lg p-1 text-muted lg:hidden" onClick={() => setMobileNav(false)} aria-label="Tutup menu"><X size={19} /></button>
        </div>
        <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.15em] text-slate-400">Menu utama</div>
        <nav className="space-y-1.5" aria-label="Navigasi utama">
          {navItems.filter((item) => item.id !== 'admin' || profile.role === 'admin').map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => navigate(id)} className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition ${page === id || (id === 'exam' && page === 'exam-run') ? 'bg-lilac text-brand' : 'text-slate-500 hover:bg-slate-50 hover:text-ink'}`}>
              <Icon size={18} strokeWidth={2.1} />{label}
              {id === 'exam' && <span className="ml-auto h-2 w-2 rounded-full bg-emerald-400" />}
            </button>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl bg-[#f7f5ff] p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-brand"><Sparkles size={15} /> Terus bertumbuh</div>
          <p className="text-xs leading-5 text-slate-500">Belajar sedikit demi sedikit, dengan hati yang terbuka.</p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white"><div className="h-full w-2/3 rounded-full bg-brand" /></div>
          <p className="mt-2 text-[10px] font-semibold text-slate-400">Semangat belajarmu hari ini</p>
        </div>
      </aside>
      {mobileNav && <button className="fixed inset-0 z-20 bg-slate-900/20 lg:hidden" onClick={() => setMobileNav(false)} aria-label="Tutup navigasi" />}
      <div className="lg:pl-[250px]">
        <header className="sticky top-0 z-10 flex h-[72px] items-center justify-between border-b border-slate-100 bg-[#f7f8fc]/90 px-5 backdrop-blur-lg sm:px-8">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 text-slate-500 hover:bg-white lg:hidden" onClick={() => setMobileNav(true)} aria-label="Buka menu"><Menu size={20} /></button>
            <div><p className="text-xs font-medium text-muted">Kamis, 15 Oktober 2026</p><p className="text-sm font-bold">{pageTitle(page, activeGame)}</p></div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-semibold text-slate-500 sm:block">{profile.role === 'admin' ? 'Guru / Admin' : 'Siswa'}</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eae7ff] text-sm font-extrabold text-brand">{profile.name.slice(0, 1).toUpperCase()}</div>
            <button onClick={signOut} className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-rose-500" aria-label="Keluar dari profil"><LogOut size={17} /></button>
          </div>
        </header>
        <main className="mx-auto max-w-[1280px] px-5 py-7 sm:px-8 sm:py-9">
          {page === 'home' && <HomePage profile={profile} content={content} onNavigate={navigate} onStartGame={setActiveGame} />}
          {page === 'games' && !activeGame && <GamesPage onStart={setActiveGame} />}
          {page === 'games' && activeGame && <GamePage game={activeGame} content={content} profile={profile} onBack={() => setActiveGame('')} onToast={showToast} onSaved={refresh} />}
          {page === 'exam' && <ExamPage exams={content.exams} onStart={startExam} />}
          {page === 'exam-run' && examRun && <ExamRunner run={examRun} setRun={setExamRun} onSubmit={submitExam} onBack={() => navigate('exam')} />}
          {page === 'history' && <HistoryPage attempts={content.attempts} games={content.gameHistory} profile={profile} />}
          {page === 'admin' && profile.role === 'admin' && <AdminPage content={content} onRefresh={refresh} onToast={showToast} />}
        </main>
      </div>
      {toast && <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white shadow-xl">{toast}</div>}
    </div>
  )
}

function pageTitle(page, game) {
  if (page === 'home') return 'Beranda'
  if (page === 'games') return game ? games.find((item) => item.id === game)?.title : 'Permainan'
  if (page === 'exam' || page === 'exam-run') return 'Ujian CBT'
  if (page === 'history') return 'Riwayat belajar'
  if (page === 'admin') return 'Kelola konten'
  return ''
}

function ProfilePicker({ profiles, onSelect }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('student')
  const [error, setError] = useState('')
  const submit = (event) => {
    event.preventDefault()
    if (!name.trim()) { setError('Nama perlu diisi terlebih dahulu.'); return }
    onSelect(name, role).catch((err) => { console.error(err); setError('Profil tidak dapat disimpan ke perangkat ini.') })
  }
  return <div className="grid min-h-screen bg-[#f7f8fc] lg:grid-cols-2">
    <div className="relative hidden overflow-hidden bg-[#6b5bdd] p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-20">
      <div className="relative z-10 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15"><BookOpen /></div><span className="text-lg font-extrabold">Ruang Iman</span></div>
      <div className="relative z-10 max-w-lg pb-10"><div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold"><Sparkles size={14} /> BELAJAR PAK DENGAN CARA BARU</div><h1 className="text-5xl font-extrabold leading-[1.17] tracking-tight xl:text-6xl">Tumbuh dalam iman, <span className="text-[#d8d2ff]">satu langkah</span> setiap hari.</h1><p className="mt-6 max-w-md text-base leading-7 text-white/75">Jelajahi permainan dan uji pemahamanmu dalam Pendidikan Agama Kristen.</p></div>
      <div className="relative z-10 text-xs text-white/55">Ruang belajar yang aman untuk bertumbuh bersama.</div>
      <div className="absolute -right-36 top-16 h-[470px] w-[470px] rounded-full border border-white/10" /><div className="absolute -right-24 top-28 h-[360px] w-[360px] rounded-full border border-white/10" /><div className="absolute bottom-12 right-20 h-32 w-32 rounded-full bg-white/5 blur-sm" />
    </div>
    <div className="flex items-center justify-center p-6 sm:p-10"><form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-7 shadow-card sm:p-10">
      <div className="mb-8 lg:hidden"><div className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-brand text-white"><BookOpen /></div><span className="font-extrabold">Ruang Iman</span></div>
      <span className="text-xs font-bold uppercase tracking-[.15em] text-brand">Selamat datang</span><h2 className="mt-2 text-3xl font-extrabold tracking-tight">Mulai belajar</h2><p className="mt-2 text-sm leading-6 text-muted">Buat profil lokal untuk masuk ke ruang belajarmu.</p>
      <label className="mb-2 mt-7 block text-sm font-bold">Nama panggilan</label><input value={name} onChange={(e) => { setName(e.target.value); setError('') }} placeholder="Contoh: Maria" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-violet-100" />
      <label className="mb-2 mt-5 block text-sm font-bold">Saya masuk sebagai</label><div className="grid grid-cols-2 gap-3">
        {[['student', 'Siswa'], ['admin', 'Guru / Admin']].map(([value, label]) => <button type="button" key={value} onClick={() => { setRole(value); setError('') }} className={`rounded-xl border p-3.5 text-sm font-bold transition ${role === value ? 'border-brand bg-lilac text-brand' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}><UserRound className="mx-auto mb-1.5" size={18} />{label}</button>)}
      </div>
      {error && <p role="alert" className="mt-3 text-xs font-semibold text-rose-600">{error}</p>}
      <button className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-200 transition hover:bg-[#5848cc]">Masuk ke aplikasi <ArrowRight size={16} /></button>
      <p className="mt-5 text-center text-[11px] leading-5 text-slate-400">Profil hanya tersimpan di perangkat ini dan bukan sistem keamanan sungguhan.</p>
      {profiles.length > 0 && <div className="mt-5 border-t border-slate-100 pt-4"><p className="mb-2 text-xs font-bold text-slate-400">Profil di perangkat ini</p><div className="flex flex-wrap gap-2">{profiles.map((p) => <button key={p.id} type="button" onClick={() => { setName(p.name); setRole(p.role) }} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">{p.name} · {p.role === 'admin' ? 'Guru' : 'Siswa'}</button>)}</div></div>}
    </form></div>
  </div>
}

function HomePage({ profile, content, onNavigate, onStartGame }) {
  const firstName = profile.name.split(' ')[0]
  const best = content.attempts.filter((a) => a.profileId === profile.id).reduce((value, item) => Math.max(value, item.score), 0)
  return <div className="space-y-8">
    <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-[#6759dc] to-[#8172ed] px-7 py-8 text-white shadow-lg shadow-violet-200 sm:px-10 sm:py-10">
      <div className="relative z-[1] max-w-xl"><span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold"><Sparkles size={13} /> RUANG BELAJAR PAK</span><h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">Hai, {firstName}!<br />Siap belajar hari ini?</h1><p className="mt-3 max-w-md text-sm leading-6 text-white/75">Pilih permainan atau tantang dirimu dengan latihan CBT. Setiap langkah kecil berarti.</p><button onClick={() => onNavigate('games')} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-brand transition hover:bg-violet-50">Mulai belajar <ArrowRight size={16} /></button></div>
      <div className="absolute -right-10 -top-20 h-72 w-72 rounded-full border-[35px] border-white/10 sm:right-12 sm:top-[-95px] sm:h-[360px] sm:w-[360px]"><div className="absolute inset-9 rounded-full border border-white/20" /></div><div className="absolute bottom-7 right-[16%] hidden rotate-[-12deg] rounded-2xl bg-white/10 p-4 text-white/80 sm:block"><BookOpen size={34} /></div>
    </section>
    <section className="grid gap-4 sm:grid-cols-3">
      <StatCard icon={Gamepad2} label="Permainan tersedia" value="3" sub="Siap untuk dijelajahi" color="violet" />
      <StatCard icon={Trophy} label="Nilai terbaikmu" value={`${best}%`} sub="Dari hasil ujian CBT" color="amber" />
      <StatCard icon={BookOpen} label="Topik pembelajaran" value={content.topics.length} sub="Materi Pendidikan Agama Kristen" color="emerald" />
    </section>
    <section><SectionHeading title="Pilih permainan" action="Lihat semua" onAction={() => onNavigate('games')} /><div className="mt-4 grid gap-4 md:grid-cols-3">{games.map((game) => <GameCard key={game.id} game={game} onClick={() => { onNavigate('games'); onStartGame(game.id) }} />)}</div></section>
    <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card sm:p-6"><SectionHeading title="Lanjutkan perjalananmu" /><div className="mt-4 flex items-center gap-4 rounded-xl bg-[#f8f7ff] p-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white text-brand"><GraduationCap size={24} /></div><div className="min-w-0 flex-1"><p className="font-bold">Latihan PAK SMA</p><p className="mt-1 text-xs text-muted">{content.questions.length} soal · Pilihan ganda & isian</p></div><button onClick={() => onNavigate('exam')} aria-label="Lihat ujian" className="rounded-lg bg-white p-2 text-brand hover:bg-lilac"><ArrowRight size={18} /></button></div></div>
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card sm:p-6"><SectionHeading title="Topik belajar" /><div className="mt-3 divide-y divide-slate-100">{content.topics.slice(0, 3).map((topic, i) => <div key={topic.id} className="flex items-center gap-3 py-3"><div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-50 text-xs font-bold text-brand">0{i + 1}</div><div><p className="text-sm font-bold">{topic.title}</p><p className="text-[11px] text-muted">Kelas {topic.grade}</p></div><ChevronDown className="ml-auto -rotate-90 text-slate-300" size={16} /></div>)}</div></div>
    </section>
  </div>
}

function StatCard({ icon: Icon, label, value, sub, color }) {
  const colors = { violet: 'bg-violet-100 text-violet-700', amber: 'bg-amber-100 text-amber-700', emerald: 'bg-emerald-100 text-emerald-700' }
  return <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold text-muted">{label}</p><p className="mt-2 text-3xl font-extrabold tracking-tight">{value}</p></div><div className={`grid h-10 w-10 place-items-center rounded-xl ${colors[color]}`}><Icon size={19} /></div></div><p className="mt-2 text-[11px] text-slate-400">{sub}</p></div>
}

function SectionHeading({ title, action, onAction }) {
  return <div className="flex items-center justify-between"><h2 className="text-lg font-extrabold tracking-tight">{title}</h2>{action && <button onClick={onAction} className="flex items-center gap-1 text-xs font-bold text-brand hover:underline">{action}<ArrowRight size={14} /></button>}</div>
}

function GameCard({ game, onClick }) {
  const Icon = game.icon
  return <button onClick={onClick} className="group rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-card transition hover:-translate-y-1 hover:shadow-lg"><div className="flex items-start justify-between"><div className={`grid h-11 w-11 place-items-center rounded-xl ${game.color}`}><Icon size={21} /></div><span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-500">{game.tag}</span></div><h3 className="mt-5 font-extrabold">{game.title}</h3><p className="mt-1 text-xs leading-5 text-muted">{game.description}</p><div className="mt-4 flex items-center gap-1 text-xs font-bold text-brand">Main sekarang <ArrowRight size={14} className="transition group-hover:translate-x-1" /></div></button>
}

function GamesPage({ onStart }) {
  return <div><div className="mb-6"><p className="text-sm text-muted">Belajar terasa lebih seru saat sambil bermain.</p></div><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{games.map((game) => <GameCard key={game.id} game={game} onClick={() => onStart(game.id)} />)}</div></div>
}

function GamePage({ game, content, profile, onBack, onToast, onSaved }) {
  const [round, setRound] = useState(0)
  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState('')
  const [guesses, setGuesses] = useState(0)
  const [usedHints, setUsedHints] = useState(0)
  const [crossAnswers, setCrossAnswers] = useState({})
  const [finished, setFinished] = useState(false)
  const [finalScore, setFinalScore] = useState(0)
  const record = async (score, name) => {
    await db.gameHistory.add({ profileId: profile.id, profileName: profile.name, game: name, score, createdAt: new Date().toISOString() })
    await onSaved()
  }
  const finish = (score, name) => {
    setFinalScore(score)
    setFinished(true)
    record(score, name).catch((error) => { console.error(error); onToast('Hasil permainan tidak dapat disimpan.') })
  }
  const restart = () => { setRound(0); setInput(''); setFeedback(''); setGuesses(0); setUsedHints(0); setCrossAnswers({}); setFinished(false); setFinalScore(0) }

  if (game === 'chain') return <ChainGame chains={content.wordChains} profile={profile} onBack={onBack} onToast={onToast} onSaved={onSaved} />

  if (game === 'secret') {
    const secret = content.secrets[round % Math.max(content.secrets.length, 1)]
    if (!secret) return <EmptyState title="Belum ada kata rahasia" text="Guru dapat menambahkan permainan kata rahasia melalui pengelolaan konten." onBack={onBack} />
    const check = () => {
      if (!input.trim()) { setFeedback('Isi tebakanmu terlebih dahulu.'); return }
      setGuesses((n) => n + 1)
      if (isValidSecretGuess(input, secret.answer)) { setFeedback('Benar! Kamu berhasil menemukan kata rahasia.'); finish(Math.max(50, 100 - guesses * 10), 'Kata Rahasia') }
      else if (guesses >= 2) { setFeedback(`Jawaban yang tepat adalah ${secret.answer}.`); finish(0, 'Kata Rahasia') }
      else setFeedback('Belum tepat, coba pikirkan lagi.')
    }
    return <div className="mx-auto max-w-3xl"><button onClick={onBack} className="mb-5 flex items-center gap-2 text-sm font-bold text-muted hover:text-brand"><ArrowLeft size={16} /> Kembali ke permainan</button><GameShell title="Kata Rahasia" description="Gunakan petunjuk untuk menemukan jawabannya." icon={HelpCircle} finished={finished} score={finalScore} restart={restart} resultDetail={<p className="mx-auto mt-4 max-w-md rounded-xl bg-slate-50 p-4 text-sm text-slate-600">{secret.explanation} Jawaban: <b>{secret.answer}</b>.</p>}>
      {!finished && <><label className="mb-4 block text-xs font-bold text-slate-500">Pilih topik kata<select value={round} onChange={(e) => { setRound(Number(e.target.value)); setInput(''); setFeedback(''); setGuesses(0); setUsedHints(0) }} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">{content.secrets.map((item, i) => <option key={item.id} value={i}>{item.answer.length} huruf · {item.clue}</option>)}</select></label><div className="rounded-2xl bg-amber-50 p-6"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-700"><Lightbulb size={15} /> Petunjuk utama</p><p className="mt-3 text-lg font-bold leading-7 text-ink">{secret.clue}</p></div>{usedHints > 0 && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{secret.hints.slice(0, usedHints).map((hint, i) => <p key={i} className="mt-1">• {hint}</p>)}</div>}<div className="mt-5 flex flex-col gap-3 sm:flex-row"><input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && check()} placeholder="Tulis tebakanmu…" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-brand focus:ring-4 focus:ring-violet-100" /><button onClick={check} className="rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white">Periksa jawaban</button></div><p role="status" className="mt-3 min-h-5 text-sm font-semibold text-rose-500">{feedback}</p><div className="mt-2 flex items-center justify-between"><button onClick={() => setUsedHints((n) => Math.min(n + 1, secret.hints.length))} disabled={usedHints >= secret.hints.length} className="flex items-center gap-1 text-xs font-bold text-amber-700 disabled:opacity-40"><Lightbulb size={14} /> Buka petunjuk ({usedHints}/{secret.hints.length})</button><span className="text-xs text-muted">Percobaan: {guesses}/3</span></div></>}
    </GameShell></div>
  }

  const puzzle = content.crosswords[round % Math.max(content.crosswords.length, 1)]
  if (!puzzle) return <EmptyState title="Belum ada teka-teki silang" text="Guru dapat menambahkan teka-teki silang melalui pengelolaan konten." onBack={onBack} />
  const cells = Array.from({ length: puzzle.size }, () => Array(puzzle.size).fill(null))
  puzzle.placements.forEach((word) => [...word.answer].forEach((letter, i) => {
    const row = word.row + (word.direction === 'down' ? i : 0)
    const col = word.col + (word.direction === 'across' ? i : 0)
    cells[row][col] ??= { placements: [] }
    cells[row][col].placements.push({ id: word.id, offset: i })
  }))
  const verifyPuzzle = () => {
    const correct = puzzle.placements.filter((word) => normalize(crossAnswers[word.id] || '') === normalize(word.answer)).length
    finish(Math.round((correct / puzzle.placements.length) * 100), 'Teka-Teki Silang')
  }
  return <div className="mx-auto max-w-3xl"><button onClick={onBack} className="mb-5 flex items-center gap-2 text-sm font-bold text-muted hover:text-brand"><ArrowLeft size={16} /> Kembali ke permainan</button><GameShell title="Teka-Teki Silang" description={puzzle.title} icon={Grid2X2} finished={finished} score={finalScore} restart={restart} resultDetail={<p className="mx-auto mt-4 max-w-md rounded-xl bg-slate-50 p-4 text-sm text-slate-600">{puzzle.explanation} Jawaban: {puzzle.placements.map((word) => `${word.direction === 'across' ? 'mendatar' : 'menurun'} ${word.answer}`).join('; ')}.</p>}>
    {!finished && <><label className="mb-4 block text-xs font-bold text-slate-500">Pilih teka-teki<select value={round} onChange={(e) => { setRound(Number(e.target.value)); setCrossAnswers({}) }} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">{content.crosswords.map((item, i) => <option key={item.id} value={i}>{item.title}</option>)}</select></label><div className="mb-6 overflow-auto"><div className="mx-auto grid w-fit gap-1" style={{ gridTemplateColumns: `repeat(${puzzle.size}, 42px)` }}>{cells.flatMap((row, r) => row.map((cell, c) => <div key={`${r}-${c}`} className={`grid h-[42px] w-[42px] place-items-center rounded-md text-sm font-extrabold ${cell ? 'bg-white ring-1 ring-slate-200' : 'bg-transparent'}`}>{cell && <span className="text-brand">{cell.placements.map(({ id, offset }) => crossAnswers[id]?.[offset] || '').find(Boolean) || ''}</span>}</div>))}</div></div><div className="space-y-4">{puzzle.placements.map((word) => <label key={word.id} className="block rounded-xl bg-slate-50 p-4"><span className="text-xs font-bold uppercase text-brand">{word.direction === 'across' ? 'Mendatar' : 'Menurun'} · {word.id}</span><span className="mt-1 block text-sm font-semibold">{word.clue}</span><input value={crossAnswers[word.id] || ''} maxLength={word.answer.length} onChange={(e) => setCrossAnswers((old) => ({ ...old, [word.id]: e.target.value.toUpperCase() }))} placeholder={`${word.answer.length} huruf`} className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm uppercase tracking-widest outline-none focus:border-brand" /></label>)}</div><button onClick={verifyPuzzle} className="mt-5 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white">Periksa teka-teki</button></>}
  </GameShell></div>
}

function ChainGame({ chains, profile, onBack, onToast, onSaved }) {
  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState('')
  const [chainIndex, setChainIndex] = useState(0)
  const [lastWord, setLastWord] = useState(chains[0]?.startWord || 'IMAN')
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)
  const chain = chains[chainIndex]
  const words = chain?.words || ['nyata', 'anugerah', 'harapan', 'nasihat']
  const send = () => {
    if (!input.trim()) { setFeedback('Ketik sebuah kata terlebih dahulu.'); return }
    if (!checkChainWord(input, lastWord, words)) { setFeedback('Belum tepat. Perhatikan huruf terakhir kata sebelumnya.'); return }
    setScore((value) => value + 10)
    setLastWord(input.trim())
    setInput('')
    setFeedback('Tepat! Kata yang baik membangun makna.')
  }
  const finish = async () => {
    setFinished(true)
    try {
      await db.gameHistory.add({ profileId: profile.id, profileName: profile.name, game: 'Sambung Kata', score, createdAt: new Date().toISOString() })
      await onSaved()
    } catch (error) { console.error(error); onToast('Hasil permainan tidak dapat disimpan.') }
  }
  const restart = () => { setInput(''); setFeedback(''); setLastWord(chain?.startWord || 'IMAN'); setScore(0); setFinished(false) }
  return <div className="mx-auto max-w-3xl"><button onClick={onBack} className="mb-5 flex items-center gap-2 text-sm font-bold text-muted hover:text-brand"><ArrowLeft size={16} /> Kembali ke permainan</button><GameShell title="Sambung Kata" description="Sambungkan kata baru dari huruf terakhir kata sebelumnya." icon={ArrowRight} finished={finished} score={score} restart={restart}>
    {!finished && <><label className="mb-4 block text-xs font-bold text-slate-500">Pilih rangkaian<select value={chainIndex} onChange={(e) => { const index = Number(e.target.value); setChainIndex(index); setLastWord(chains[index]?.startWord || 'IMAN'); setInput(''); setFeedback(''); setScore(0) }} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">{chains.map((item, i) => <option key={item.id} value={i}>{item.startWord}</option>)}</select></label><div className="rounded-2xl bg-[#f5f3ff] p-7 text-center"><p className="text-xs font-bold uppercase tracking-widest text-brand">Kata terakhir</p><p className="mt-2 text-4xl font-extrabold tracking-widest text-ink">{lastWord.toLocaleUpperCase('id-ID')}</p><p className="mt-2 text-xs text-muted">Mulai kata berikutnya dengan huruf <b className="text-brand">{lastWord.slice(-1).toLocaleUpperCase('id-ID')}</b></p></div><div className="mt-5 flex flex-col gap-3 sm:flex-row"><input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Ketik kata di sini…" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-brand focus:ring-4 focus:ring-violet-100" /><button onClick={send} className="rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white hover:bg-[#5848cc]">Sambungkan</button></div><p role="status" className={`mt-3 min-h-5 text-sm font-semibold ${feedback.startsWith('Tepat') ? 'text-emerald-600' : 'text-rose-500'}`}>{feedback}</p><p className="mt-2 text-xs text-muted">Skor: <b>{score}</b> · Kata tersambung: <b>{Math.floor(score / 10)}</b></p><button onClick={finish} className="mt-6 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">Selesai bermain</button></>}
  </GameShell></div>
}

function GameShell({ title, description, icon: Icon, children, finished, score, restart, resultDetail }) {
  return <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-card sm:p-8"><div className="mb-6 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-lilac text-brand"><Icon size={22} /></div><div><h1 className="text-xl font-extrabold">{finished ? 'Permainan selesai!' : title}</h1><p className="mt-1 text-xs text-muted">{finished ? `Skor akhir: ${score}` : description}</p></div></div>{finished ? <div className="py-7 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-600"><Trophy size={28} /></div><p className="mt-4 text-4xl font-extrabold">{score}<span className="text-lg text-muted">/100</span></p><p className="mt-2 text-sm text-muted">Terima kasih sudah berlatih. Terus bertumbuh!</p>{resultDetail}<button onClick={restart} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white"><RotateCcw size={16} /> Main lagi</button></div> : children}</div>
}

function EmptyState({ title, text, onBack }) {
  return <div className="rounded-2xl bg-white p-8 text-center shadow-card"><Grid2X2 className="mx-auto mb-3 text-slate-300" size={30} /><h2 className="font-extrabold">{title}</h2><p className="mt-2 text-sm text-muted">{text}</p>{onBack && <button onClick={onBack} className="mt-4 text-sm font-bold text-brand">Kembali</button>}</div>
}

function ExamPage({ exams, onStart }) {
  return <div><p className="mb-6 text-sm text-muted">Kerjakan ujian dengan tenang dan tinjau jawabanmu sebelum mengumpulkan.</p><div className="grid gap-4 md:grid-cols-2">{exams.map((exam) => <article key={exam.id} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-card"><div className="flex items-start justify-between"><div className="grid h-11 w-11 place-items-center rounded-xl bg-violet-100 text-brand"><ListChecks size={21} /></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">Siap dikerjakan</span></div><h2 className="mt-5 text-lg font-extrabold">{exam.title}</h2><p className="mt-1 text-sm text-muted">Kelas {exam.grade}</p><div className="my-5 grid grid-cols-2 gap-3 border-y border-slate-100 py-4 text-xs"><div className="flex items-center gap-2 text-slate-500"><Clock3 size={15} /> {exam.duration} menit</div><div className="flex items-center gap-2 text-slate-500"><BookOpen size={15} /> {exam.questionIds?.length || 0} soal</div><div className="flex items-center gap-2 text-slate-500"><Trophy size={15} /> Nilai lulus {exam.passScore}%</div></div><button onClick={() => onStart(exam)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-bold text-white hover:bg-[#5848cc]">Mulai ujian <ArrowRight size={16} /></button></article>)}</div><div className="mt-6 flex gap-3 rounded-xl bg-amber-50 p-4 text-xs leading-5 text-amber-900"><ShieldCheck className="mt-0.5 shrink-0" size={16} /><p>Aplikasi ini berjalan sepenuhnya di perangkat. Ini bukan sistem pengawasan ujian berbasis server; data lokal dapat diakses oleh pengguna perangkat.</p></div></div>
}

function ExamRunner({ run, setRun, onSubmit, onBack }) {
  const [secondsLeft, setSecondsLeft] = useState(Math.max(0, run.exam.duration * 60 - Math.floor((Date.now() - run.startedAt) / 1000)))
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [sessionSaveError, setSessionSaveError] = useState(false)
  const submitting = useRef(false)
  const submit = async (candidate) => {
    if (submitting.current) return
    submitting.current = true
    if (!(await onSubmit(candidate))) submitting.current = false
  }
  useEffect(() => {
    if (run.result) return undefined
    if (secondsLeft <= 0) { submit(run); return undefined }
    const timer = window.setInterval(() => setSecondsLeft((seconds) => seconds - 1), 1000)
    return () => window.clearInterval(timer)
  }, [secondsLeft, run.result])
  useEffect(() => {
    if (run.result || !run.profileId || submitting.current) return
    const persist = async () => {
      const saved = await db.examSessions.where({ profileId: run.profileId, status: 'in-progress' }).first()
      if (submitting.current) return
      const payload = { examId: run.exam.id, exam: run.exam, questions: run.questions, answers: run.answers, index: run.index, startedAt: run.startedAt, profileId: run.profileId, status: 'in-progress' }
      if (saved) await db.examSessions.update(saved.id, payload)
      else await db.examSessions.add(payload)
      setSessionSaveError(false)
    }
    persist().catch((error) => {
      console.error('Gagal menyimpan sesi ujian lokal.', error)
      setSessionSaveError(true)
    })
  }, [run])
  const question = run.questions[run.index]
  const answered = Object.keys(run.answers).length
  const formatTime = (value) => `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`
  const answer = (value) => setRun((old) => ({ ...old, answers: { ...old.answers, [question.id]: value } }))
  const move = (index) => setRun((old) => ({ ...old, index: Math.max(0, Math.min(old.questions.length - 1, index)) }))
  if (run.result) return <div className="mx-auto max-w-3xl rounded-3xl bg-white p-7 text-center shadow-card sm:p-10"><div className={`mx-auto grid h-16 w-16 place-items-center rounded-full ${run.result.score >= run.exam.passScore ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{run.result.score >= run.exam.passScore ? <CheckCircle2 size={30} /> : <Trophy size={30} />}</div><p className="mt-5 text-xs font-bold uppercase tracking-widest text-brand">Hasil ujian</p><h1 className="mt-2 text-2xl font-extrabold">{run.result.score >= run.exam.passScore ? 'Selamat, kamu lulus!' : 'Terus berlatih, ya!'}</h1><p className="mt-4 text-5xl font-extrabold">{run.result.score}<span className="text-xl text-muted">%</span></p><p className="mt-2 text-sm text-muted">{run.result.correct} dari {run.result.total} jawaban benar</p><div className="mt-7 space-y-3 text-left">{run.questions.map((q, i) => <div key={q.id} className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-400">SOAL {i + 1} · {isAnswerCorrect(run.answers[q.id] || '', q) ? <span className="text-emerald-600">Benar</span> : <span className="text-rose-500">Belum tepat</span>}</p><p className="mt-2 text-sm font-semibold">{q.prompt}</p>{run.exam.showExplanation && <p className="mt-2 text-xs leading-5 text-muted">Jawaban yang diterima: <b>{[q.answer, ...(q.acceptedAnswers || [])].join(', ')}</b>. {q.explanation}</p>}</div>)}</div><button onClick={onBack} className="mt-7 rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white">Kembali</button></div>
  return <div className="mx-auto max-w-5xl"><div className="mb-5 flex items-center justify-between"><button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-muted hover:text-brand"><ArrowLeft size={16} /> Keluar dari ujian</button><div className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold ${secondsLeft < 60 ? 'bg-rose-50 text-rose-600' : 'bg-white text-ink shadow-card'}`}><Clock3 size={16} /> {formatTime(Math.max(0, secondsLeft))}</div></div>{sessionSaveError && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">Jawaban sesi ujian tidak dapat disimpan. Jangan muat ulang sebelum masalah penyimpanan diperbaiki.</p>}<div className="grid gap-5 lg:grid-cols-[1fr_260px]"><section className="rounded-2xl bg-white p-6 shadow-card sm:p-8"><div className="mb-6 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wider text-brand">{run.exam.title}</span><span className="text-xs font-semibold text-muted">Terjawab {answered}/{run.questions.length}</span></div><div className="mb-6 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${((run.index + 1) / run.questions.length) * 100}%` }} /></div><p className="text-xs font-bold text-slate-400">PERTANYAAN {run.index + 1}</p><h1 className="mt-3 text-xl font-extrabold leading-8">{question.prompt}</h1>{question.type === 'choice' ? <div className="mt-6 space-y-3">{question.options.map((option, i) => <button key={option} onClick={() => answer(option)} className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left text-sm font-semibold transition ${run.answers[question.id] === option ? 'border-brand bg-lilac text-brand' : 'border-slate-200 hover:border-violet-200 hover:bg-slate-50'}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-extrabold ${run.answers[question.id] === option ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500'}`}>{String.fromCharCode(65 + i)}</span>{option}{run.answers[question.id] === option && <Check className="ml-auto" size={17} />}</button>)}</div> : <input value={run.answers[question.id] || ''} onChange={(e) => answer(e.target.value)} placeholder="Tulis jawaban singkatmu…" className="mt-6 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-brand focus:ring-4 focus:ring-violet-100" />}<div className="mt-8 flex justify-between"><button onClick={() => move(run.index - 1)} disabled={run.index === 0} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold disabled:opacity-40"><ArrowLeft size={15} /> Sebelumnya</button>{run.index < run.questions.length - 1 ? <button onClick={() => move(run.index + 1)} className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white">Selanjutnya <ArrowRight size={15} /></button> : <button onClick={() => setConfirmSubmit(true)} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white"><Check size={15} /> Kumpulkan</button>}</div></section><aside className="h-fit rounded-2xl bg-white p-5 shadow-card"><h2 className="font-extrabold">Navigasi soal</h2><p className="mt-1 text-xs text-muted">Pilih nomor untuk meninjau jawaban.</p><div className="mt-4 grid grid-cols-5 gap-2">{run.questions.map((q, i) => <button key={q.id} onClick={() => move(i)} className={`grid h-9 place-items-center rounded-lg text-xs font-bold ${i === run.index ? 'bg-brand text-white' : run.answers[q.id] ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</button>)}</div><div className="mt-5 border-t border-slate-100 pt-4"><p className="text-xs text-muted">{run.questions.length - answered} soal belum dijawab</p><button onClick={() => setConfirmSubmit(true)} className="mt-3 w-full rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50">Kumpulkan ujian</button></div></aside></div>{confirmSubmit && <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/30 p-5"><div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"><h2 className="text-lg font-extrabold">Kumpulkan ujian?</h2><p className="mt-2 text-sm leading-6 text-muted">{run.questions.length - answered ? `Masih ada ${run.questions.length - answered} soal yang belum dijawab. ` : ''}Jawaban tidak dapat diubah setelah dikumpulkan.</p><div className="mt-5 flex justify-end gap-2"><button onClick={() => setConfirmSubmit(false)} className="rounded-lg px-4 py-2 text-sm font-bold text-slate-500">Periksa lagi</button><button onClick={() => { setConfirmSubmit(false); submit(run) }} className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white">Ya, kumpulkan</button></div></div></div>}</div>
}

function HistoryPage({ attempts, games: gameHistory, profile }) {
  const mine = attempts.filter((item) => item.profileId === profile.id)
  const myGames = gameHistory.filter((item) => item.profileId === profile.id)
  return <div><p className="mb-6 text-sm text-muted">Hasil permainan dan ujian yang tersimpan di perangkat ini.</p><div className="grid gap-4 sm:grid-cols-3"><StatCard icon={ListChecks} label="Ujian selesai" value={mine.length} sub="Total percobaan" color="violet" /><StatCard icon={Trophy} label="Nilai terbaik" value={`${mine.reduce((max, a) => Math.max(max, a.score), 0)}%`} sub="Dari semua ujian" color="amber" /><StatCard icon={Gamepad2} label="Permainan" value={myGames.length} sub="Sesi permainan selesai" color="emerald" /></div><div className="mt-6 rounded-2xl bg-white p-5 shadow-card sm:p-7"><h2 className="text-lg font-extrabold">Riwayat aktivitas</h2>{!mine.length && !myGames.length ? <p className="py-10 text-center text-sm text-muted">Belum ada riwayat. Mulai belajar untuk melihat aktivitasmu di sini.</p> : <div className="mt-4 divide-y divide-slate-100">{[...mine.map((x) => ({ ...x, label: x.examTitle || 'Ujian CBT', kind: 'Ujian' })), ...myGames.map((x) => ({ ...x, label: x.game, kind: 'Permainan' }))].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map((item, i) => <div key={`${item.kind}-${i}`} className="flex items-center gap-3 py-4"><div className="grid h-10 w-10 place-items-center rounded-xl bg-lilac text-brand">{item.kind === 'Ujian' ? <ListChecks size={18} /> : <Gamepad2 size={18} />}</div><div className="min-w-0 flex-1"><p className="text-sm font-bold">{item.label}</p><p className="mt-1 text-xs text-muted">{item.kind} · {new Date(item.createdAt).toLocaleString('id-ID')}</p></div><span className={`rounded-full px-3 py-1 text-xs font-extrabold ${item.score >= 60 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{item.score}%</span></div>)}</div>}</div></div>
}

function AdminPage({ content, onRefresh, onToast }) {
  const [tab, setTab] = useState('questions')
  const [saving, setSaving] = useState(false)
  const [newQuestion, setNewQuestion] = useState({ prompt: '', grade: 'X', type: 'choice', answer: '', optionA: '', optionB: '', optionC: '', optionD: '', explanation: '' })
  const [newTopic, setNewTopic] = useState({ title: '', grade: 'X', description: '' })
  const [newSecret, setNewSecret] = useState({ answer: '', clue: '', hints: ['', ''], topicId: 1, explanation: '' })
  const [newChain, setNewChain] = useState({ startWord: '', words: '', topicId: 1, explanation: '' })
  const [newCrossword, setNewCrossword] = useState({ title: '', topicId: 1, acrossAnswer: '', acrossClue: '', downAnswer: '', downClue: '', explanation: '' })
  const [newExam, setNewExam] = useState({ title: '', grade: 'X', duration: 20, passScore: 60, questionIds: [], shuffle: true, shuffleOptions: true, showExplanation: true })
  const tabs = [['questions', 'Bank soal'], ['topics', 'Materi'], ['chains', 'Sambung kata'], ['secrets', 'Kata rahasia'], ['crosswords', 'Teka-teki silang'], ['exams', 'Ujian'], ['backup', 'Cadangan']]
  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      if (tab === 'questions') {
        const options = [newQuestion.optionA, newQuestion.optionB, newQuestion.optionC, newQuestion.optionD]
        if (newQuestion.type === 'choice' && (options.some((x) => !x.trim()) || new Set(options.map(normalize)).size !== 4 || !options.includes(newQuestion.answer))) throw new Error('Lengkapi empat pilihan yang berbeda dan pastikan jawaban benar sama dengan salah satu pilihan.')
        if (!newQuestion.prompt.trim() || !newQuestion.answer.trim()) throw new Error('Pertanyaan dan jawaban harus diisi.')
        const topic = content.topics.find((item) => item.grade === newQuestion.grade) || content.topics[0]
        await db.questions.add({ prompt: newQuestion.prompt.trim(), answer: newQuestion.answer.trim(), acceptedAnswers: [], type: newQuestion.type, options: newQuestion.type === 'choice' ? options : [], explanation: newQuestion.explanation.trim() || 'Tinjau kembali materi bersama guru.', topicId: topic?.id, grade: newQuestion.grade })
        setNewQuestion({ prompt: '', grade: 'X', type: 'choice', answer: '', optionA: '', optionB: '', optionC: '', optionD: '', explanation: '' })
      } else if (tab === 'topics') {
        if (!newTopic.title.trim()) throw new Error('Nama topik harus diisi.')
        await db.topics.add({ ...newTopic, title: newTopic.title.trim(), description: newTopic.description.trim() })
        setNewTopic({ title: '', grade: 'X', description: '' })
      } else if (tab === 'secrets') {
        if (!newSecret.answer.trim() || !newSecret.clue.trim()) throw new Error('Jawaban dan petunjuk utama harus diisi.')
        await db.secrets.add({ ...newSecret, answer: newSecret.answer.trim().toUpperCase(), hints: newSecret.hints.filter((hint) => hint.trim()) })
        setNewSecret({ answer: '', clue: '', hints: ['', ''], topicId: 1, explanation: '' })
      } else if (tab === 'chains') {
        const words = newChain.words.split(',').map((word) => word.trim()).filter(Boolean)
        if (!newChain.startWord.trim() || !words.length) throw new Error('Kata awal dan minimal satu kata sambungan harus diisi.')
        let previous = newChain.startWord
        for (const word of words) {
          if (!normalize(word).startsWith(normalize(previous).slice(-1))) throw new Error(`Kata “${word}” harus dimulai dengan huruf ${previous.slice(-1).toLocaleUpperCase('id-ID')}.`)
          previous = word
        }
        await db.wordChains.add({ ...newChain, topicId: Number(newChain.topicId), startWord: newChain.startWord.trim(), words, explanation: newChain.explanation.trim() })
        setNewChain({ startWord: '', words: '', topicId: 1, explanation: '' })
      } else if (tab === 'crosswords') {
        const across = newCrossword.acrossAnswer.trim().toUpperCase()
        const down = newCrossword.downAnswer.trim().toUpperCase()
        if (!newCrossword.title.trim() || !newCrossword.acrossClue.trim() || !newCrossword.downClue.trim()) throw new Error('Judul dan kedua petunjuk harus diisi.')
        if (!/^[A-Z]{2,12}$/.test(across) || !/^[A-Z]{2,12}$/.test(down)) throw new Error('Jawaban teka-teki harus terdiri dari 2–12 huruf tanpa spasi.')
        const cross = [...across].flatMap((letter, acrossIndex) => [...down].map((other, downIndex) => ({ letter, other, acrossIndex, downIndex })).filter((item) => item.letter === item.other))[0]
        if (!cross) throw new Error('Jawaban mendatar dan menurun harus memiliki minimal satu huruf yang sama.')
        const size = Math.max(across.length, down.length)
        await db.crosswords.add({
          title: newCrossword.title.trim(), topicId: Number(newCrossword.topicId), size,
          placements: [
            { id: 1, direction: 'across', row: cross.downIndex, col: 0, answer: across, clue: newCrossword.acrossClue.trim() },
            { id: 2, direction: 'down', row: 0, col: cross.acrossIndex, answer: down, clue: newCrossword.downClue.trim() },
          ],
          explanation: newCrossword.explanation.trim() || 'Tinjau kembali hubungan kedua kata bersama guru.',
        })
        setNewCrossword({ title: '', topicId: 1, acrossAnswer: '', acrossClue: '', downAnswer: '', downClue: '', explanation: '' })
      } else if (tab === 'exams') {
        if (!newExam.title.trim() || !newExam.questionIds.length) throw new Error('Judul ujian dan minimal satu soal harus dipilih.')
        if (newExam.questionIds.some((id) => {
          const question = content.questions.find((item) => item.id === id)
          return !question || (newExam.grade !== 'Semua kelas' && question.grade !== newExam.grade)
        })) throw new Error('Pastikan semua soal sesuai dengan kelas ujian yang dipilih.')
        await db.exams.add({ ...newExam, title: newExam.title.trim(), duration: Number(newExam.duration), passScore: Number(newExam.passScore) })
        setNewExam({ title: '', grade: 'X', duration: 20, passScore: 60, questionIds: [], shuffle: true, shuffleOptions: true, showExplanation: true })
      }
      await onRefresh()
      onToast('Konten berhasil disimpan.')
    } catch (error) {
      onToast(error.message || 'Konten tidak dapat disimpan.')
    } finally { setSaving(false) }
  }
  const remove = async (table, id) => {
    if (!window.confirm('Hapus konten ini? Tindakan ini tidak dapat dibatalkan.')) return
    try { await db[table].delete(id); await onRefresh(); onToast('Konten berhasil dihapus.') }
    catch (error) { console.error(error); onToast('Konten tidak dapat dihapus.') }
  }
  const download = async () => {
    try {
      const payload = await exportDatabase()
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url; link.download = 'ruang-iman-cadangan.json'; link.click(); URL.revokeObjectURL(url)
      onToast('Cadangan berhasil diunduh.')
    } catch (error) { console.error(error); onToast('Cadangan gagal dibuat.') }
  }
  const upload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const payload = JSON.parse(await file.text())
      if (!window.confirm('Impor akan mengganti seluruh data materi, soal, dan ujian. Buat cadangan terlebih dahulu. Lanjutkan?')) return
      await importDatabase(payload); await onRefresh(); onToast('Data cadangan berhasil dipulihkan.')
    } catch (error) { console.error(error); onToast(error.message || 'Berkas tidak dapat diimpor.') }
    finally { event.target.value = '' }
  }
  const inputClass = 'w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-violet-100'
  return <div><div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm text-muted">Kelola konten pembelajaran yang tersimpan di perangkat ini.</p><p className="mt-1 text-xs text-amber-700">Data contoh PAK perlu ditinjau guru sebelum digunakan.</p></div><div className="flex flex-wrap gap-2">{tabs.map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={`rounded-lg px-3 py-2 text-xs font-bold ${tab === id ? 'bg-brand text-white' : 'bg-white text-slate-500'}`}>{label}</button>)}</div></div>
    {tab === 'backup' ? <div className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl bg-white p-6 shadow-card"><div className="grid h-11 w-11 place-items-center rounded-xl bg-violet-100 text-brand"><Download /></div><h2 className="mt-4 font-extrabold">Ekspor cadangan</h2><p className="mt-2 text-sm leading-6 text-muted">Unduh data materi, bank soal, permainan, dan ujian dalam format JSON.</p><button onClick={download} className="mt-5 flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white"><Download size={16} /> Unduh JSON</button></div><div className="rounded-2xl bg-white p-6 shadow-card"><div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Upload /></div><h2 className="mt-4 font-extrabold">Impor cadangan</h2><p className="mt-2 text-sm leading-6 text-muted">Pulihkan data dari cadangan Ruang Iman. Proses ini mengganti data materi yang ada.</p><label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600"><Upload size={16} /> Pilih berkas JSON<input type="file" accept="application/json,.json" onChange={upload} className="hidden" /></label></div></div> : <>
      {tab === 'questions' && <form onSubmit={save} className="mb-6 rounded-2xl bg-white p-5 shadow-card sm:p-6"><h2 className="mb-4 font-extrabold">Tambah soal</h2><div className="grid gap-3 sm:grid-cols-2"><textarea required value={newQuestion.prompt} onChange={(e) => setNewQuestion({ ...newQuestion, prompt: e.target.value })} placeholder="Tulis pertanyaan…" className={`${inputClass} sm:col-span-2`} rows="2" /><select value={newQuestion.grade} onChange={(e) => setNewQuestion({ ...newQuestion, grade: e.target.value })} className={inputClass}><option>X</option><option>XI</option><option>XII</option></select><select value={newQuestion.type} onChange={(e) => setNewQuestion({ ...newQuestion, type: e.target.value })} className={inputClass}><option value="choice">Pilihan ganda</option><option value="short">Isian singkat</option></select>{newQuestion.type === 'choice' ? <><input required value={newQuestion.optionA} onChange={(e) => setNewQuestion({ ...newQuestion, optionA: e.target.value })} placeholder="Pilihan A" className={inputClass} /><input required value={newQuestion.optionB} onChange={(e) => setNewQuestion({ ...newQuestion, optionB: e.target.value })} placeholder="Pilihan B" className={inputClass} /><input required value={newQuestion.optionC} onChange={(e) => setNewQuestion({ ...newQuestion, optionC: e.target.value })} placeholder="Pilihan C" className={inputClass} /><input required value={newQuestion.optionD} onChange={(e) => setNewQuestion({ ...newQuestion, optionD: e.target.value })} placeholder="Pilihan D" className={inputClass} /><select required value={newQuestion.answer} onChange={(e) => setNewQuestion({ ...newQuestion, answer: e.target.value })} className={inputClass}><option value="">Pilih jawaban yang benar</option>{[newQuestion.optionA, newQuestion.optionB, newQuestion.optionC, newQuestion.optionD].filter(Boolean).map((option, i) => <option key={`${i}-${option}`} value={option}>{option}</option>)}</select></> : <input required value={newQuestion.answer} onChange={(e) => setNewQuestion({ ...newQuestion, answer: e.target.value })} placeholder="Jawaban yang benar" className={inputClass} />}<input value={newQuestion.explanation} onChange={(e) => setNewQuestion({ ...newQuestion, explanation: e.target.value })} placeholder="Pembahasan singkat (opsional)" className={`${inputClass} sm:col-span-2`} /></div><button disabled={saving} className="mt-4 flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Plus size={16} /> Simpan soal</button></form>}
      {tab === 'topics' && <form onSubmit={save} className="mb-6 rounded-2xl bg-white p-5 shadow-card"><h2 className="mb-4 font-extrabold">Tambah materi</h2><div className="grid gap-3 sm:grid-cols-[1fr_120px_1fr]"><input required value={newTopic.title} onChange={(e) => setNewTopic({ ...newTopic, title: e.target.value })} placeholder="Nama topik" className={inputClass} /><select value={newTopic.grade} onChange={(e) => setNewTopic({ ...newTopic, grade: e.target.value })} className={inputClass}><option>X</option><option>XI</option><option>XII</option></select><input value={newTopic.description} onChange={(e) => setNewTopic({ ...newTopic, description: e.target.value })} placeholder="Deskripsi (opsional)" className={inputClass} /></div><button className="mt-4 flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white"><Plus size={16} /> Simpan materi</button></form>}
      {tab === 'secrets' && <form onSubmit={save} className="mb-6 rounded-2xl bg-white p-5 shadow-card"><h2 className="mb-4 font-extrabold">Tambah kata rahasia</h2><div className="grid gap-3 sm:grid-cols-2"><input required value={newSecret.answer} onChange={(e) => setNewSecret({ ...newSecret, answer: e.target.value })} placeholder="Jawaban rahasia" className={inputClass} /><select value={newSecret.topicId} onChange={(e) => setNewSecret({ ...newSecret, topicId: Number(e.target.value) })} className={inputClass}>{content.topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select><textarea required value={newSecret.clue} onChange={(e) => setNewSecret({ ...newSecret, clue: e.target.value })} placeholder="Petunjuk utama" className={`${inputClass} sm:col-span-2`} rows="2" /><input value={newSecret.hints[0]} onChange={(e) => setNewSecret({ ...newSecret, hints: [e.target.value, newSecret.hints[1]] })} placeholder="Petunjuk tambahan 1" className={inputClass} /><input value={newSecret.hints[1]} onChange={(e) => setNewSecret({ ...newSecret, hints: [newSecret.hints[0], e.target.value] })} placeholder="Petunjuk tambahan 2" className={inputClass} /><input value={newSecret.explanation} onChange={(e) => setNewSecret({ ...newSecret, explanation: e.target.value })} placeholder="Pembahasan (opsional)" className={`${inputClass} sm:col-span-2`} /></div><button className="mt-4 flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white"><Plus size={16} /> Simpan kata rahasia</button></form>}
      {tab === 'chains' && <form onSubmit={save} className="mb-6 rounded-2xl bg-white p-5 shadow-card"><h2 className="mb-2 font-extrabold">Tambah rangkaian sambung kata</h2><p className="mb-4 text-xs leading-5 text-muted">Masukkan daftar kata berurutan, pisahkan dengan koma. Huruf pertama setiap kata harus menyambung dengan huruf terakhir kata sebelumnya.</p><div className="grid gap-3 sm:grid-cols-2"><input required value={newChain.startWord} onChange={(e) => setNewChain({ ...newChain, startWord: e.target.value })} placeholder="Kata awal" className={inputClass} /><select value={newChain.topicId} onChange={(e) => setNewChain({ ...newChain, topicId: Number(e.target.value) })} className={inputClass}>{content.topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select><textarea required value={newChain.words} onChange={(e) => setNewChain({ ...newChain, words: e.target.value })} placeholder="Contoh: nyata, anugerah, harapan" className={`${inputClass} sm:col-span-2`} rows="2" /><input value={newChain.explanation} onChange={(e) => setNewChain({ ...newChain, explanation: e.target.value })} placeholder="Pembahasan (opsional)" className={`${inputClass} sm:col-span-2`} /></div><button className="mt-4 flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white"><Plus size={16} /> Simpan rangkaian</button></form>}
      {tab === 'crosswords' && <form onSubmit={save} className="mb-6 rounded-2xl bg-white p-5 shadow-card"><h2 className="mb-2 font-extrabold">Tambah teka-teki silang</h2><p className="mb-4 text-xs leading-5 text-muted">Kisi dibuat otomatis dari dua jawaban yang memiliki huruf persilangan. Jawaban berupa 2–12 huruf tanpa spasi.</p><div className="grid gap-3 sm:grid-cols-2"><input required value={newCrossword.title} onChange={(e) => setNewCrossword({ ...newCrossword, title: e.target.value })} placeholder="Judul puzzle" className={inputClass} /><select value={newCrossword.topicId} onChange={(e) => setNewCrossword({ ...newCrossword, topicId: Number(e.target.value) })} className={inputClass}>{content.topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select><input required value={newCrossword.acrossAnswer} onChange={(e) => setNewCrossword({ ...newCrossword, acrossAnswer: e.target.value.toUpperCase() })} placeholder="Jawaban mendatar" className={inputClass} /><input required value={newCrossword.downAnswer} onChange={(e) => setNewCrossword({ ...newCrossword, downAnswer: e.target.value.toUpperCase() })} placeholder="Jawaban menurun" className={inputClass} /><input required value={newCrossword.acrossClue} onChange={(e) => setNewCrossword({ ...newCrossword, acrossClue: e.target.value })} placeholder="Petunjuk mendatar" className={inputClass} /><input required value={newCrossword.downClue} onChange={(e) => setNewCrossword({ ...newCrossword, downClue: e.target.value })} placeholder="Petunjuk menurun" className={inputClass} /><input value={newCrossword.explanation} onChange={(e) => setNewCrossword({ ...newCrossword, explanation: e.target.value })} placeholder="Pembahasan (opsional)" className={`${inputClass} sm:col-span-2`} /></div><button className="mt-4 flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white"><Plus size={16} /> Buat puzzle</button></form>}
      {tab === 'exams' && <form onSubmit={save} className="mb-6 rounded-2xl bg-white p-5 shadow-card sm:p-6"><h2 className="mb-4 font-extrabold">Buat ujian CBT</h2><div className="grid gap-3 sm:grid-cols-2"><input required value={newExam.title} onChange={(e) => setNewExam({ ...newExam, title: e.target.value })} placeholder="Judul ujian" className={inputClass} /><select value={newExam.grade} onChange={(e) => { const grade = e.target.value; setNewExam((old) => ({ ...old, grade, questionIds: old.questionIds.filter((id) => grade === 'Semua kelas' || content.questions.find((question) => question.id === id)?.grade === grade) })) }} className={inputClass}><option>X</option><option>XI</option><option>XII</option><option>Semua kelas</option></select><label className="text-xs font-semibold text-slate-500">Durasi (menit)<input required type="number" min="1" max="180" value={newExam.duration} onChange={(e) => setNewExam({ ...newExam, duration: e.target.value })} className={`${inputClass} mt-1`} /></label><label className="text-xs font-semibold text-slate-500">Nilai minimum lulus (%)<input required type="number" min="0" max="100" value={newExam.passScore} onChange={(e) => setNewExam({ ...newExam, passScore: e.target.value })} className={`${inputClass} mt-1`} /></label></div><fieldset className="mt-4 rounded-xl border border-slate-100 p-4"><legend className="px-1 text-sm font-bold">Pilih soal untuk ujian</legend>{content.questions.filter((question) => newExam.grade === 'Semua kelas' || question.grade === newExam.grade).map((question) => <label key={question.id} className="flex cursor-pointer items-start gap-3 py-2 text-sm"><input type="checkbox" checked={newExam.questionIds.includes(question.id)} onChange={(e) => setNewExam((old) => ({ ...old, questionIds: e.target.checked ? [...old.questionIds, question.id] : old.questionIds.filter((id) => id !== question.id) }))} className="mt-1 accent-violet-600" /><span>{question.prompt}<span className="mt-1 block text-xs text-muted">Kelas {question.grade} · {question.type === 'choice' ? 'Pilihan ganda' : 'Isian singkat'}</span></span></label>)}</fieldset><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-600">{[['shuffle', 'Acak urutan soal'], ['shuffleOptions', 'Acak pilihan jawaban'], ['showExplanation', 'Tampilkan pembahasan']].map(([key, label]) => <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={newExam[key]} onChange={(e) => setNewExam({ ...newExam, [key]: e.target.checked })} className="accent-violet-600" />{label}</label>)}</div><button disabled={saving} className="mt-4 flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Plus size={16} /> Simpan ujian</button></form>}
      <div className="grid gap-5 xl:grid-cols-2">{tab === 'questions' && <ContentList title={`Bank soal (${content.questions.length})`} items={content.questions} getName={(item) => item.prompt} getMeta={(item) => `Kelas ${item.grade} · ${item.type === 'choice' ? 'Pilihan ganda' : 'Isian'} · Jawaban: ${item.answer}`} onDelete={(item) => remove('questions', item.id)} />}{tab === 'topics' && <ContentList title={`Materi (${content.topics.length})`} items={content.topics} getName={(item) => item.title} getMeta={(item) => `Kelas ${item.grade} · ${item.description}`} onDelete={(item) => remove('topics', item.id)} />}{tab === 'chains' && <ContentList title={`Rangkaian kata (${content.wordChains.length})`} items={content.wordChains} getName={(item) => item.startWord} getMeta={(item) => `Urutan: ${item.words.join(' → ')}`} onDelete={(item) => remove('wordChains', item.id)} />}{tab === 'secrets' && <ContentList title={`Kata rahasia (${content.secrets.length})`} items={content.secrets} getName={(item) => item.clue} getMeta={(item) => `Jawaban: ${item.answer}`} onDelete={(item) => remove('secrets', item.id)} />}{tab === 'crosswords' && <ContentList title={`Teka-teki silang (${content.crosswords.length})`} items={content.crosswords} getName={(item) => item.title} getMeta={(item) => item.placements.map((word) => `${word.direction}: ${word.answer}`).join(' · ')} onDelete={(item) => remove('crosswords', item.id)} />}{tab === 'exams' && <ContentList title={`Ujian (${content.exams.length})`} items={content.exams} getName={(item) => item.title} getMeta={(item) => `${item.questionIds?.length || 0} soal · ${item.duration} menit · Lulus ${item.passScore}%`} onDelete={(item) => remove('exams', item.id)} />}</div>
    </>}</div>
}

function ContentList({ title, items, getName, getMeta, onDelete }) {
  return <section className="rounded-2xl bg-white p-5 shadow-card sm:p-6"><h2 className="font-extrabold">{title}</h2>{!items.length ? <p className="py-7 text-center text-sm text-muted">Belum ada konten.</p> : <div className="mt-3 divide-y divide-slate-100">{items.map((item) => <div key={item.id} className="flex items-start gap-3 py-3"><div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-lilac text-brand"><BookOpen size={14} /></div><div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-bold">{getName(item)}</p><p className="mt-1 text-xs leading-5 text-muted">{getMeta(item)}</p></div><button onClick={() => onDelete(item)} className="rounded-lg p-2 text-slate-300 hover:bg-rose-50 hover:text-rose-600" aria-label="Hapus konten"><X size={16} /></button></div>)}</div>}</section>
}

export default App
