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
        <div class="flex items-center justify-between h-16 md:h-20 md:px-10">
          <!-- Site branding -->

          <div class="shrink-0 mr-4" style="max-width: 100%; margin: 0px 20px;">
            <!-- Logo -->
            <router-link class="block" to="/" aria-label="Cruip">
              <img src="../../images/mxlogo.svg" style="max-width: 100%;" />
            </router-link>
          </div>


        </div>
      </div>
    </header>

    <!-- Page content -->
    <main class="grow">
      <section class="relative">
        <!-- Illustration -->
        <div class="harvestbg lg:block absolute top-0   -z-10" aria-hidden="true">
          <img src="../../images/harvest_bg.jpg" class="max-w-none" alt="Pricing Illustration" style="width:100%" />
        </div>

        <div class="max-w-6xl mx-auto  ">
          <div class="py-20 md:py-25 border-t border-gray-800 md:px-10"
            style="background-color: rgb(0 0 0 / 65%);  border-bottom-left-radius: 20px; border-bottom-right-radius: 20px;">
            <!-- Section header -->
            <div class=" mx-auto  pb-12 md:pb-15" style="margin: 20px 20px;">
              <h2 class="h2 font-uncut-sans" style="color: white;"><a class="xlander_text"
                  href="https://xlander.io">XLander.IO</a> Next Layer1</h2>

              <p class="text-white text-left mt-2" style="font-size: 15px;font-weight: bold;border-radius: 5px;">Staking
                Meson.Network's MainNet token (MSN)
                will grant credits, which will be
                mapped into <span style=" ">100%</span> of the XLander's <span style=" ">SEED</span> round.</p>

            </div>

            <!-- Pricing tables -->
            <div class=" mx-auto grid gap-8 lg:grid-cols-2 lg:gap-6 items-start lg:max-w-none pt-4"
              style="margin: 0px 20px;">
              <!-- Pricing table 2 -->
              <div class="relative flex flex-col h-full p-6 "
                style="border-radius: 10px;box-shadow: black 3px 3px 3px;background-color: black; ">

                <div class="mb-6">
                  <div class="text-lg font-semibold mb-1"
                    style="    border-bottom: 1px solid   rgb(49 49 49);padding-bottom: 5px;">STAKE</div>
                  <div class="text-gray-400 mb-6"></div>

                  <div>
                    <div v-if="walletAccount == ''" @click="connectWallet"
                      class="wallet_btn btn-sm text-black bg-gradient-to-t from-yellow-600 to-yellow-500 hover:to-yellow-400 w-full shadow-lg group">
                      Connect Wallet
                    </div>
                    <div v-if="walletAccount != ''"
                      class="wallet_btn btn-sm text-black bg-gradient-to-t from-yellow-600 to-yellow-500 hover:to-yellow-400 w-full shadow-lg group">
                      {{ walletAccount }}
                    </div>
                  </div>
                  <div class="text-lg font-semibold  mt-6 mb-2">STAKE TOKEN</div>
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
                  <a class="wallet_btn btn-sm text-black bg-gradient-to-t from-yellow-600 to-yellow-500 hover:to-yellow-400 w-full shadow-lg group"
                    @click="toStake()">
                    Stake
                    <span
                      class="tracking-normal text-blue-200 group-hover:translate-x-0.5 transition-transform duration-150 ease-in-out ml-1"></span>
                  </a>
                  <div class="text-gray-400 mb-3"></div>
                  <a class="btn-sm text-white bg-gradient-to-t  from-neutral-900 to-neutral-900 hover:to-neutral-800 w-full shadow-lg group"
                    @click="toUnstake()">
                    Unstake
                    <span
                      class="tracking-normal text-blue-200 group-hover:translate-x-0.5 transition-transform duration-150 ease-in-out ml-1"></span>
                  </a>
                </div>
              </div>

              <div class="relative flex flex-col h-full p-6 "
                style="border-radius: 10px;  box-shadow: black 3px 3px 3px;background-color: black; ">
                <div class="absolute top-0 right-0 mr-6 -mt-4"></div>
                <div class="mb-6">
                  <div class="text-lg font-semibold mb-1" style="    border-bottom: 1px solid  rgb(49 49 49);;
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

                  <a class="wallet_btn btn-sm text-black bg-gradient-to-t from-yellow-600 to-yellow-500 hover:to-yellow-400 w-full shadow-lg group"
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
