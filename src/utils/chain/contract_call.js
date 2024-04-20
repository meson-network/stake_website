
import { ethers } from 'ethers'

function unify_err(err) {

  if (Object.hasOwn(err, 'error')) {
    return new Error(err.error.message)
  }

  if (Object.hasOwn(err, 'reason')) {
    return new Error(err.reason)
  }

  return err;
}

async function get_account_address() {

  var wrap_result = {
    err: false,
    result: true,
  }

  try {
    let account
    if (typeof window.ethereum !== 'undefined') {
      [account] = await window.ethereum.request({ method: 'eth_requestAccounts' })
    }
    if (!account) {
      wrap_result.err = unify_err(new Error("no wallet plugin"))
      wrap_result.result = false;
      return wrap_result;
    }

    //good
    wrap_result.result = account;
    return wrap_result;
    ////////
  } catch (e) {
    wrap_result.err = unify_err(e)
    wrap_result.result = false
    return wrap_result
  }
}


//////////////msn///////////////////////////////////////////////////////

async function msn_balanceOf(
  chain_id,
  msn_contract_address,
  msn_abi,
  wallet_address
) {

  var wrap_result = {
    err: false,
    result: true,
  }

  try {
    if (typeof window.ethereum !== 'undefined') {
      await window.ethereum.request({ method: 'eth_requestAccounts' })
    }
    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const { chainId } = await provider.getNetwork()
    if (chainId != chain_id) {
      wrap_result.err = unify_err(new Error("chain_id error"))
      wrap_result.result = false;
      return wrap_result
    }
    const contract = new ethers.Contract(msn_contract_address, msn_abi, provider)
    wrap_result.result = await contract.balanceOf(wallet_address.toString()) //toString for safety
    return wrap_result
  } catch (e) {
    wrap_result.err = unify_err(e)
    wrap_result.result = false
    return wrap_result
  }
}


async function msn_allowance(
  chain_id,
  msn_contract_address,
  msn_abi,
  owner_address,
  spender_address
) {

  var wrap_result = {
    err: false,
    result: true,
  }

  try {
    if (typeof window.ethereum !== 'undefined') {
      await window.ethereum.request({ method: 'eth_requestAccounts' })
    }
    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const { chainId } = await provider.getNetwork()
    if (chainId != chain_id) {
      wrap_result.err = unify_err(new Error("chain_id error"))
      wrap_result.result = false;
      return wrap_result
    }
    const contract = new ethers.Contract(msn_contract_address, msn_abi, provider)
    wrap_result.result = await contract.allowance(owner_address.toString(), spender_address.toString()) //toString for safety
    return wrap_result
  } catch (e) {
    wrap_result.err = unify_err(e)
    wrap_result.result = false
    return wrap_result
  }
}


async function msn_approve(
  chain_id,
  msn_contract_address,
  msn_abi,
  spender_wallet_address,
  amount_str
) {

  var wrap_result = {
    err: false,
    result: true,
  }

  try {
    let account
    if (typeof window.ethereum !== 'undefined') {
      [account] = await window.ethereum.request({ method: 'eth_requestAccounts' })
    }
    if (!account) {
      wrap_result.err = unify_err(new Error("no wallet plugin"))
      wrap_result.result = false;
      return wrap_result;
    }

    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const { chainId } = await provider.getNetwork()
    if (chainId != chain_id) {
      wrap_result.err = unify_err(new Error("chain_id error"))
      wrap_result.result = false;
      return wrap_result
    }

    const signer = provider.getSigner()
    const contract = new ethers.Contract(msn_contract_address, msn_abi, signer)

    const transcation = await contract.approve(
      spender_wallet_address.toString(),
      amount_str.toString()
    )
    await transcation.wait()

    wrap_result.result = true
    return wrap_result

  } catch (e) {
    wrap_result.err = unify_err(e)
    wrap_result.result = false
    return wrap_result
  }
}


///////////////////////////mining////////////////////////////////////

//return the claimed onchain value , if 0 means not claimed yet
async function mining_check_amount_from_signature(
  chain_id,
  mining_contract_address,
  mining_abi,
  mining_claim_sig_id_str
) {

  var wrap_result = {
    err: false,
    result: true,
  }

  try {
    if (typeof window.ethereum !== 'undefined') {
      await window.ethereum.request({ method: 'eth_requestAccounts' })
    }
    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const { chainId } = await provider.getNetwork()
    if (chainId != chain_id) {
      wrap_result.err = unify_err(new Error("chain_id error"))
      wrap_result.result = false;
      return wrap_result
    }
    const contract = new ethers.Contract(mining_contract_address, mining_abi, provider)
    wrap_result.result = await contract.check_amount_from_signature(mining_claim_sig_id_str.toString()) //toString for safety
    return wrap_result
  } catch (e) {
    wrap_result.err = unify_err(e)
    wrap_result.result = false
    return wrap_result
  }
}


async function mining_miner_claim(
  chain_id,
  mining_contract_address,
  mining_abi,
  signature_target_wallet_address,
  signature_id_str,
  signature_amount_str,
  signature_str
) {

  var wrap_result = {
    err: false,
    result: true,
  }


  try {
    let account
    if (typeof window.ethereum !== 'undefined') {
      [account] = await window.ethereum.request({ method: 'eth_requestAccounts' })
    }
    if (!account) {
      wrap_result.err = unify_err(new Error("no wallet plugin"))
      wrap_result.result = false;
      return wrap_result;
    }

    if (account.toLowerCase() != signature_target_wallet_address.toLowerCase()) {
      wrap_result.err = unify_err(new Error("wallet not match"))
      wrap_result.result = false;
      return wrap_result;
    }

    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const { chainId } = await provider.getNetwork()
    if (chainId != chain_id) {
      wrap_result.err = unify_err(new Error("chain_id error"))
      wrap_result.result = false;
      return wrap_result
    }

    const signer = provider.getSigner()
    const contract = new ethers.Contract(mining_contract_address, mining_abi, signer)

    const transcation = await contract.miner_claim(
      signature_id_str.toString(),
      signature_amount_str.toString(),
      signature_str.toString()
    )
    await transcation.wait()

    wrap_result.result = true
    return wrap_result

  } catch (e) {
    wrap_result.err = unify_err(e)
    wrap_result.result = false
    return wrap_result
  }
}

//////////////simple claim///////////////////////////////////////////////////////

//return the claimed onchain value , if 0 means not claimed yet
async function check_simple_claim_amount_from_signature(
  chain_id,
  simple_claim_contract_address,
  simple_claim_abi,
  simple_claim_sig_id_str
) {

  var wrap_result = {
    err: false,
    result: true,
  }

  try {
    if (typeof window.ethereum !== 'undefined') {
      await window.ethereum.request({ method: 'eth_requestAccounts' })
    }
    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const { chainId } = await provider.getNetwork()
    if (chainId != chain_id) {
      wrap_result.err = unify_err(new Error("chain_id error"))
      wrap_result.result = false;
      return wrap_result
    }
    const contract = new ethers.Contract(simple_claim_contract_address, simple_claim_abi, provider)
    wrap_result.result = await contract.check_claim_amount_from_signature(simple_claim_sig_id_str.toString()) //toString for safety
    return wrap_result
  } catch (e) {
    wrap_result.err = unify_err(e)
    wrap_result.result = false
    return wrap_result
  }
}


async function simple_claim(
  chain_id,
  simple_claim_contract_address,
  simple_claim_abi,
  simple_claim_sig_target_wallet,
  signature_id_str,
  signature_amount_str,
  signature_str
) {

  var wrap_result = {
    err: false,
    result: true,
  }

  try {
    let account
    if (typeof window.ethereum !== 'undefined') {
      [account] = await window.ethereum.request({ method: 'eth_requestAccounts' })
    }
    if (!account) {
      wrap_result.err = unify_err(new Error("no wallet plugin"))
      wrap_result.result = false;
      return wrap_result;
    }

    if (account.toLowerCase() != simple_claim_sig_target_wallet.toLowerCase()) {
      wrap_result.err = unify_err(new Error("wallet not match"))
      wrap_result.result = false;
      return wrap_result;
    }

    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const { chainId } = await provider.getNetwork()
    if (chainId != chain_id) {
      wrap_result.err = unify_err(new Error("chain_id error"))
      wrap_result.result = false;
      return wrap_result
    }

    const signer = provider.getSigner()
    const contract = new ethers.Contract(simple_claim_contract_address, simple_claim_abi, signer)

    const transcation = await contract.claim(
      signature_id_str.toString(),
      signature_amount_str.toString(),
      signature_str.toString()
    )
    await transcation.wait()
    wrap_result.result = true
    return wrap_result
  } catch (e) {
    wrap_result.err = unify_err(e)
    wrap_result.result = false
    return wrap_result
  }
}


//////////////stake///////////////////////////////////////////////////////

async function get_credit_reward_speed(
  chain_id,
  wallet_address,
  stake_contract_address,
  stake_abi
  ) {

  var wrap_result = {
    err: false,
    result: true,
  }

  try {
    if (typeof window.ethereum !== 'undefined') {
      await window.ethereum.request({ method: 'eth_requestAccounts' })
    }
    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const { chainId } = await provider.getNetwork()
    if (chainId != chain_id) {
      wrap_result.err = unify_err(new Error("chain_id error"))
      wrap_result.result = false;
      return wrap_result
    }
    const contract = new ethers.Contract(stake_contract_address, stake_abi, provider)
    wrap_result.result = await contract.get_credit_reward_speed(wallet_address.toString()) //toString for safety
    return wrap_result
  } catch (e) {
    wrap_result.err = unify_err(e)
    wrap_result.result = false
    return wrap_result
  }
}


async function stake_get_stake_token(
  chain_id,
  wallet_address,
  stake_contract_address,
  stake_abi
  ) {

  var wrap_result = {
    err: false,
    result: true,
  }

  try {
    if (typeof window.ethereum !== 'undefined') {
      await window.ethereum.request({ method: 'eth_requestAccounts' })
    }
    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const { chainId } = await provider.getNetwork()
    if (chainId != chain_id) {
      wrap_result.err = unify_err(new Error("chain_id error"))
      wrap_result.result = false;
      return wrap_result
    }
    const contract = new ethers.Contract(stake_contract_address, stake_abi, provider)
    wrap_result.result = await contract.get_stake_token(wallet_address.toString()) //toString for safety
    return wrap_result
  } catch (e) {
    wrap_result.err = unify_err(e)
    wrap_result.result = false
    return wrap_result
  }
}


async function stake_get_stake_last_time(
  chain_id,
  wallet_address,
  stake_contract_address,
  stake_abi
  ) {

  var wrap_result = {
    err: false,
    result: true,
  }

  try {
    if (typeof window.ethereum !== 'undefined') {
      await window.ethereum.request({ method: 'eth_requestAccounts' })
    }
    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const { chainId } = await provider.getNetwork()
    if (chainId != chain_id) {
      wrap_result.err = unify_err(new Error("chain_id error"))
      wrap_result.result = false;
      return wrap_result
    }
    const contract = new ethers.Contract(stake_contract_address, stake_abi, provider)
    wrap_result.result = await contract.get_stake_last_time(wallet_address.toString()) //toString for safety
    return wrap_result
  } catch (e) {
    wrap_result.err = unify_err(e)
    wrap_result.result = false
    return wrap_result
  }
}


async function stake_get_credit(
  chain_id,
  wallet_address,
  stake_contract_address,
  stake_abi
  ) {

  var wrap_result = {
    err: false,
    result: true,
  }

  try {
    if (typeof window.ethereum !== 'undefined') {
      await window.ethereum.request({ method: 'eth_requestAccounts' })
    }
    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const { chainId } = await provider.getNetwork()
    if (chainId != chain_id) {
      wrap_result.err = unify_err(new Error("chain_id error"))
      wrap_result.result = false;
      return wrap_result
    }
    const contract = new ethers.Contract(stake_contract_address, stake_abi, provider)
    wrap_result.result = await contract.get_credit(wallet_address.toString()) //toString for safety
    return wrap_result
  } catch (e) {
    wrap_result.err = unify_err(e)
    wrap_result.result = false
    return wrap_result
  }
}



async function stake_get_total_credit(
  chain_id,
  stake_contract_address,
  stake_abi
  ) {

  var wrap_result = {
    err: false,
    result: true,
  }

  try {
    if (typeof window.ethereum !== 'undefined') {
      await window.ethereum.request({ method: 'eth_requestAccounts' })
    }
    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const { chainId } = await provider.getNetwork()
    if (chainId != chain_id) {
      wrap_result.err = unify_err(new Error("chain_id error"))
      wrap_result.result = false;
      return wrap_result
    }
    const contract = new ethers.Contract(stake_contract_address, stake_abi, provider)
    wrap_result.result = await contract.get_total_credit() //toString for safety
    return wrap_result
  } catch (e) {
    wrap_result.err = unify_err(e)
    wrap_result.result = false
    return wrap_result
  }
}





async function stake_stake(
  chain_id,
  stake_contract_address,
  stake_abi,
  amount_str
) {

  var wrap_result = {
    err: false,
    result: true,
  }

  try {
    let account
    if (typeof window.ethereum !== 'undefined') {
      [account] = await window.ethereum.request({ method: 'eth_requestAccounts' })
    }
    if (!account) {
      wrap_result.err = unify_err(new Error("no wallet plugin"))
      wrap_result.result = false;
      return wrap_result;
    }

    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const { chainId } = await provider.getNetwork()
    if (chainId != chain_id) {
      wrap_result.err = unify_err(new Error("chain_id error"))
      wrap_result.result = false;
      return wrap_result
    }

    const signer = provider.getSigner()
    const contract = new ethers.Contract(stake_contract_address, stake_abi, signer)

    const transcation = await contract.stake(amount_str.toString())
    await transcation.wait()

    wrap_result.result = true
    return wrap_result

  } catch (e) {
    wrap_result.err = unify_err(e)
    wrap_result.result = false
    return wrap_result
  }
}



async function stake_unstake(
  chain_id,
  stake_contract_address,
  stake_abi,
  amount_str
) {

  var wrap_result = {
    err: false,
    result: true,
  }

  try {
    let account
    if (typeof window.ethereum !== 'undefined') {
      [account] = await window.ethereum.request({ method: 'eth_requestAccounts' })
    }
    if (!account) {
      wrap_result.err = unify_err(new Error("no wallet plugin"))
      wrap_result.result = false;
      return wrap_result;
    }

    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const { chainId } = await provider.getNetwork()
    if (chainId != chain_id) {
      wrap_result.err = unify_err(new Error("chain_id error"))
      wrap_result.result = false;
      return wrap_result
    }

    const signer = provider.getSigner()
    const contract = new ethers.Contract(stake_contract_address, stake_abi, signer)

    const transcation = await contract.unstake(amount_str.toString())
    await transcation.wait()

    wrap_result.result = true
    return wrap_result

  } catch (e) {
    wrap_result.err = unify_err(e)
    wrap_result.result = false
    return wrap_result
  }
}



async function stake_harvest(
  chain_id,
  stake_contract_address,
  stake_abi
) {

  var wrap_result = {
    err: false,
    result: true,
  }

  try {
    let account
    if (typeof window.ethereum !== 'undefined') {
      [account] = await window.ethereum.request({ method: 'eth_requestAccounts' })
    }
    if (!account) {
      wrap_result.err = unify_err(new Error("no wallet plugin"))
      wrap_result.result = false;
      return wrap_result;
    }

    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const { chainId:chainId111 } = await provider.getNetwork()
    console.log(chainId111)
    await provider.send('wallet_switchEthereumChain', [{ chainId: ethers.utils.hexValue(chain_id) }]);
    const { chainId } = await provider.getNetwork()
    console.log(chainId)
    if (chainId != chain_id) {
      wrap_result.err = unify_err(new Error("chain_id error"))
      wrap_result.result = false;
      return wrap_result
    }

    const signer = provider.getSigner()
    const contract = new ethers.Contract(stake_contract_address, stake_abi, signer)

    const transcation = await contract.harvest()
    await transcation.wait()

    wrap_result.result = true
    return wrap_result

  } catch (e) {
    wrap_result.err = unify_err(e)
    wrap_result.result = false
    return wrap_result
  }
}







//////////////////////////////////////////////////////////////////////////


 

export default {
  get_account_address,
  msn_balanceOf, msn_allowance, msn_approve,
  mining_check_amount_from_signature, mining_miner_claim,
  check_simple_claim_amount_from_signature, 
  simple_claim,
  get_credit_reward_speed,
  stake_get_stake_token,
  stake_get_stake_last_time,
  stake_get_credit,
  stake_get_total_credit,
  stake_stake,
  stake_unstake,
  stake_harvest,

}