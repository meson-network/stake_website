function parserToMoneyFormat(amount, decimals, toFixed = 6, forceFix = false) {
  if (amount === '0' || amount === '') {
    return '0.00'
  }

  const isNegative = amount.startsWith('-')
  if (isNegative) {
    amount = amount.substring(1)
  }

  if (decimals >= amount.length) {
    const round = decimals - amount.length + 1
    for (let i = 0; i < round; i++) {
      amount = '0' + amount
    }
  }

  const arr = amount.split('')
  arr.splice(-decimals, 0, '.')

  if (decimals > toFixed) {
    const round = decimals - toFixed
    for (let i = 0; i < round; i++) {
      if (arr[arr.length - 1] !== '0' && !forceFix) {
        break
      }
      arr.splice(arr.length - 1, 1)
    }
  }
  const result = arr.join('')

  return isNegative ? '-' + result : result
}

function parseDepositMsg(msg) {
  if (msg === '') {
    return ''
  } else {
    const resp = msg.split(':')
    if (resp.length > 0) {
      return resp[1]
    } else {
      return resp[0]
    }
  }
}

export default {
  parserToMoneyFormat,
  parseDepositMsg
}
