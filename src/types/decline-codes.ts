export type DeclineCodeType = 'SOFT' | 'HARD'

export interface DeclineClassification {
  code: string
  type: DeclineCodeType
  retryable: boolean
}
