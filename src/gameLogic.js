export const normalize = (value = '') => value.trim().toLocaleLowerCase('id-ID').replace(/\s+/g, ' ')

export function checkChainWord(input, lastWord, acceptedWords) {
  const candidate = normalize(input)
  const start = normalize(lastWord).slice(-1)
  return Boolean(candidate && candidate.startsWith(start) && acceptedWords.some((word) => normalize(word) === candidate))
}

export function scoreAnswers(questions, answers) {
  const correct = questions.filter((question) => isAnswerCorrect(answers[question.id] ?? '', question)).length
  return { correct, total: questions.length, score: questions.length ? Math.round((correct / questions.length) * 100) : 0 }
}

export function isAnswerCorrect(input, question) {
  const accepted = [question.answer, ...(Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : [])]
  return accepted.some((answer) => normalize(input) === normalize(answer))
}

export function isValidSecretGuess(input, answer) {
  return normalize(input) === normalize(answer)
}
