export function isValidBlockNum(targetBlock) {
  return (
    targetBlock !== undefined &&
    targetBlock !== null &&
    targetBlock !== '' &&
    parseInt(targetBlock, 10) > 0
  )
}

export function isValidNodeIndex(index) {
  return (
    index !== undefined &&
    index !== null &&
    index !== '' &&
    parseInt(index, 10) >= 0
  )
}
