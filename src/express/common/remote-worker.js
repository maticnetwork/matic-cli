import execa from 'execa'

export const maxRetries = 3

export function getRemoteStdio() {
  if (process.env.VERBOSE === 'false') {
    return 'ignore'
  }
  return 'inherit'
}

export async function runSshCommand(ip, command, retries) {
  if (retries < 0) {
    console.log(
      '❌ runSshCommand called with negative retries number: ',
      retries
    )
    process.exit(1)
  }
  try {
    await execa(
      'ssh',
      [
        '-o',
        'StrictHostKeyChecking=no',
        '-o',
        'UserKnownHostsFile=/dev/null',
        '-i',
        `${process.env.PEM_FILE_PATH}`,
        ip,
        command + ' && exit'
      ],
      { stdio: getRemoteStdio() }
    )
  } catch (error) {
    if (retries - 1 > 0) {
      await runSshCommand(ip, command, retries - 1)
    } else {
      console.log(
        '❌ Command \n `' +
          command +
          '`\n failed too many times with error : \n',
        error
      )
      process.exit(1)
    }
  }
}

export async function runSshCommandWithoutExit(ip, command, retries) {
  if (retries < 0) {
    console.log(
      '❌ runSshCommand called with negative retries number: ',
      retries
    )
  }
  try {
    await execa(
      'ssh',
      [
        `-o`,
        `StrictHostKeyChecking=no`,
        `-o`,
        `UserKnownHostsFile=/dev/null`,
        `-i`,
        `${process.env.PEM_FILE_PATH}`,
        ip,
        command + ` && exit`
      ],
      { stdio: getRemoteStdio() }
    )
  } catch (error) {
    if (retries - 1 > 0) {
      await runSshCommand(ip, command, retries - 1)
    } else {
      console.log('Command  `' + command + '` failed (Not Serious)')
    }
  }
}

export async function runScpCommand(src, dest, retries) {
  if (retries < 0) {
    console.log(
      '❌ runScpCommand called with negative retries number: ',
      retries
    )
    process.exit(1)
  }
  try {
    await execa(
      'scp',
      [
        '-o',
        'StrictHostKeyChecking=no',
        '-o',
        'UserKnownHostsFile=/dev/null',
        '-i',
        `${process.env.PEM_FILE_PATH}`,
        src,
        dest
      ],
      { stdio: getRemoteStdio() }
    )
  } catch (error) {
    console.log(
      "❌ Error while copying '" + src + "' to '" + dest + "': \n",
      error
    )
    if (retries - 1 > 0) {
      await runScpCommand(src, dest, retries - 1)
    } else {
      console.log('❌ SCP copy failed too many times, exiting... \n')
      process.exit(1)
    }
  }
}
