<script setup>
// chain
import net_config from "@/utils/chain/testnet/sepolia_config";
import msn_abi from "@/utils/chain/abi/msn.abi.json";
import stake_abi from "@/utils/chain/abi/msn_stake.abi.json";
import contract_call from "@/utils/chain/contract_call.js";
import wallet_call from "@/utils/chain/wallet_call.js";
import BigNumber from "bignumber.js";
///////////

import { computed, inject, onBeforeUnmount, onMounted, ref, toRaw } from "vue";
import { useToast } from "vue-toastification";
import Modal from "@/components/core/modal/Modal.vue";
import tokenAmountParser from "@/utils/token_amount_parser";

///multi-lan
import { useI18n } from "vue-i18n";
import lang_message from "./stake_lang.js";
const { t } = useI18n({ messages: lang_message });
const toast = useToast();
const swal = inject("$swal");
//

let processWalletVisible = ref(false);
function showWalletProcess() {
  processWalletVisible.value = true;
}
function hideWalletProcess() {
  processWalletVisible.value = false;
}

let stakeWinVisible = ref(false);
let unstakeWinVisible = ref(false);

let walletAccount = ref("");
async function getWalletAccount() {
  var account_result = await contract_call.get_account_address();
  if (account_result.err === false) {
    // console.log("account_result:", account_result.result)
    walletAccount.value = account_result.result;
    return true;
  } else {
    // console.log('get_account_address err handler:', account_result.err.message)
    toast.error("get wallet account err:", account_result.err.message);
    return false;
  }
}

let msnBalanceInWallet = ref("");
async function getMsnBalanceInWallet() {
  if (walletAccount.value === "") {
    return;
  }

  var msn_balanceOf_result = await contract_call.msn_balanceOf(net_config.chain_id, net_config.msn_contract_address, msn_abi, walletAccount.value);

  if (msn_balanceOf_result.err === false) {
    // console.log("msn_balanceOf_result:", msn_balanceOf_result.result);
    msnBalanceInWallet.value = msn_balanceOf_result.result.toString();
  } else {
    if (msn_balanceOf_result.err.message == "chain_id error") {
      toast.error("please switch to correct chain:" + net_config.chain_name);
    } else {
      toast.error("get balance err:", msn_balanceOf_result.err.message);
    }
  }
}

let toStakeAmount = ref(null);
async function toStake() {
  if (walletAccount.value == "") {
    toast.error("please connect wallet first");
    return;
  }

  await getMsnBalanceInWallet();
  stakeWinVisible.value = true;
}

async function doStake() {
  if (toStakeAmount.value == NaN || parseFloat(toStakeAmount.value) <= 0) {
    toast.error("stake amount err");
    return;
  }

  // stake amount
  let stake_amount_bn = new BigNumber(toStakeAmount.value);
  stake_amount_bn = stake_amount_bn.times(1e18);
  var stake_amount_str = stake_amount_bn.toFixed(0);

  // check allowance
  let allow_result = await contract_call.msn_allowance(
    net_config.chain_id,
    net_config.msn_contract_address,
    msn_abi,
    walletAccount.value,
    net_config.stake_contract_address
  );
  if (allow_result.err === false) {
    // check amount
    let allow_amount_bn = new BigNumber(allow_result.result.toString());

    if (allow_amount_bn.isLessThan(stake_amount_bn)) {
      // some tip
      let tip = await swal.fire({
        title: "",
        html: `Allowance is not enough. Please allow the third party to spend MSN from your current balance.<br/>It is recommended that set a large value to avoid repeated requests`,
        showDenyButton: false,
        showCancelButton: true,
        showConfirmButton: true,
        confirmButtonText: "OK",
        denyButtonText: "",
      });
      if (!tip.isConfirmed) {
        return;
      }

      // do approve
      if (!(await getWalletAccount())) {
        return;
      }
      showWalletProcess();
      let result = await contract_call.msn_approve(
        net_config.chain_id,
        net_config.msn_contract_address,
        msn_abi,
        net_config.stake_contract_address,
        msnBalanceInWallet.value
      );
      hideWalletProcess();
      if (result.result === true) {
        toast.success("approved");
      } else {
        toast.error("approve err:" + result.err?.message);
        return;
      }
    }
  } else {
    toast.error("check allowance err:" + result.err?.message);
    return;
  }

  // show loading page
  showWalletProcess();
  var stake_stake_result = await contract_call.stake_stake(net_config.chain_id, net_config.stake_contract_address, stake_abi, stake_amount_str);
  //hide loading page
  hideWalletProcess();

  if (stake_stake_result.err === false) {
    //actually you need to check the err if allowance is not enough
    //you need to make the user approve with a large amount
    //the suggest value is 10000000*10^18
    // console.log("stake_stake_result:", stake_stake_result.result);
    refreshStakeData();
    stakeWinVisible.value = false;
    toStakeAmount.value = null;
  } else {
    if (stake_stake_result.err.message == "chain_id error") {
      // console.log("please switch to correct chain:" + net_config.chain_name)
      toast.error("please switch to correct chain:" + net_config.chain_name);
    } else {
      // console.log('stake_stake err handler:', stake_stake_result.err.message)
      toast.error("stake_stake err handler:", stake_stake_result.err.message);
    }
  }
}

let unstakeAmount = ref(null);
async function toUnstake() {
  if (walletAccount.value == "") {
    toast.error("please connect wallet first");
    return;
  }

  unstakeWinVisible.value = true;
}

async function doUnstake() {
  if (unstakeAmount.value == NaN || parseFloat(unstakeAmount.value) <= 0) {
    toast.error("unstake amount err");
    return;
  }

  let unstake_amount_bn = new BigNumber(unstakeAmount.value);
  unstake_amount_bn = unstake_amount_bn.times(1e18);
  // console.log(unstake_amount_bn.toFixed(0));
  var unstake_amount_str = unstake_amount_bn.toFixed(0);

  // show loading page
  showWalletProcess();
  var stake_unstake_result = await contract_call.stake_unstake(net_config.chain_id, net_config.stake_contract_address, stake_abi, unstake_amount_str);
  //hide loading page
  hideWalletProcess();

  if (stake_unstake_result.err === false) {
    // console.log("stake_unstake_result:", stake_unstake_result.result);
    toast.success("success");

    // do something
    refreshStakeData();
    unstakeWinVisible.value = false;
    unstakeAmount.value = null;
  } else {
    if (stake_unstake_result.err.message == "chain_id error") {
      toast.error("please switch to correct chain:" + net_config.chain_name);
    } else {
      // console.log("stake_unstake err handler:", stake_unstake_result.err.message);
      toast.error("unstake err:", stake_unstake_result.err.message);
    }
  }
}

let creditRewardSpeed = ref("");
async function getCreditRewardSpeed() {
  // current unharvest credit =  get_credit_reward_speed_result.result * (current timestamp - stake_get_stake_last_time)

  //var wallet_address = "0x8779b8C61096d1FD49A12ea296B10cCC41ff2cbd";
  if (walletAccount.value === "") {
    return;
  }

  var get_credit_reward_speed_result = await contract_call.get_credit_reward_speed(
    net_config.chain_id,
    walletAccount.value,
    net_config.stake_contract_address,
    stake_abi
  );

  if (get_credit_reward_speed_result.err === false) {
    // console.log("get_credit_reward_speed_result:", get_credit_reward_speed_result.result);
    creditRewardSpeed.value = get_credit_reward_speed_result.result.toString();
    // console.log(creditRewardSpeed.value);
  } else {
    if (get_credit_reward_speed_result.err.message == "chain_id error") {
      toast.error("please switch to correct chain:" + net_config.chain_name);
    } else {
      toast.error("get credit reward  speed err handler:", get_credit_reward_speed_result.err.message);
    }
  }
}

let stakeTokenAmount = ref("");
const getStakeToken = async () => {
  if (walletAccount.value === "") {
    toast.error("please connect wallet first");
    return;
  }

  var stake_get_stake_token_result = await contract_call.stake_get_stake_token(net_config.chain_id, walletAccount.value, net_config.stake_contract_address, stake_abi);

  if (stake_get_stake_token_result.err === false) {
    // console.log("stake_get_stake_token_result:", stake_get_stake_token_result.result);
    stakeTokenAmount.value = stake_get_stake_token_result.result.toString();
    // console.log(stakeTokenAmount.value);
  } else {
    if (stake_get_stake_token_result.err.message == "chain_id error") {
      toast.error("please switch to correct chain:" + net_config.chain_name);
    } else {
      toast.error("stake_get_stake_token err handler:", stake_get_stake_token_result.err.message);
    }
  }
};

let lastStakeTime = parseInt(Date.now() / 1000);
const getStakeLastTime = async () => {
  if (walletAccount.value === "") {
    return;
  }

  var stake_get_stake_last_time_result = await contract_call.stake_get_stake_last_time(
    net_config.chain_id,
    walletAccount.value,
    net_config.stake_contract_address,
    stake_abi
  );

  if (stake_get_stake_last_time_result.err === false) {
    // console.log("stake_get_stake_last_time_result:", stake_get_stake_last_time_result.result.toString());
    lastStakeTime = parseInt(stake_get_stake_last_time_result.result.toString());
  } else {
    if (stake_get_stake_last_time_result.err.message == "chain_id error") {
      toast.error("please switch to correct chain:" + net_config.chain_name);
    } else {
      toast.error("stake_get_stake_last_time err handler:", stake_get_stake_last_time_result.err.message);
    }
  }
};

let credit = ref("");
const getCredit = async () => {
  if (walletAccount.value === "") {
    toast.error("please connect wallet first");
    return;
  }
  var stake_get_credit_result = await contract_call.stake_get_credit(net_config.chain_id, walletAccount.value, net_config.stake_contract_address, stake_abi);

  if (stake_get_credit_result.err === false) {
    // console.log("stake_get_credit_result:", stake_get_credit_result.result.toString());
    credit.value = stake_get_credit_result.result.toString();
  } else {
    if (stake_get_credit_result.err.message == "chain_id error") {
      toast.error("please switch to correct chain:" + net_config.chain_name);
    } else {
      toast.error("stake_get_credit err handler:", stake_get_credit_result.err.message);
    }
  }
};

const getTotalCredit = async () => {
  var stake_get_total_credit_result = await contract_call.stake_get_total_credit(net_config.chain_id, net_config.stake_contract_address, stake_abi);

  if (stake_get_total_credit_result.err === false) {
    // console.log("stake_get_total_credit_result:", stake_get_total_credit_result.result.toString());
  } else {
    if (stake_get_total_credit_result.err.message == "chain_id error") {
      toast.error("please switch to correct chain:" + net_config.chain_name);
    } else {
      toast.error("stake_get_total_credit err handler:", stake_get_total_credit_result.err.message);
    }
  }
};

let unharvestCredit = ref("0");
async function refreshUnharvestCredit() {
  if (creditRewardSpeed.value === "" || creditRewardSpeed.value === "0") {
    unharvestCredit.value = "0";
    return;
  }
  let nowTime = parseInt(Date.now() / 1000);
  let gapSecs = nowTime - lastStakeTime;

  let unharvestCredit_amount_bn = new BigNumber(creditRewardSpeed.value);
  unharvestCredit_amount_bn = unharvestCredit_amount_bn.times(gapSecs);
  unharvestCredit.value = unharvestCredit_amount_bn.toFixed(0);
}

const harvest = async () => {
  if (walletAccount.value == "") {
    toast.error("please connect wallet first");
    return;
  }

  // show loading page
  showWalletProcess();
  var stake_harvest_result = await contract_call.stake_harvest(net_config.chain_id, net_config.stake_contract_address, stake_abi);
  //hide loading page
  hideWalletProcess();

  if (stake_harvest_result.err === false) {
    // console.log("stake_harvest_result:", stake_harvest_result.result);
    toast.success("harvest success");
    refreshStakeData();
  } else {
    if (stake_harvest_result.err.message == "chain_id error") {
      toast.error("please switch to correct chain:" + net_config.chain_name);
    } else {
      // console.log("stake_harvest err handler:", stake_harvest_result.err.message);
      toast.error("harvest err ", stake_harvest_result.err.message);
    }
  }
};

async function refreshStakeData() {
  if (walletAccount.value === "") {
    toast.error("please connect wallet first");
    return;
  }

  if ((await wallet_call.getChainId()) != net_config.chain_id) {
    return;
  }

  // get stake token
  getStakeToken();

  // get credit
  getCredit();

  // get reward speed
  getCreditRewardSpeed();

  getStakeLastTime();
}

let timer = null;
async function connectWallet() {
  if (!(await chainPreCheck())) {
    return;
  }

  refreshStakeData();

  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  timer = setInterval(() => {
    refreshUnharvestCredit();
  }, 1000);

  wallet_call.onAccountChanged(async (accounts) => {
    if (accounts.length == 0) {
      walletAccount.value = "";
      return;
    }
    await getWalletAccount();
    refreshStakeData();
  });
}

async function checkChainCorrect() {
  let chainId = await wallet_call.getChainId();
  return chainId == net_config.chain_id;
}

async function chainPreCheck() {
  // check wallet
  if (!(await wallet_call.checkWallet())) {
    await swal.fire({
      icon: "error",
      title: "Wallet Error",
      html: `A wallet extension is required , e.g:  <a href="https://www.okx.com/web3/?utm_source=mesonnetwork"  target="_blank" style="color: blue">OKX Wallet</a> or <a href="https://metamask.io/?utm_source=mesonnetwork"  target="_blank" style="color: blue">MetaMask</a>. <br/>If you're viewing this page on mobile phone, please open this page in the wallet app's browser. </div>`,
      showDenyButton: false,
      showCancelButton: false,
      showConfirmButton: true,
      confirmButtonText: "OK",
      cancelButtonText: "Cancel",
      denyButtonText: "",
    });
    return false;
  }

  // check chain
  if (net_config.chain_id) {
    await wallet_call.switchNetwork(net_config.chain_id);
    if (!(await checkChainCorrect())) {
      await swal.fire({
        title: "",
        html: `Chain error,  please switch to the correct chain`,
        showDenyButton: false,
        showCancelButton: false,
        showConfirmButton: true,
        confirmButtonText: "OK",
        denyButtonText: "",
      });
      return false;
    }
  }

  // account
  await getWalletAccount();
  if (walletAccount.value == "") {
    await swal.fire({
      title: "",
      html: `Your account not detected, please connect the correct account`,
      showDenyButton: false,
      showCancelButton: false,
      showConfirmButton: true,
      confirmButtonText: "OK",
      denyButtonText: "",
    });
    return false;
  }

  return true;
}

//////// page init ////////
onMounted(async () => {
  connectWallet();
});
onBeforeUnmount(() => { });
</script>

<template>
  <div class="flex flex-col min-h-screen overflow-hidden">
    <!-- Site header -->
    <header class="absolute w-full z-30">
      <div class="max-w-6xl mx-auto  ">
        <div class="flex items-center justify-between h-16 md:h-20" style="padding: 0px 50px;">
          <!-- Site branding -->

          <div class="shrink-0 mr-4">
            <!-- Logo -->
            <router-link class="block" to="/" aria-label="Cruip">
              <svg width="390" height="32" viewBox="0 0 390 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g clip-path="url(#clip0_1243_8)">
                  <g clip-path="url(#clip1_1243_8)">
                    <mask id="path-1-outside-1_1243_8" maskUnits="userSpaceOnUse" x="37.7803" y="9.56604" width="98"
                      height="14" fill="black">
                      <rect fill="white" x="37.7803" y="9.56604" width="98" height="14" />
                      <path
                        d="M50.459 22.566H38.4217V9.99279H40.7108V20.277H50.459V22.566ZM66.7953 22.566H64.5062V19.1157H55.696V16.7819H64.5062V12.2484L58.5545 12.2484C57.9962 12.2484 57.4714 12.3563 56.9801 12.5722C56.4888 12.7806 56.0607 13.0672 55.696 13.432C55.3312 13.7968 55.0409 14.2248 54.825 14.7161C54.6166 15.2 54.5123 15.7211 54.5123 16.2794V22.566H52.2009V16.2794C52.2009 15.401 52.3684 14.5784 52.7034 13.8117C53.0384 13.0449 53.4925 12.3749 54.0657 11.8017C54.6389 11.2285 55.3126 10.7782 56.0868 10.4506C56.861 10.1156 57.6836 9.94813 58.5545 9.94813H66.7953V22.566ZM81.6464 22.566C81.6464 21.7323 81.505 20.9246 81.2221 20.143C80.9467 19.3539 80.5707 18.6132 80.0943 17.9209C79.6253 17.2211 79.0782 16.5697 78.4529 15.9668C77.835 15.3638 77.1836 14.8278 76.4988 14.3588C75.8139 13.8824 75.1142 13.4841 74.3995 13.164C73.6923 12.8365 73.0186 12.5945 72.3784 12.4382V22.566H70.0893V9.99279H71.3288V10.0151C72.1476 10.0598 73.0186 10.2422 73.9417 10.5623C74.8722 10.8749 75.7953 11.303 76.7109 11.8464C77.634 12.3824 78.5199 13.0226 79.3685 13.767C80.2246 14.504 80.9839 15.3191 81.6464 16.2124V9.99279H83.9244V22.566H81.6464ZM102.137 16.2348C102.137 17.1206 101.995 17.9506 101.712 18.7248C101.429 19.4916 101.031 20.1616 100.517 20.7348C100.004 21.3005 99.3822 21.7472 98.6527 22.0747C97.9306 22.4023 97.1304 22.566 96.2519 22.566H90.6353V20.2546H96.2519C96.8103 20.2546 97.309 20.1504 97.7482 19.942C98.1874 19.7335 98.5596 19.4506 98.8649 19.0933C99.1775 18.7286 99.4157 18.3042 99.5795 17.8204C99.7433 17.329 99.8252 16.8005 99.8252 16.2348C99.8252 15.6764 99.7433 15.1553 99.5795 14.6715C99.4157 14.1876 99.1775 13.767 98.8649 13.4097C98.5596 13.0524 98.1874 12.7695 97.7482 12.561C97.309 12.3526 96.8103 12.2484 96.2519 12.2484H89.5522V22.566H87.2184V9.94813L96.2519 9.94813C97.1304 9.94813 97.9306 10.1119 98.6527 10.4394C99.3822 10.767 100.004 11.2136 100.517 11.7794C101.031 12.3452 101.429 13.0114 101.712 13.7782C101.995 14.5375 102.137 15.3563 102.137 16.2348ZM117.814 22.566H104.682V9.94813H117.814V12.2484H106.994V20.2546H117.814V22.566ZM116.351 17.3514H108.077V15.04H116.351V17.3514ZM135.166 22.566H132.051L128.478 19.1603H123.844V16.8936H130.175C130.495 16.8936 130.797 16.8303 131.08 16.7037C131.362 16.5772 131.608 16.4097 131.817 16.2013C132.025 15.9854 132.189 15.736 132.308 15.4531C132.427 15.1702 132.487 14.8725 132.487 14.5598C132.487 14.2397 132.427 13.9419 132.308 13.6665C132.189 13.3836 132.025 13.138 131.817 12.9295C131.608 12.7211 131.362 12.5573 131.08 12.4382C130.797 12.3117 130.495 12.2484 130.175 12.2484H122.649V22.566H120.36V9.99279H130.175C130.808 9.99279 131.403 10.1156 131.962 10.3613C132.52 10.5995 133.004 10.927 133.413 11.3439C133.83 11.7533 134.158 12.2372 134.396 12.7955C134.634 13.3464 134.753 13.9345 134.753 14.5598C134.753 15.0735 134.671 15.5685 134.508 16.0449C134.344 16.5139 134.113 16.9457 133.815 17.3402C133.525 17.7273 133.179 18.0623 132.777 18.3452C132.375 18.6281 131.936 18.8365 131.459 18.9705L135.166 22.566Z" />
                    </mask>
                    <path
                      d="M50.459 22.566H38.4217V9.99279H40.7108V20.277H50.459V22.566ZM66.7953 22.566H64.5062V19.1157H55.696V16.7819H64.5062V12.2484L58.5545 12.2484C57.9962 12.2484 57.4714 12.3563 56.9801 12.5722C56.4888 12.7806 56.0607 13.0672 55.696 13.432C55.3312 13.7968 55.0409 14.2248 54.825 14.7161C54.6166 15.2 54.5123 15.7211 54.5123 16.2794V22.566H52.2009V16.2794C52.2009 15.401 52.3684 14.5784 52.7034 13.8117C53.0384 13.0449 53.4925 12.3749 54.0657 11.8017C54.6389 11.2285 55.3126 10.7782 56.0868 10.4506C56.861 10.1156 57.6836 9.94813 58.5545 9.94813H66.7953V22.566ZM81.6464 22.566C81.6464 21.7323 81.505 20.9246 81.2221 20.143C80.9467 19.3539 80.5707 18.6132 80.0943 17.9209C79.6253 17.2211 79.0782 16.5697 78.4529 15.9668C77.835 15.3638 77.1836 14.8278 76.4988 14.3588C75.8139 13.8824 75.1142 13.4841 74.3995 13.164C73.6923 12.8365 73.0186 12.5945 72.3784 12.4382V22.566H70.0893V9.99279H71.3288V10.0151C72.1476 10.0598 73.0186 10.2422 73.9417 10.5623C74.8722 10.8749 75.7953 11.303 76.7109 11.8464C77.634 12.3824 78.5199 13.0226 79.3685 13.767C80.2246 14.504 80.9839 15.3191 81.6464 16.2124V9.99279H83.9244V22.566H81.6464ZM102.137 16.2348C102.137 17.1206 101.995 17.9506 101.712 18.7248C101.429 19.4916 101.031 20.1616 100.517 20.7348C100.004 21.3005 99.3822 21.7472 98.6527 22.0747C97.9306 22.4023 97.1304 22.566 96.2519 22.566H90.6353V20.2546H96.2519C96.8103 20.2546 97.309 20.1504 97.7482 19.942C98.1874 19.7335 98.5596 19.4506 98.8649 19.0933C99.1775 18.7286 99.4157 18.3042 99.5795 17.8204C99.7433 17.329 99.8252 16.8005 99.8252 16.2348C99.8252 15.6764 99.7433 15.1553 99.5795 14.6715C99.4157 14.1876 99.1775 13.767 98.8649 13.4097C98.5596 13.0524 98.1874 12.7695 97.7482 12.561C97.309 12.3526 96.8103 12.2484 96.2519 12.2484H89.5522V22.566H87.2184V9.94813L96.2519 9.94813C97.1304 9.94813 97.9306 10.1119 98.6527 10.4394C99.3822 10.767 100.004 11.2136 100.517 11.7794C101.031 12.3452 101.429 13.0114 101.712 13.7782C101.995 14.5375 102.137 15.3563 102.137 16.2348ZM117.814 22.566H104.682V9.94813H117.814V12.2484H106.994V20.2546H117.814V22.566ZM116.351 17.3514H108.077V15.04H116.351V17.3514ZM135.166 22.566H132.051L128.478 19.1603H123.844V16.8936H130.175C130.495 16.8936 130.797 16.8303 131.08 16.7037C131.362 16.5772 131.608 16.4097 131.817 16.2013C132.025 15.9854 132.189 15.736 132.308 15.4531C132.427 15.1702 132.487 14.8725 132.487 14.5598C132.487 14.2397 132.427 13.9419 132.308 13.6665C132.189 13.3836 132.025 13.138 131.817 12.9295C131.608 12.7211 131.362 12.5573 131.08 12.4382C130.797 12.3117 130.495 12.2484 130.175 12.2484H122.649V22.566H120.36V9.99279H130.175C130.808 9.99279 131.403 10.1156 131.962 10.3613C132.52 10.5995 133.004 10.927 133.413 11.3439C133.83 11.7533 134.158 12.2372 134.396 12.7955C134.634 13.3464 134.753 13.9345 134.753 14.5598C134.753 15.0735 134.671 15.5685 134.508 16.0449C134.344 16.5139 134.113 16.9457 133.815 17.3402C133.525 17.7273 133.179 18.0623 132.777 18.3452C132.375 18.6281 131.936 18.8365 131.459 18.9705L135.166 22.566Z"
                      fill="url(#paint0_linear_1243_8)" />
                    <path
                      d="M50.459 22.566V22.7542H50.6472V22.566H50.459ZM38.4217 22.566H38.2335V22.7542H38.4217V22.566ZM38.4217 9.99279V9.8046H38.2335V9.99279H38.4217ZM40.7108 9.99279H40.899V9.8046H40.7108V9.99279ZM40.7108 20.277H40.5226V20.4651H40.7108V20.277ZM50.459 20.277H50.6472V20.0888H50.459V20.277ZM50.459 22.3778H38.4217V22.7542H50.459V22.3778ZM38.6099 22.566V9.99279H38.2335V22.566H38.6099ZM38.4217 10.181H40.7108V9.8046H38.4217V10.181ZM40.5226 9.99279V20.277H40.899V9.99279H40.5226ZM40.7108 20.4651H50.459V20.0888H40.7108V20.4651ZM50.2708 20.277V22.566H50.6472V20.277H50.2708ZM66.7953 22.566V22.7542H66.9835V22.566H66.7953ZM64.5062 22.566H64.318V22.7542H64.5062V22.566ZM64.5062 19.1157H64.6944V18.9275H64.5062V19.1157ZM55.696 19.1157H55.5078V19.3038H55.696V19.1157ZM55.696 16.7819V16.5937H55.5078V16.7819H55.696ZM64.5062 16.7819V16.9701H64.6944V16.7819H64.5062ZM64.5062 12.2484H64.6944V12.0602H64.5062V12.2484ZM56.9801 12.5722L57.0536 12.7455L57.0558 12.7445L56.9801 12.5722ZM54.825 14.7161L54.6527 14.6404L54.6522 14.6417L54.825 14.7161ZM54.5123 22.566V22.7542H54.7005V22.566H54.5123ZM52.2009 22.566H52.0127V22.7542H52.2009V22.566ZM52.7034 13.8117L52.531 13.7363L52.7034 13.8117ZM56.0868 10.4506L56.1601 10.6239L56.1615 10.6233L56.0868 10.4506ZM66.7953 9.94813H66.9835V9.75994H66.7953V9.94813ZM66.7953 22.3778H64.5062V22.7542H66.7953V22.3778ZM64.6944 22.566V19.1157H64.318V22.566H64.6944ZM64.5062 18.9275H55.696V19.3038H64.5062V18.9275ZM55.8842 19.1157V16.7819H55.5078V19.1157H55.8842ZM55.696 16.9701H64.5062V16.5937H55.696V16.9701ZM64.6944 16.7819V12.2484H64.318V16.7819H64.6944ZM64.5062 12.0602L58.5545 12.0602V12.4366L64.5062 12.4366V12.0602ZM58.5545 12.0602C57.9712 12.0602 57.4205 12.1731 56.9044 12.3999L57.0558 12.7445C57.5223 12.5395 58.0212 12.4366 58.5545 12.4366V12.0602ZM56.9066 12.399C56.3938 12.6165 55.9454 12.9165 55.5629 13.2989L55.829 13.5651C56.1761 13.218 56.5837 12.9448 57.0536 12.7455L56.9066 12.399ZM55.5629 13.2989C55.1809 13.6809 54.8776 14.1286 54.6527 14.6404L54.9973 14.7918C55.2042 14.321 55.4815 13.9127 55.829 13.5651L55.5629 13.2989ZM54.6522 14.6417C54.433 15.1505 54.3242 15.6971 54.3242 16.2794H54.7005C54.7005 15.7452 54.8001 15.2496 54.9978 14.7906L54.6522 14.6417ZM54.3242 16.2794V22.566H54.7005V16.2794H54.3242ZM54.5123 22.3778H52.2009V22.7542H54.5123V22.3778ZM52.3891 22.566V16.2794H52.0127V22.566H52.3891ZM52.3891 16.2794C52.3891 15.4256 52.5518 14.6288 52.8759 13.887L52.531 13.7363C52.1851 14.528 52.0127 15.3764 52.0127 16.2794H52.3891ZM52.8759 13.887C53.2017 13.1411 53.6427 12.4909 54.1988 11.9348L53.9326 11.6687C53.3423 12.259 52.875 12.9487 52.531 13.7363L52.8759 13.887ZM54.1988 11.9348C54.7542 11.3794 55.4074 10.9424 56.1601 10.6239L56.0135 10.2773C55.2178 10.6139 54.5236 11.0777 53.9326 11.6687L54.1988 11.9348ZM56.1615 10.6233C56.9114 10.2989 57.7084 10.1363 58.5545 10.1363V9.75994C57.6587 9.75994 56.8106 9.93236 56.0121 10.2779L56.1615 10.6233ZM58.5545 10.1363H66.7953V9.75994H58.5545V10.1363ZM66.6071 9.94813V22.566H66.9835V9.94813H66.6071ZM81.6464 22.566H81.4582V22.7542H81.6464V22.566ZM81.2221 20.143L81.0444 20.205L81.0452 20.207L81.2221 20.143ZM80.0943 17.9209L79.938 18.0256L79.9393 18.0275L80.0943 17.9209ZM78.4529 15.9668L78.3214 16.1014L78.3222 16.1022L78.4529 15.9668ZM76.4988 14.3588L76.3913 14.5133L76.3924 14.5141L76.4988 14.3588ZM74.3995 13.164L74.3204 13.3348L74.3226 13.3358L74.3995 13.164ZM72.3784 12.4382L72.4231 12.2554L72.1902 12.1985V12.4382H72.3784ZM72.3784 22.566V22.7542H72.5666V22.566H72.3784ZM70.0893 22.566H69.9011V22.7542H70.0893V22.566ZM70.0893 9.99279V9.8046H69.9011V9.99279H70.0893ZM71.3288 9.99279H71.517V9.8046H71.3288V9.99279ZM71.3288 10.0151H71.1406V10.1933L71.3185 10.203L71.3288 10.0151ZM73.9417 10.5623L73.88 10.7401L73.8818 10.7407L73.9417 10.5623ZM76.7109 11.8464L76.6149 12.0082L76.6164 12.0091L76.7109 11.8464ZM79.3685 13.767L79.2444 13.9085L79.2457 13.9096L79.3685 13.767ZM81.6464 16.2124L81.4953 16.3245L81.8346 16.7821V16.2124H81.6464ZM81.6464 9.99279V9.8046H81.4582V9.99279H81.6464ZM83.9244 9.99279H84.1126V9.8046H83.9244V9.99279ZM83.9244 22.566V22.7542H84.1126V22.566H83.9244ZM81.8346 22.566C81.8346 21.7105 81.6894 20.8811 81.3991 20.0789L81.0452 20.207C81.3206 20.968 81.4582 21.7541 81.4582 22.566H81.8346ZM81.3998 20.0809C81.1188 19.2759 80.7352 18.5202 80.2494 17.8142L79.9393 18.0275C80.4063 18.7061 80.7746 19.4318 81.0444 20.205L81.3998 20.0809ZM80.2507 17.8161C79.774 17.1049 79.2182 16.4433 78.5835 15.8313L78.3222 16.1022C78.9382 16.6962 79.4767 17.3373 79.938 18.0256L80.2507 17.8161ZM78.5843 15.8321C77.959 15.2218 77.2993 14.6789 76.6051 14.2035L76.3924 14.5141C77.068 14.9767 77.711 15.5057 78.3214 16.1014L78.5843 15.8321ZM76.6062 14.2043C75.9124 13.7216 75.2025 13.3175 74.4764 12.9923L74.3226 13.3358C75.0259 13.6508 75.7154 14.0431 76.3913 14.5133L76.6062 14.2043ZM74.4786 12.9933C73.7623 12.6615 73.077 12.4151 72.4231 12.2554L72.3338 12.621C72.9602 12.774 73.6223 13.0115 74.3204 13.3348L74.4786 12.9933ZM72.1902 12.4382V22.566H72.5666V12.4382H72.1902ZM72.3784 22.3778H70.0893V22.7542H72.3784V22.3778ZM70.2775 22.566V9.99279H69.9011V22.566H70.2775ZM70.0893 10.181H71.3288V9.8046H70.0893V10.181ZM71.1406 9.99279V10.0151H71.517V9.99279H71.1406ZM71.3185 10.203C72.1169 10.2466 72.9705 10.4247 73.88 10.7401L74.0034 10.3845C73.0668 10.0597 72.1784 9.873 71.339 9.82721L71.3185 10.203ZM73.8818 10.7407C74.7987 11.0488 75.7097 11.471 76.6149 12.0082L76.807 11.6846C75.8809 11.1349 74.9458 10.7011 74.0016 10.3839L73.8818 10.7407ZM76.6164 12.0091C77.5284 12.5387 78.4044 13.1716 79.2444 13.9085L79.4926 13.6255C78.6353 12.8735 77.7396 12.2261 76.8054 11.6837L76.6164 12.0091ZM79.2457 13.9096C80.0914 14.6377 80.8412 15.4426 81.4953 16.3245L81.7976 16.1003C81.1266 15.1956 80.3578 14.3703 79.4913 13.6244L79.2457 13.9096ZM81.8346 16.2124V9.99279H81.4582V16.2124H81.8346ZM81.6464 10.181H83.9244V9.8046H81.6464V10.181ZM83.7362 9.99279V22.566H84.1126V9.99279H83.7362ZM83.9244 22.3778H81.6464V22.7542H83.9244V22.3778ZM101.712 18.7248L101.889 18.79L101.889 18.7894L101.712 18.7248ZM100.517 20.7348L100.657 20.8613L100.658 20.8604L100.517 20.7348ZM98.6527 22.0747L98.5756 21.903L98.575 21.9033L98.6527 22.0747ZM90.6353 22.566H90.4471V22.7542H90.6353V22.566ZM90.6353 20.2546V20.0664H90.4471V20.2546H90.6353ZM98.8649 19.0933L98.722 18.9708L98.7218 18.9711L98.8649 19.0933ZM99.5795 17.8204L99.7578 17.8807L99.758 17.8799L99.5795 17.8204ZM99.5795 14.6715L99.4012 14.7318L99.5795 14.6715ZM98.8649 13.4097L98.7218 13.5319L98.7232 13.5336L98.8649 13.4097ZM89.5522 12.2484V12.0602H89.364V12.2484H89.5522ZM89.5522 22.566V22.7542H89.7404V22.566H89.5522ZM87.2184 22.566H87.0302V22.7542H87.2184V22.566ZM87.2184 9.94813V9.75994H87.0302V9.94813H87.2184ZM98.6527 10.4394L98.575 10.6108L98.5756 10.6111L98.6527 10.4394ZM101.712 13.7782L101.536 13.8433L101.536 13.8439L101.712 13.7782ZM101.948 16.2348C101.948 17.1002 101.81 17.9082 101.536 18.6602L101.889 18.7894C102.18 17.993 102.325 17.141 102.325 16.2348H101.948ZM101.536 18.6597C101.261 19.4056 100.874 20.0547 100.377 20.6092L100.658 20.8604C101.188 20.2684 101.598 19.5776 101.889 18.79L101.536 18.6597ZM100.378 20.6083C99.8827 21.1539 99.2826 21.5856 98.5756 21.903L98.7298 22.2464C99.4818 21.9088 100.125 21.4471 100.657 20.8613L100.378 20.6083ZM98.575 21.9033C97.8798 22.2187 97.1065 22.3778 96.2519 22.3778V22.7542C97.1543 22.7542 97.9814 22.5859 98.7304 22.2461L98.575 21.9033ZM96.2519 22.3778H90.6353V22.7542H96.2519V22.3778ZM90.8235 22.566V20.2546H90.4471V22.566H90.8235ZM90.6353 20.4428H96.2519V20.0664H90.6353V20.4428ZM96.2519 20.4428C96.834 20.4428 97.361 20.334 97.8289 20.112L97.6675 19.7719C97.257 19.9668 96.7865 20.0664 96.2519 20.0664V20.4428ZM97.8289 20.112C98.2912 19.8926 98.6849 19.5937 99.008 19.2156L98.7218 18.9711C98.4344 19.3076 98.0837 19.5745 97.6675 19.7719L97.8289 20.112ZM99.0077 19.2158C99.337 18.8316 99.5868 18.3859 99.7578 17.8807L99.4012 17.76C99.2447 18.2226 99.018 18.6255 98.722 18.9708L99.0077 19.2158ZM99.758 17.8799C99.9288 17.3677 100.013 16.8189 100.013 16.2348H99.637C99.637 16.7821 99.5578 17.2904 99.401 17.7609L99.758 17.8799ZM100.013 16.2348C100.013 15.6578 99.9287 15.1162 99.7578 14.6111L99.4012 14.7318C99.5579 15.1945 99.637 15.6951 99.637 16.2348H100.013ZM99.7578 14.6111C99.5867 14.1057 99.3366 13.663 99.0065 13.2858L98.7232 13.5336C99.0184 13.871 99.2448 14.2695 99.4012 14.7318L99.7578 14.6111ZM99.008 13.2875C98.6849 12.9093 98.2912 12.6104 97.8289 12.391L97.6675 12.7311C98.0837 12.9285 98.4344 13.1954 98.7218 13.5319L99.008 13.2875ZM97.8289 12.391C97.361 12.169 96.834 12.0602 96.2519 12.0602V12.4366C96.7865 12.4366 97.257 12.5362 97.6675 12.7311L97.8289 12.391ZM96.2519 12.0602H89.5522V12.4366H96.2519V12.0602ZM89.364 12.2484V22.566H89.7404V12.2484H89.364ZM89.5522 22.3778H87.2184V22.7542H89.5522V22.3778ZM87.4066 22.566V9.94813H87.0302V22.566H87.4066ZM87.2184 10.1363L96.2519 10.1363V9.75994L87.2184 9.75994V10.1363ZM96.2519 10.1363C97.1065 10.1363 97.8798 10.2955 98.575 10.6108L98.7304 10.2681C97.9814 9.9283 97.1543 9.75994 96.2519 9.75994V10.1363ZM98.5756 10.6111C99.2826 10.9286 99.8827 11.3602 100.378 11.9059L100.657 11.6529C100.125 11.0671 99.4818 10.6054 98.7298 10.2678L98.5756 10.6111ZM100.378 11.9059C100.874 12.4526 101.261 13.0976 101.536 13.8433L101.889 13.713C101.598 12.9252 101.188 12.2378 100.657 11.6529L100.378 11.9059ZM101.536 13.8439C101.81 14.5805 101.948 15.3769 101.948 16.2348H102.325C102.325 15.3358 102.18 14.4945 101.889 13.7125L101.536 13.8439ZM117.814 22.566V22.7542H118.002V22.566H117.814ZM104.682 22.566H104.494V22.7542H104.682V22.566ZM104.682 9.94813V9.75994H104.494V9.94813H104.682ZM117.814 9.94813H118.002V9.75994H117.814V9.94813ZM117.814 12.2484V12.4366H118.002V12.2484H117.814ZM106.994 12.2484V12.0602H106.806V12.2484H106.994ZM106.994 20.2546H106.806V20.4428H106.994V20.2546ZM117.814 20.2546H118.002V20.0664H117.814V20.2546ZM116.351 17.3514V17.5396H116.539V17.3514H116.351ZM108.077 17.3514H107.889V17.5396H108.077V17.3514ZM108.077 15.04V14.8518H107.889V15.04H108.077ZM116.351 15.04H116.539V14.8518H116.351V15.04ZM117.814 22.3778H104.682V22.7542H117.814V22.3778ZM104.871 22.566V9.94813H104.494V22.566H104.871ZM104.682 10.1363H117.814V9.75994H104.682V10.1363ZM117.626 9.94813V12.2484H118.002V9.94813H117.626ZM117.814 12.0602H106.994V12.4366H117.814V12.0602ZM106.806 12.2484V20.2546H107.182V12.2484H106.806ZM106.994 20.4428H117.814V20.0664H106.994V20.4428ZM117.626 20.2546V22.566H118.002V20.2546H117.626ZM116.351 17.1632H108.077V17.5396H116.351V17.1632ZM108.265 17.3514V15.04H107.889V17.3514H108.265ZM108.077 15.2282H116.351V14.8518H108.077V15.2282ZM116.163 15.04V17.3514H116.539V15.04H116.163ZM135.166 22.566V22.7542H135.631L135.297 22.4309L135.166 22.566ZM132.051 22.566L131.921 22.7023L131.976 22.7542H132.051V22.566ZM128.478 19.1603L128.608 19.0241L128.553 18.9721H128.478V19.1603ZM123.844 19.1603H123.656V19.3485H123.844V19.1603ZM123.844 16.8936V16.7054H123.656V16.8936H123.844ZM131.817 16.2013L131.95 16.3343L131.952 16.332L131.817 16.2013ZM132.308 13.6665L132.134 13.7395L132.135 13.7412L132.308 13.6665ZM131.08 12.4382L131.003 12.61L131.007 12.6117L131.08 12.4382ZM122.649 12.2484V12.0602H122.461V12.2484H122.649ZM122.649 22.566V22.7542H122.837V22.566H122.649ZM120.36 22.566H120.172V22.7542H120.36V22.566ZM120.36 9.99279V9.8046H120.172V9.99279H120.36ZM131.962 10.3613L131.886 10.5335L131.888 10.5344L131.962 10.3613ZM133.413 11.3439L133.279 11.4758L133.282 11.4782L133.413 11.3439ZM134.396 12.7955L134.223 12.8694L134.223 12.8702L134.396 12.7955ZM134.508 16.0449L134.685 16.107L134.686 16.1061L134.508 16.0449ZM133.815 17.3402L133.665 17.2268L133.665 17.2273L133.815 17.3402ZM132.777 18.3452L132.669 18.1913L132.777 18.3452ZM131.459 18.9705L131.408 18.7893L131.093 18.8779L131.328 19.1056L131.459 18.9705ZM135.166 22.3778H132.051V22.7542H135.166V22.3778ZM132.181 22.4298L128.608 19.0241L128.348 19.2965L131.921 22.7023L132.181 22.4298ZM128.478 18.9721H123.844V19.3485H128.478V18.9721ZM124.032 19.1603V16.8936H123.656V19.1603H124.032ZM123.844 17.0818H130.175V16.7054H123.844V17.0818ZM130.175 17.0818C130.521 17.0818 130.849 17.0132 131.156 16.8755L131.003 16.532C130.745 16.6473 130.47 16.7054 130.175 16.7054V17.0818ZM131.156 16.8755C131.459 16.7401 131.724 16.5598 131.95 16.3343L131.684 16.0682C131.492 16.2596 131.266 16.4143 131.003 16.532L131.156 16.8755ZM131.952 16.332C132.177 16.099 132.353 15.8299 132.481 15.5261L132.134 15.3801C132.024 15.642 131.873 15.8718 131.681 16.0705L131.952 16.332ZM132.481 15.5261C132.61 15.2197 132.675 14.8971 132.675 14.5598H132.298C132.298 14.8479 132.244 15.1208 132.134 15.3801L132.481 15.5261ZM132.675 14.5598C132.675 14.2158 132.611 13.8924 132.481 13.5918L132.135 13.7412C132.243 13.9915 132.298 14.2637 132.298 14.5598H132.675ZM132.481 13.5935C132.353 13.2891 132.176 13.0228 131.95 12.7965L131.684 13.0626C131.874 13.2531 132.024 13.4782 132.134 13.7395L132.481 13.5935ZM131.95 12.7965C131.723 12.5701 131.457 12.3929 131.153 12.2648L131.007 12.6117C131.268 12.7217 131.493 12.8721 131.684 13.0626L131.95 12.7965ZM131.156 12.2664C130.849 12.1287 130.521 12.0602 130.175 12.0602V12.4366C130.47 12.4366 130.745 12.4946 131.003 12.61L131.156 12.2664ZM130.175 12.0602H122.649V12.4366H130.175V12.0602ZM122.461 12.2484V22.566H122.837V12.2484H122.461ZM122.649 22.3778H120.36V22.7542H122.649V22.3778ZM120.548 22.566V9.99279H120.172V22.566H120.548ZM120.36 10.181H130.175V9.8046H120.36V10.181ZM130.175 10.181C130.783 10.181 131.352 10.2988 131.886 10.5335L132.038 10.189C131.454 9.93246 130.833 9.8046 130.175 9.8046V10.181ZM131.888 10.5344C132.424 10.7633 132.888 11.0772 133.279 11.4758L133.548 11.212C133.12 10.7769 132.616 10.4357 132.036 10.1882L131.888 10.5344ZM133.282 11.4782C133.68 11.8697 133.994 12.3328 134.223 12.8694L134.569 12.7217C134.322 12.1416 133.98 11.637 133.545 11.2097L133.282 11.4782ZM134.223 12.8702C134.451 13.3965 134.565 13.9591 134.565 14.5598H134.942C134.942 13.9099 134.818 13.2963 134.569 12.7208L134.223 12.8702ZM134.565 14.5598C134.565 15.0531 134.487 15.5274 134.33 15.9837L134.686 16.1061C134.856 15.6096 134.942 15.0939 134.942 14.5598H134.565ZM134.33 15.9829C134.173 16.4335 133.951 16.848 133.665 17.2268L133.966 17.4536C134.275 17.0434 134.515 16.5943 134.685 16.107L134.33 15.9829ZM133.665 17.2273C133.387 17.5984 133.055 17.9196 132.669 18.1913L132.885 18.4991C133.303 18.205 133.664 17.8563 133.966 17.4531L133.665 17.2273ZM132.669 18.1913C132.284 18.4618 131.864 18.6611 131.408 18.7893L131.51 19.1517C132.007 19.0119 132.466 18.7943 132.885 18.4991L132.669 18.1913ZM131.328 19.1056L135.035 22.7011L135.297 22.4309L131.59 18.8354L131.328 19.1056Z"
                      fill="#CBD5E1" mask="url(#path-1-outside-1_1243_8)" />
                    <g clip-path="url(#clip2_1243_8)">
                      <path
                        d="M10.7716 8.901H7.27637L14.0036 15.877L7.27637 22.8529H10.7716L15.7513 17.6892L20.7309 22.8529H24.2262L10.7716 8.901Z"
                        fill="url(#paint1_linear_1243_8)" />
                      <path d="M24.2262 8.901H20.7309L16.4532 13.3369L18.2008 15.1491L24.2262 8.901Z"
                        fill="url(#paint2_linear_1243_8)" />
                      <circle cx="5.58047" cy="5.6514" r="1.13028" fill="url(#paint3_linear_1243_8)" />
                      <path
                        d="M15.7538 30.2349C7.79482 30.2349 1.34277 23.7829 1.34277 15.8239C1.34277 13.2297 2.02823 10.7956 3.22791 8.69288M15.7538 1.41284C13.1251 1.41284 10.6607 2.1167 8.53887 3.34625"
                        stroke="#CBD5E1" stroke-width="2.26056" stroke-linecap="round" />
                      <path
                        d="M15.753 30.2349C23.712 30.2349 30.1641 23.7829 30.1641 15.8239C30.1641 13.2297 29.4786 10.7956 28.2789 8.69288C27.5503 7.06423 24.8659 4.44605 22.968 3.34625C20.8462 2.1167 18.3818 1.41284 15.753 1.41284"
                        stroke="url(#paint4_linear_1243_8)" stroke-width="2.26056" stroke-linecap="round" />
                    </g>
                  </g>
                  <g clip-path="url(#clip3_1243_8)">
                    <path d="M220.364 3.02405L202.098 23.4964" stroke="#CFD8DD" stroke-width="1.03577" />
                    <path d="M240.39 7.33789L202.098 23.4976" stroke="#CFD8DD" stroke-width="1.03577" />
                    <path d="M220.639 28.6772L202.051 23.522" stroke="#CFD8DD" stroke-width="1.03577" />
                    <path d="M220.864 2.82227L214.891 18.3624" stroke="#CFD8DD" stroke-width="1.03577" />
                    <path d="M221.561 28.2817L215.018 18.1694" stroke="#CFD8DD" stroke-width="1.03577" />
                    <path d="M220.814 2.15698L240.444 5.87472" stroke="#CFD8DD" stroke-width="1.03577" />
                    <path d="M220.765 1.93384L238.882 16.4082" stroke="#CFD8DD" stroke-width="1.03577" />
                    <path d="M241.788 8.79932L238.839 16.4826" stroke="#CFD8DD" stroke-width="1.03577" />
                    <path d="M221.088 1.76208L222.079 29.3229" stroke="#CFD8DD" stroke-width="1.03577" />
                    <path d="M241.112 8.05249L221.953 29.2436" stroke="#CFD8DD" stroke-width="1.03577" />
                    <path d="M237.592 17.399L222.82 28.5275" stroke="#CFD8DD" stroke-width="1.03577" />
                    <circle cx="243.001" cy="6.29698" r="3.84166" fill="#FFC107" />
                    <circle cx="222.044" cy="28.5887" r="2.86266" fill="#2196F4" />
                    <circle cx="221.128" cy="2.06966" r="2.06954" fill="#F34335" />
                    <circle cx="214.925" cy="18.0564" r="2.06954" fill="#9C27AF" />
                    <circle cx="202.066" cy="23.5827" r="2.06954" fill="#F34335" />
                    <circle cx="238.867" cy="16.7451" r="2.06954" fill="#8BC349" />
                    <path
                      d="M253.498 11.1448H256.274L258.856 16.8228L261.439 11.1448H264.215V20.8765H261.966L261.952 14.7126L259.689 19.9047H258.023L255.761 14.7126V20.8765H253.498V11.1448ZM266.106 11.1448H273.783V13.1717H268.646V14.9903H273.283V17.0032L268.646 17.0171V18.8496H273.922V20.8765H266.106V11.1448ZM282.179 14.1434C281.152 13.5604 279.847 13.1023 279.042 13.1023C278.431 13.1023 278.028 13.3244 278.028 13.7686C278.028 15.379 283.151 14.4627 283.151 17.9611C283.151 19.9463 281.402 20.9598 279.236 20.9598C277.612 20.9598 275.918 20.3628 274.752 19.4049L275.738 17.4197C276.737 18.2804 278.25 18.8913 279.264 18.8913C280.013 18.8913 280.485 18.6136 280.485 18.1C280.485 16.4479 275.363 17.4475 275.363 14.0046C275.363 12.186 276.904 11.0338 279.25 11.0338C280.68 11.0338 282.124 11.478 283.137 12.1305L282.179 14.1434ZM289.085 11.0754C292.098 11.0754 294.347 13.1856 294.347 16.0037C294.347 18.8496 292.098 20.9875 289.085 20.9875C286.073 20.9875 283.824 18.8496 283.824 16.0037C283.824 13.1717 286.073 11.0754 289.085 11.0754ZM289.113 13.2411C287.656 13.2411 286.434 14.435 286.434 16.0176C286.434 17.6002 287.669 18.8219 289.113 18.8219C290.571 18.8219 291.737 17.6002 291.737 16.0176C291.737 14.435 290.571 13.2411 289.113 13.2411ZM295.606 11.1448H297.841L302.256 17.0032V11.1448H304.616V20.8765H302.395L297.98 15.0458V20.8765H295.606V11.1448ZM307.269 18.5859C307.963 18.5859 308.463 19.0717 308.463 19.7797C308.463 20.4878 307.963 20.9875 307.269 20.9875C306.575 20.9875 306.089 20.4878 306.089 19.7797C306.089 19.0717 306.575 18.5859 307.269 18.5859Z"
                      fill="#B6DCEF" />
                    <path
                      d="M309.923 11.1448H312.158L316.572 17.0032V11.1448H318.932V20.8765H316.711L312.296 15.0458V20.8765H309.923V11.1448ZM320.836 11.1448H328.513V13.1717H323.377V14.9903H328.013V17.0032L323.377 17.0171V18.8496H328.652V20.8765H320.836V11.1448ZM329.357 11.1448H337.701V13.2411H334.785V20.8765H332.245V13.2411H329.357V11.1448ZM337.76 11.1448H340.495L342.341 18.1833L344.173 11.1448H346.658L348.505 18.1833L350.337 11.1448H352.947L349.74 20.8765H347.116L345.367 14.31L343.563 20.8765H340.953L337.76 11.1448ZM358.403 11.0754C361.416 11.0754 363.665 13.1856 363.665 16.0037C363.665 18.8496 361.416 20.9875 358.403 20.9875C355.391 20.9875 353.142 18.8496 353.142 16.0037C353.142 13.1717 355.391 11.0754 358.403 11.0754ZM358.431 13.2411C356.973 13.2411 355.751 14.435 355.751 16.0176C355.751 17.6002 356.987 18.8219 358.431 18.8219C359.888 18.8219 361.055 17.6002 361.055 16.0176C361.055 14.435 359.888 13.2411 358.431 13.2411ZM373.642 20.8765H370.768L369.352 18.1833H369.297H367.464V20.8765H364.924V11.1448H369.297C371.879 11.1448 373.351 12.3943 373.351 14.5599C373.351 16.0315 372.74 17.1143 371.615 17.6974L373.642 20.8765ZM367.464 13.1717V16.1564H369.311C370.338 16.1564 370.935 15.6289 370.935 14.6432C370.935 13.6853 370.338 13.1717 369.311 13.1717H367.464ZM384.326 20.8765H381.286L378.76 17.1143L377.51 18.5026V20.8765H374.97V11.1448H377.51V15.2263L381.161 11.1448H384.104L380.495 15.1708L384.326 20.8765Z"
                      fill="white" />
                  </g>
                  <path
                    d="M172.882 22C172.584 22 172.323 21.888 172.099 21.665L162.335 11.9C161.888 11.452 161.888 10.744 162.335 10.334C162.783 9.88703 163.491 9.88703 163.901 10.334L173.665 20.061C174.112 20.508 174.112 21.216 173.665 21.626C173.441 21.887 173.143 21.999 172.882 21.999V22Z"
                    fill="white" />
                  <path
                    d="M163.118 22C162.82 22 162.559 21.888 162.335 21.665C161.888 21.217 161.888 20.509 162.335 20.099L172.062 10.335C172.509 9.88801 173.217 9.88801 173.627 10.335C174.075 10.783 174.075 11.491 173.627 11.901L163.901 21.665C163.801 21.7713 163.679 21.8559 163.544 21.9135C163.41 21.9711 163.265 22.0006 163.118 22Z"
                    fill="white" />
                </g>
                <defs>
                  <linearGradient id="paint0_linear_1243_8" x1="156.49" y1="10.0279" x2="34.6618" y2="22.4982"
                    gradientUnits="userSpaceOnUse">
                    <stop stop-color="white" />
                    <stop offset="0.405" stop-color="#CBD5E1" />
                  </linearGradient>
                  <linearGradient id="paint1_linear_1243_8" x1="21.8993" y1="26.0671" x2="5.65159" y2="8.901"
                    gradientUnits="userSpaceOnUse">
                    <stop stop-color="#CBD5E1" stop-opacity="0.5" />
                    <stop offset="1" stop-color="#CBD5E1" />
                  </linearGradient>
                  <linearGradient id="paint2_linear_1243_8" x1="21.8993" y1="26.0671" x2="5.65159" y2="8.901"
                    gradientUnits="userSpaceOnUse">
                    <stop stop-color="#CBD5E1" stop-opacity="0.5" />
                    <stop offset="1" stop-color="#CBD5E1" />
                  </linearGradient>
                  <linearGradient id="paint3_linear_1243_8" x1="6.14561" y1="6.56975" x2="4.73276" y2="5.01562"
                    gradientUnits="userSpaceOnUse">
                    <stop stop-color="#CBD5E1" stop-opacity="0.5" />
                    <stop offset="1" stop-color="#CBD5E1" />
                  </linearGradient>
                  <linearGradient id="paint4_linear_1243_8" x1="22.9585" y1="1.41284" x2="22.9585" y2="30.2349"
                    gradientUnits="userSpaceOnUse">
                    <stop stop-color="#CBD5E1" />
                    <stop offset="1" stop-color="#CBD5E1" />
                  </linearGradient>
                  <clipPath id="clip0_1243_8">
                    <rect width="390" height="32" fill="white" />
                  </clipPath>
                  <clipPath id="clip1_1243_8">
                    <rect width="136" height="31.6478" fill="white" />
                  </clipPath>
                  <clipPath id="clip2_1243_8">
                    <rect width="31.6478" height="31.6478" fill="white" />
                  </clipPath>
                  <clipPath id="clip3_1243_8">
                    <rect width="190" height="31.4206" fill="white" transform="translate(200)" />
                  </clipPath>
                </defs>
              </svg>


            </router-link>
          </div>


        </div>
      </div>
    </header>

    <!-- Page content -->
    <main class="grow">
      <section class="relative">
        <!-- Illustration -->
        <div class="  lg:block absolute top-0   -z-10" style="width: 100%;" aria-hidden="true">
          <img src="../../images/harvest_bg.jpg" class="max-w-none" alt="Pricing Illustration" style="width:100%" />
        </div>

        <div class="max-w-6xl mx-auto  ">
          <div class="py-20 md:py-25 border-t border-gray-800 md:px-10"
            style="background-color: #00000087; border-bottom-left-radius: 20px; border-bottom-right-radius: 20px;">
            <!-- Section header -->
            <div class="max-w-3xl mx-auto text-center pb-12 md:pb-20">
              <h2 class="h2 font-uncut-sans mb-4" style="color: white;"><a class="xlander_text" href="https://xlander.io">XLander.IO</a> Next Layer1</h2>
              <div class="max-w-2xl mx-auto">
                <p class="text-xl text-white" style="font-weight: bold;">Staking Meson.Network's MainNet token (MSN)
                  will grant credits, which will be
                  mapped into <span style="font-size: 25px;">100%</span> of the XLander's <span
                    style="font-size: 25px;">SEED</span> round.</p>
              </div>
            </div>

            <!-- Pricing tables -->
            <div class="max-w-sm mx-auto grid gap-8 lg:grid-cols-2 lg:gap-6 items-start lg:max-w-none pt-4" >
              <!-- Pricing table 2 -->
              <div class="relative flex flex-col h-full p-6 bg-gray-800" style="border-radius: 10px;box-shadow: rgb(31, 31, 31) 3px 3px 3px;">
                <div class="absolute top-0 right-0 mr-6 -mt-4">
                  <div
                    class="inline-flex items-center text-sm font-semibold py-1 px-3 text-emerald-600 bg-emerald-200 rounded-full">
                    <svg class="fill-emerald-500 mr-2" width="12" height="14" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M5.315.068a.5.5 0 0 0-.745.347A7.31 7.31 0 0 1 3.182 3.6a7.924 7.924 0 0 1-.8.83A6.081 6.081 0 0 0 0 9.035a5.642 5.642 0 0 0 2.865 4.9.5.5 0 0 0 .746-.4 2.267 2.267 0 0 1 .912-1.67 4.067 4.067 0 0 0 1.316-1.4 4.662 4.662 0 0 1 1.819 3.1.5.5 0 0 0 .742.371c1.767-.999 2.86-2.87 2.865-4.9-.001-3.589-2.058-6.688-5.95-8.968Z" />
                    </svg>
                    <span>HOT!</span>
                  </div>
                </div>
                <div class="mb-6">
                  <div class="text-lg font-semibold mb-1" style="    border-bottom: 1px solid #404d5e;padding-bottom: 5px;">STAKE</div>
                  <div class="text-gray-400 mb-6"></div>

                  <div>
                    <div v-if="walletAccount == ''" @click="connectWallet"
                      class="btn-sm text-white bg-gradient-to-t from-blue-600 to-blue-400 hover:to-blue-500 w-full shadow-lg group">
                      Connect wallet
                    </div>
                    <div v-if="walletAccount != ''"
                      class="btn-sm text-white bg-gradient-to-t from-blue-600 to-blue-400 w-full shadow-lg group">
                      {{ walletAccount }}
                    </div>
                  </div>
                  <div class="text-lg font-semibold  mt-6 mb-2">STAKE TOKE</div>
                  <div class="flex justify-between">
                    <!--  -->
                    <div class="font-uncut-sans inline-flex items-baseline mb-4">
                      <span class="text-3xl font-medium text-gray-400"></span>
                      <span class="text-4xl font-bold leading-7">{{
                      tokenAmountParser.parserToMoneyFormat(stakeTokenAmount, 18, 8, 8) }}</span>
                      <!-- <span class="font-medium text-gray-400">.00</span> -->
                    </div>

                    <!--  -->
                    <div class="font-uncut-sans flex items-center mb-4" @click="getStakeToken()">
                      <svg id="rotateIcon"
                        class="icon w-6 h-6 text-white cursor-pointer transition duration-300 transform hover:rotate-180"
                        viewBox="0 0 1024 1024">
                        <path
                          d="M760.762906 345.436286a335.431549 335.431549 0 1 0 84.888678 228.350545l119.511133-32.015159A454.275699 454.275699 0 1 1 648.709851 136.00379L605.174086 60.63477l105.019422-60.63477L889.733062 310.935102z"
                          fill="#ffffff"></path>
                      </svg>
                    </div>
                  </div>

                  <div class="text-gray-400 mb-6"></div>
                  <a class="btn-sm text-white bg-gradient-to-t from-blue-600 to-blue-400 hover:to-blue-500 w-full shadow-lg group"
                    @click="toStake()">
                    Stake
                    <span
                      class="tracking-normal text-blue-200 group-hover:translate-x-0.5 transition-transform duration-150 ease-in-out ml-1"></span>
                  </a>
                  <div class="text-gray-400 mb-3"></div>
                  <a class="btn-sm text-white bg-gradient-to-t  from-zinc-700 to-gray-600 hover:to-gray-700 w-full shadow-lg group"
                    @click="toUnstake()">
                    Unstake
                    <span
                      class="tracking-normal text-blue-200 group-hover:translate-x-0.5 transition-transform duration-150 ease-in-out ml-1"></span>
                  </a>
                </div>
              </div>

              <div class="relative flex flex-col h-full p-6 bg-gray-800" style="border-radius: 10px; box-shadow: 3px 3px 3px #1f1f1f;">
                <div class="absolute top-0 right-0 mr-6 -mt-4"></div>
                <div class="mb-6">
                  <div class="text-lg font-semibold mb-1" style="    border-bottom: 1px solid #404d5e;
    padding-bottom: 5px;">HARVEST</div>
                  <div class="text-gray-400 mb-4"></div>
                  <div class="text-lg font-semibold mb-2">UNHARVEST CREDIT</div>
                  <div class="font-uncut-sans inline-flex items-baseline mb-2">
                    <span class="text-3xl font-medium text-gray-400"></span>
                    <span class="text-4xl font-bold leading-7">{{ tokenAmountParser.parserToMoneyFormat(unharvestCredit,
                      18, 5, 5) }}</span>
                    <!-- <span class="font-medium text-gray-400">.00</span> -->
                  </div>
                  <div class="text-gray-400 mb-6"></div>
                  <div class="text-lg font-semibold mb-2">HARVEST CREDIT</div>
                  <div class="flex justify-between">
                    <!--  -->
                    <div class="font-uncut-sans inline-flex items-baseline mb-4">
                      <span class="text-3xl font-medium text-gray-400"></span>
                      <span class="text-4xl font-bold leading-7">{{ tokenAmountParser.parserToMoneyFormat(credit, 18, 8,
                      8) }}</span>
                      <!-- <span class="font-medium text-gray-400">.00</span> -->
                    </div>

                    <!--  -->
                    <div class="font-uncut-sans flex items-center mb-4" @click="getCredit()">
                      <svg id="rotateIcon"
                        class="icon w-6 h-6 text-white cursor-pointer transition duration-300 transform hover:rotate-180"
                        viewBox="0 0 1024 1024">
                        <path
                          d="M760.762906 345.436286a335.431549 335.431549 0 1 0 84.888678 228.350545l119.511133-32.015159A454.275699 454.275699 0 1 1 648.709851 136.00379L605.174086 60.63477l105.019422-60.63477L889.733062 310.935102z"
                          fill="#ffffff"></path>
                      </svg>
                    </div>
                  </div>

                  <a class="btn-sm text-white bg-gradient-to-t from-blue-600 to-blue-400 hover:to-blue-500 w-full shadow-lg group mt-4"
                    @click="harvest()">
                    Harvest
                    <span
                      class="tracking-normal text-blue-200 group-hover:translate-x-0.5 transition-transform duration-150 ease-in-out ml-1"></span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <Modal v-model:open="stakeWinVisible" margin-close="true">
      <template v-slot:header>Stake Token</template>

      <template v-slot:body>
        <div class="my-2">
          <p>Msn balance in wallet</p>
          <input type="text" :value="tokenAmountParser.parserToMoneyFormat(msnBalanceInWallet, 18, 8, 8)" disabled
            class="mt-1 disabled rounded" />
          <p class="mt-3">Amount to stake</p>
          <input type="number" v-model="toStakeAmount" placeholder="Amount to stake" class="rounded mt-1"
            style="color: black" />
        </div>
      </template>

      <template v-slot:footer>
        <div class="flex justify-end w-full">
          <button type="button" class="btn-secondary mr-3" @click="stakeWinVisible = false">Cancel</button>
          <button class="btn-primary" @click="doStake">Confirm</button>
        </div>
      </template>
    </Modal>

    <Modal v-model:open="unstakeWinVisible" margin-close="true">
      <template v-slot:header>Unstake Token</template>

      <template v-slot:body>
        <div class="my-2">
          <p>Stake token in contract</p>
          <input type="text" :value="tokenAmountParser.parserToMoneyFormat(stakeTokenAmount, 18, 8, 8)" disabled
            class="mt-1 disabled rounded" />
          <p class="mt-3">Amount to unstake</p>
          <input type="text" v-model="unstakeAmount" placeholder="Amount to unstake" class="rounded mt-1"
            style="color: black" />
        </div>
      </template>

      <template v-slot:footer>
        <div class="flex justify-end w-full">
          <button type="button" class="btn-secondary mr-3" @click="unstakeWinVisible = false">Cancel</button>
          <button class="btn-primary" @click="doUnstake">Confirm</button>
        </div>
      </template>
    </Modal>

    <Modal v-model:open="processWalletVisible" margin-close="true">
      <template v-slot:header>Waiting</template>

      <template v-slot:body>
        <div style="color: black">Processing wallet...</div>
      </template>
    </Modal>
  </div>
</template>
