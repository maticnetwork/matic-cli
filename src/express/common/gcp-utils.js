export function getGcpInstancesInfo(instances) {
  return {
    project: instances[0].split('/')[1].toString(),
    zone: instances[0].split('/')[3].toString(),
    names: instances
      .map((x) => x.split('/').at(-1))
      .toString()
      .replace(/,/g, ' ')
  }
}
