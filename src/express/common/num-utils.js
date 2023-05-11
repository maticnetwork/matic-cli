export function isValidPositiveNum(targetBlock) {
  return (
    targetBlock !== undefined &&
    targetBlock !== null &&
    targetBlock !== '' &&
    parseInt(targetBlock, 10) > 0
  )
}
