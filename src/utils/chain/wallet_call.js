import { ethers } from "ethers";

async function checkWallet() {
  if (window.ethereum) {
    return true;
  } else {
    return false;
  }
}

async function onAccountChanged(onChange) {
  if (window.ethereum) {
    window.ethereum.on("accountsChanged", onChange);
  }
}

async function switchNetwork(chainId) {
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const network = await provider.getNetwork();
  if (chainId && network.chainId == chainId) {
    // same network
    return true;
  }
  let hex_chainId = ethers.utils.hexValue(chainId);
  // console.log('hex_chainId :' + hex_chainId);
  try {
    await provider.send("wallet_switchEthereumChain", [{ chainId: hex_chainId }]);
    console.log("switch success");
    return true;
  } catch (e) {
    console.log("switch failed", e);
    return e;
  }
}

export default {
  checkWallet,
  switchNetwork,
  onAccountChanged,
};
