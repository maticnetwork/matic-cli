import {
  pullAndRestartBor,
  pullAndRestartErigon,
  pullAndRestartHeimdall
} from './update'
import { checkAndReturnVMIndex, loadDevnetConfig } from '../common/config-utils'

const { splitToArray } = require('../common/config-utils')

export async function restartAll(n) {
  require('dotenv').config({ path: `${process.cwd()}/.env` })
  const doc = await loadDevnetConfig('remote')
  const vmIndex = await checkAndReturnVMIndex(n, doc)
  const totalHosts = []
  const totalUsers = []
  const nodeIps = []
  if (doc.devnetBorHosts) {
    totalHosts.push(...splitToArray(doc.devnetBorHosts.toString()))
  }
  if (doc.devnetErigonHosts) {
    totalHosts.push(...splitToArray(doc.devnetErigonHosts.toString()))
  }

  if (doc.devnetBorUsers) {
    totalUsers.push(...splitToArray(doc.devnetBorUsers.toString()))
  }
  if (doc.devnetErigonUsers) {
    totalUsers.push(...splitToArray(doc.devnetErigonUsers.toString()))
  }

  const hostToIndexMap = new Map()
  let ip

  if (vmIndex === undefined) {
    for (let i = 0; i < totalHosts.length; i++) {
      ip = `${totalUsers[i]}@${totalHosts[i]}`
      nodeIps.push(ip)
      hostToIndexMap.set(ip, i)
    }

    const restartAllTasks = nodeIps.map(async (ip) => {
      if (hostToIndexMap.get(ip) < doc.devnetBorHosts.length) {
        await pullAndRestartBor(ip, hostToIndexMap.get(ip), false)
      } else {
        await pullAndRestartErigon(
          ip,
          hostToIndexMap.get(ip),
          false,
          doc.devnetErigonHosts.length
        )
      }
      await pullAndRestartHeimdall(ip, hostToIndexMap.get(ip), false)
    })

    await Promise.all(restartAllTasks)
  } else {
    ip = `${totalUsers[vmIndex]}@${totalHosts[vmIndex]}`
    if (vmIndex < doc.devnetBorHosts.length) {
      await pullAndRestartBor(ip, vmIndex, false)
    } else {
      await pullAndRestartErigon(
        ip,
        vmIndex,
        false,
        doc.devnetErigonHosts.length
      )
    }
    await pullAndRestartHeimdall(ip, vmIndex, false)
  }
}

export async function restartBor(n) {
  require('dotenv').config({ path: `${process.cwd()}/.env` })
  const doc = await loadDevnetConfig('remote')
  const vmIndex = await checkAndReturnVMIndex(n, doc)
  const borUsers = splitToArray(doc.devnetBorUsers.toString())
  const nodeIps = []
  const hostToIndexMap = new Map()
  let ip

  if (vmIndex === undefined) {
    for (let i = 0; i < doc.devnetBorHosts.length; i++) {
      ip = `${borUsers[i]}@${doc.devnetBorHosts[i]}`
      nodeIps.push(ip)
      hostToIndexMap.set(ip, i)
    }

    const restartBorTasks = nodeIps.map(async (ip) => {
      await pullAndRestartBor(ip, hostToIndexMap.get(ip), false)
    })

    await Promise.all(restartBorTasks)
  } else {
    if (vmIndex >= doc.devnetBorHosts.length) {
      console.log('📍Wrong VM index, please check your configs! Exiting...')
      process.exit(1)
    }
    ip = `${borUsers[vmIndex]}@${doc.devnetBorHosts[vmIndex]}`
    await pullAndRestartBor(ip, vmIndex, false)
  }
}

export async function restartErigon(n) {
  require('dotenv').config({ path: `${process.cwd()}/.env` })
  const doc = await loadDevnetConfig('remote')
  const vmIndex = await checkAndReturnVMIndex(n, doc)
  const erigonUsers = splitToArray(doc.devnetErigonUsers.toString())
  const nodeIps = []
  const hostToIndexMap = new Map()
  let ip

  if (vmIndex === undefined) {
    for (let i = 0; i < doc.devnetErigonHosts.length; i++) {
      ip = `${erigonUsers[i]}@${doc.devnetErigonHosts[i]}`
      nodeIps.push(ip)
      hostToIndexMap.set(ip, i)
    }

    const restartErigonTasks = nodeIps.map(async (ip) => {
      await pullAndRestartErigon(
        ip,
        hostToIndexMap.get(ip),
        false,
        doc.devnetErigonHosts.length
      )
    })

    await Promise.all(restartErigonTasks)
  } else {
    if (vmIndex < doc.devnetBorHosts.length) {
      console.log('📍Wrong VM index, please check your configs! Exiting...')
      process.exit(1)
    }
    ip = `${doc.devnetErigonUsers[vmIndex - doc.devnetBorHosts.length]}@${
      doc.devnetErigonHosts[vmIndex - doc.devnetBorHosts.length]
    }`
    await pullAndRestartErigon(ip, vmIndex, false, doc.devnetErigonHosts.length)
  }
}

export async function restartHeimdall(n) {
  require('dotenv').config({ path: `${process.cwd()}/.env` })
  const doc = await loadDevnetConfig('remote')
  const vmIndex = await checkAndReturnVMIndex(n, doc)
  const totalHosts = []
  const totalUsers = []
  const nodeIps = []
  if (doc.devnetBorHosts) {
    totalHosts.push(...splitToArray(doc.devnetBorHosts.toString()))
  }
  if (doc.devnetErigonHosts) {
    totalHosts.push(...splitToArray(doc.devnetErigonHosts.toString()))
  }

  if (doc.devnetBorUsers) {
    totalUsers.push(...splitToArray(doc.devnetBorUsers.toString()))
  }
  if (doc.devnetErigonUsers) {
    totalUsers.push(...splitToArray(doc.devnetErigonUsers.toString()))
  }

  const hostToIndexMap = new Map()
  let ip

  if (vmIndex === undefined) {
    for (let i = 0; i < totalHosts.length; i++) {
      ip = `${totalUsers[i]}@${totalHosts[i]}`
      nodeIps.push(ip)
      hostToIndexMap.set(ip, i)
    }

    const updateHeimdallTasks = nodeIps.map(async (ip) => {
      await pullAndRestartHeimdall(ip, hostToIndexMap.get(ip), false)
    })

    await Promise.all(updateHeimdallTasks)
  } else {
    ip = `${totalUsers[vmIndex]}@${totalHosts[vmIndex]}`
    await pullAndRestartHeimdall(ip, vmIndex, false)
  }
}
