export function isValidatorIdCorrect(id, validatorsLength) {
  return (
    id !== null &&
    id !== undefined &&
    typeof id !== 'boolean' &&
    Number(id) > 0 &&
    Number(id) <= validatorsLength
  )
}
