import { describe, expect, it } from 'vitest'
import { checkChainWord, isAnswerCorrect, isValidSecretGuess, normalize, scoreAnswers } from './gameLogic'

describe('game validation and scoring', () => {
  it('normalizes case and whitespace for Indonesian answers', () => {
    expect(normalize('  KASIH  ')).toBe('kasih')
    expect(normalize('tanggung   jawab')).toBe('tanggung jawab')
  })

  it('requires a known word beginning with the last letter', () => {
    expect(checkChainWord('nyata', 'IMAN', ['nyata'])).toBe(true)
    expect(checkChainWord('kasih', 'IMAN', ['kasih'])).toBe(false)
    expect(checkChainWord('harapan', 'IMAN', ['nasihat'])).toBe(false)
  })

  it('checks secret guesses without case sensitivity', () => {
    expect(isValidSecretGuess(' doa ', 'DOA')).toBe(true)
    expect(isValidSecretGuess('iman', 'DOA')).toBe(false)
  })

  it('scores multiple choice and short answers', () => {
    const questions = [{ id: 1, answer: 'Kasih' }, { id: 2, answer: 'toleransi', acceptedAnswers: ['menghormati perbedaan'] }, { id: 3, answer: 'Doa' }]
    expect(isAnswerCorrect('Menghormati perbedaan', questions[1])).toBe(true)
    expect(scoreAnswers(questions, { 1: 'KASIH', 2: 'sabar', 3: 'doa' })).toEqual({ correct: 2, total: 3, score: 67 })
  })
})
