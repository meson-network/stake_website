import { ethers } from "ethers";

async function checkWallet() {
  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    if (provider !== null) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    return false;
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
};
