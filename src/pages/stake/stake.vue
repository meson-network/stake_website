<script setup>
import Header from "./Header.vue";
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
    console.log("msn_balanceOf_result:", msn_balanceOf_result.result);
    msnBalanceInWallet.value = msn_balanceOf_result.result.toString();
  } else {
    if (msn_balanceOf_result.err.message == "chain_id error") {
      console.log("please switch to correct chain:" + net_config.chain_name);
    } else {
      console.log("msn_balanceOf err handler:", msn_balanceOf_result.err.message);
    }
  }
}

let toStakeAmount = ref(null);
async function toStake() {
  if (walletAccount.value === "") {
    return;
  }

  await getMsnBalanceInWallet();
  stakeWinVisible.value = true;
}

async function doStake() {
  if (walletAccount.value === "") {
    return;
  }

  // stake amount
  let stake_amount_bn = new BigNumber(toStakeAmount.value);
  stake_amount_bn = stake_amount_bn.times(1e18);
  console.log(stake_amount_bn.toFixed(0));
  var stake_amount_str = stake_amount_bn.toFixed(0);

  // check allowance
  let allow_result = await contract_call.msn_allowance(
    net_config.chain_id,
    net_config.msn_contract_address,
    msn_abi,
    walletAccount.value,
    net_config.stake_contract_address
  );
  console.log(allow_result);
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

      console.log("need approve");
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
      console.log(result);
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
  console.log(stake_stake_result);

  if (stake_stake_result.err === false) {
    //actually you need to check the err if allowance is not enough
    //you need to make the user approve with a large amount
    //the suggest value is 10000000*10^18
    console.log("stake_stake_result:", stake_stake_result.result);
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
  if (walletAccount.value === "") {
    return;
  }

  unstakeWinVisible.value = true;
}
async function doUnstake() {
  if (walletAccount.value === "") {
    return;
  }

  let unstake_amount_bn = new BigNumber(unstakeAmount.value);
  unstake_amount_bn = unstake_amount_bn.times(1e18);
  console.log(unstake_amount_bn.toFixed(0));
  var unstake_amount_str = unstake_amount_bn.toFixed(0);

  // show loading page
  showWalletProcess();
  var stake_unstake_result = await contract_call.stake_unstake(net_config.chain_id, net_config.stake_contract_address, stake_abi, unstake_amount_str);
  //hide loading page
  hideWalletProcess();

  if (stake_unstake_result.err === false) {
    console.log("stake_unstake_result:", stake_unstake_result.result);
    toast.success("success");

    // do something
    refreshStakeData();
    unstakeWinVisible.value = false;
    unstakeAmount.value = null;
  } else {
    if (stake_unstake_result.err.message == "chain_id error") {
      console.log("please switch to correct chain:" + net_config.chain_name);
    } else {
      console.log("stake_unstake err handler:", stake_unstake_result.err.message);
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
    console.log("get_credit_reward_speed_result:", get_credit_reward_speed_result.result);
    creditRewardSpeed.value = get_credit_reward_speed_result.result.toString();
    console.log(creditRewardSpeed.value);
  } else {
    if (get_credit_reward_speed_result.err.message == "chain_id error") {
      console.log("please switch to correct chain:" + net_config.chain_name);
    } else {
      console.log("get_credit_reward_speed err handler:", get_credit_reward_speed_result.err.message);
    }
  }
}

let stakeTokenAmount = ref("");
const getStakeToken = async () => {
  if (walletAccount.value === "") {
    return;
  }

  var stake_get_stake_token_result = await contract_call.stake_get_stake_token(net_config.chain_id, walletAccount.value, net_config.stake_contract_address, stake_abi);

  if (stake_get_stake_token_result.err === false) {
    console.log("stake_get_stake_token_result:", stake_get_stake_token_result.result);
    stakeTokenAmount.value = stake_get_stake_token_result.result.toString();
    console.log(stakeTokenAmount.value);
  } else {
    if (stake_get_stake_token_result.err.message == "chain_id error") {
      console.log("please switch to correct chain:" + net_config.chain_name);
    } else {
      console.log("stake_get_stake_token err handler:", stake_get_stake_token_result.err.message);
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
    console.log("stake_get_stake_last_time_result:", stake_get_stake_last_time_result.result.toString());
    lastStakeTime = parseInt(stake_get_stake_last_time_result.result.toString());
  } else {
    if (stake_get_stake_last_time_result.err.message == "chain_id error") {
      console.log("please switch to correct chain:" + net_config.chain_name);
    } else {
      console.log("stake_get_stake_last_time err handler:", stake_get_stake_last_time_result.err.message);
    }
  }
};

let credit = ref("");
const getCredit = async () => {
  if (walletAccount.value === "") {
    return;
  }
  var stake_get_credit_result = await contract_call.stake_get_credit(net_config.chain_id, walletAccount.value, net_config.stake_contract_address, stake_abi);

  if (stake_get_credit_result.err === false) {
    console.log("stake_get_credit_result:", stake_get_credit_result.result.toString());
    credit.value = stake_get_credit_result.result.toString();
  } else {
    if (stake_get_credit_result.err.message == "chain_id error") {
      console.log("please switch to correct chain:" + net_config.chain_name);
    } else {
      console.log("stake_get_credit err handler:", stake_get_credit_result.err.message);
    }
  }
};

const getTotalCredit = async () => {
  var stake_get_total_credit_result = await contract_call.stake_get_total_credit(net_config.chain_id, net_config.stake_contract_address, stake_abi);

  if (stake_get_total_credit_result.err === false) {
    console.log("stake_get_total_credit_result:", stake_get_total_credit_result.result.toString());
  } else {
    if (stake_get_total_credit_result.err.message == "chain_id error") {
      console.log("please switch to correct chain:" + net_config.chain_name);
    } else {
      console.log("stake_get_total_credit err handler:", stake_get_total_credit_result.err.message);
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
      console.log("please switch to correct chain:" + net_config.chain_name);
    } else {
      // console.log("stake_harvest err handler:", stake_harvest_result.err.message);
      toast.error("harvest err ", stake_harvest_result.err.message);
    }
  }
};

function refreshStakeData() {
  // get stake token
  getStakeToken();

  // get credit
  getCredit();

  // get reward speed
  getCreditRewardSpeed();

  getStakeLastTime();
}

//////// page init ////////
onMounted(async () => {
  if (net_config.chain_id) {
    await wallet_call.switchNetwork(net_config.chain_id);
    await getWalletAccount();

    // confirm wallet address
    await swal.fire({
      title: "",
      html: `<div class='mb-2 p-3 bg-slate-200 text-sm rounded font-bold'>${walletAccount.value}</div><div>Please confirm your current wallet address, please switch to the correct wallet and refresh the page if the address is wrong.<div>`,
      showDenyButton: false,
      showCancelButton: false,
      showConfirmButton: true,
      confirmButtonText: "Confirm",
      denyButtonText: "",
    });

    refreshStakeData();

    setInterval(() => {
      refreshUnharvestCredit();
    }, 1000);
  }
});
onBeforeUnmount(() => {});
</script>

<template>
  <div class="flex flex-col min-h-screen overflow-hidden">
    <!-- Site header -->
    <Header />

    <!-- Page content -->
    <main class="grow">
      <section class="relative">
        <!-- Illustration -->
        <div class="hidden lg:block absolute bottom-0 left-1/2 -translate-x-1/2 pointer-events-none -z-10" aria-hidden="true">
          <img src="../../images/pricing-illustration.svg" class="max-w-none" width="618" height="468" alt="Pricing Illustration" />
        </div>

        <div class="max-w-6xl mx-auto px-4 sm:px-6">
          <div class="py-12 md:py-20 border-t border-gray-800">
            <!-- Section header -->
            <div class="max-w-3xl mx-auto text-center pb-12 md:pb-20">
              <h2 class="h2 font-uncut-sans mb-4">XLander.IO next layer 1</h2>
              <div class="max-w-2xl mx-auto">
                <p class="text-xl text-gray-400">Staking Meson.Network's mainnet token will grant credits, which will be mapped into 100% of the XLander's seed round.</p>
              </div>
            </div>

            <!-- Pricing tables -->
            <div class="max-w-sm mx-auto grid gap-8 lg:grid-cols-2 lg:gap-6 items-start lg:max-w-none pt-4">
              <!-- Pricing table 2 -->
              <div class="relative flex flex-col h-full p-6 bg-gray-800">
                <div class="absolute top-0 right-0 mr-6 -mt-4">
                  <div class="inline-flex items-center text-sm font-semibold py-1 px-3 text-emerald-600 bg-emerald-200 rounded-full">
                    <svg class="fill-emerald-500 mr-2" width="12" height="14" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M5.315.068a.5.5 0 0 0-.745.347A7.31 7.31 0 0 1 3.182 3.6a7.924 7.924 0 0 1-.8.83A6.081 6.081 0 0 0 0 9.035a5.642 5.642 0 0 0 2.865 4.9.5.5 0 0 0 .746-.4 2.267 2.267 0 0 1 .912-1.67 4.067 4.067 0 0 0 1.316-1.4 4.662 4.662 0 0 1 1.819 3.1.5.5 0 0 0 .742.371c1.767-.999 2.86-2.87 2.865-4.9-.001-3.589-2.058-6.688-5.95-8.968Z"
                      />
                    </svg>
                    <span>HOT!</span>
                  </div>
                </div>
                <div class="mb-6">
                  <div class="text-lg font-semibold mb-1">Stake</div>
                  <div class="text-gray-400 mb-6"></div>
                  <div class="text-lg font-semibold mb-1">Stake Token</div>
                  <div class="font-uncut-sans inline-flex items-baseline mb-4">
                    <span class="text-3xl font-medium text-gray-400"></span>
                    <span class="text-4xl font-bold leading-7">{{ tokenAmountParser.parserToMoneyFormat(stakeTokenAmount, 18, 8, 8) }}</span>
                    <!-- <span class="font-medium text-gray-400">.00</span> -->
                  </div>
                  <div class="font-uncut-sans inline-flex items-center mb-4">
                    <svg t="1713661604633" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4228" width="24" height="24"><path d="M760.762906 345.436286a335.431549 335.431549 0 1 0 84.888678 228.350545l119.511133-32.015159A454.275699 454.275699 0 1 1 648.709851 136.00379L605.174086 60.63477l105.019422-60.63477L889.733062 310.935102z" fill="#ffffff" p-id="4229"></path></svg>
                  </div>
                  <div class="text-gray-400 mb-6"></div>
                  <a class="btn-sm text-white bg-gradient-to-t from-blue-600 to-blue-400 hover:to-blue-500 w-full shadow-lg group" @click="toStake()">
                    Stake
                    <span class="tracking-normal text-blue-200 group-hover:translate-x-0.5 transition-transform duration-150 ease-in-out ml-1"></span>
                  </a>
                  <div class="text-gray-400 mb-6"></div>
                  <a class="btn-sm text-white bg-gradient-to-t from-pink-500 to-pink-400 hover:to-pink-500 w-full shadow-lg group" @click="toUnstake()">
                    Unstake
                    <span class="tracking-normal text-blue-200 group-hover:translate-x-0.5 transition-transform duration-150 ease-in-out ml-1"></span>
                  </a>
                </div>
              </div>

              <div class="relative flex flex-col h-full p-6 bg-gray-800">
                <div class="absolute top-0 right-0 mr-6 -mt-4"></div>
                <div class="mb-6">
                  <div class="text-lg font-semibold mb-1">Harvest</div>
                  <div class="text-gray-400 mb-6"></div>
                  <div class="text-lg font-semibold mb-1">Unharvest Credit</div>
                  <div class="font-uncut-sans inline-flex items-baseline mb-2">
                    <span class="text-3xl font-medium text-gray-400"></span>
                    <span class="text-4xl font-bold leading-7">{{ tokenAmountParser.parserToMoneyFormat(unharvestCredit, 18, 5, 5) }}</span>
                    <!-- <span class="font-medium text-gray-400">.00</span> -->
                  </div>
                  <div class="text-gray-400 mb-6"></div>
                  <div class="text-lg font-semibold mb-4">harvest Credit</div>
                  <div class="font-uncut-sans inline-flex items-baseline mb-4">
                    <span class="text-3xl font-medium text-gray-400"></span>
                    <span class="text-4xl font-bold leading-7">{{ tokenAmountParser.parserToMoneyFormat(credit, 18, 8, 8) }}</span>
                    <!-- <span class="font-medium text-gray-400">.00</span> -->
                  </div>
                  <a class="btn-sm text-white bg-gradient-to-t from-blue-600 to-blue-400 hover:to-blue-500 w-full shadow-lg group" @click="harvest()">
                    Harvest
                    <span class="tracking-normal text-blue-200 group-hover:translate-x-0.5 transition-transform duration-150 ease-in-out ml-1"></span>
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
          <input type="text" :value="tokenAmountParser.parserToMoneyFormat(msnBalanceInWallet, 18, 8, 8)" disabled class="mt-1 disabled rounded" />
          <p class="mt-3">Amount to stake</p>
          <input type="number" v-model="toStakeAmount" placeholder="Amount to stake" class="rounded mt-1" />
        </div>
      </template>

      <template v-slot:footer>
        <div class="flex justify-end w-full">
          <button type="button" class="btn-secondary mr-3" @click="stakeWinVisible = false">Cancel</button>
          <button type="button" class="btn-primary" @click="doStake">Confirm</button>
        </div>
      </template>
    </Modal>

    <Modal v-model:open="unstakeWinVisible" margin-close="true">
      <template v-slot:header>Unstake Token</template>

      <template v-slot:body>
        <div class="my-2">
          <p>Staked token in contract</p>
          <input type="text" :value="tokenAmountParser.parserToMoneyFormat(stakeTokenAmount, 18, 8, 8)" disabled class="mt-1 disabled rounded" />
          <p class="mt-3">Amount to unstake</p>
          <input type="text" v-model="unstakeAmount" placeholder="Amount to unstake" class="rounded mt-1" />
        </div>
      </template>

      <template v-slot:footer>
        <div class="flex justify-end w-full">
          <button type="button" class="btn-secondary mr-3" @click="unstakeWinVisible = false">Cancel</button>
          <button type="button" class="btn-primary" @click="doUnstake">Confirm</button>
        </div>
      </template>
    </Modal>

    <Modal v-model:open="processWalletVisible" margin-close="true">
      <template v-slot:header>Waiting</template>

      <template v-slot:body> Processing wallet... </template>
    </Modal>



    <!-- <div>reward speed:{{ tokenAmountParser.parserToMoneyFormat(creditRewardSpeed, 18, 8, 8) }}</div>
    <div>unharvest credit:{{ tokenAmountParser.parserToMoneyFormat(unharvestCredit, 18, 8, 8) }}</div>
    <button @click="getCreditRewardSpeed()" class="btn-primary">get_credit_reward_speed</button>

    <div class="mt-3 mb-3">---------------------</div>

    <div>stake token:{{ tokenAmountParser.parserToMoneyFormat(stakeTokenAmount, 18, 8, 8) }}</div>
    <button @click="getStakeToken()" class="btn-primary">stake_get_stake_token</button>

    <div class="mt-3 mb-3">---------------------</div>

    <div>reward credit:{{ tokenAmountParser.parserToMoneyFormat(credit, 18, 8, 8) }}</div>
    <button @click="getCredit()" class="btn-primary">stake_get_credit</button>

    <div class="mt-3 mb-3">---------------------</div>

    <button @click="toStake()" class="btn-primary">stake_stake</button>
    <button @click="toUnstake()" class="btn-primary">stake_unstake</button>
    <button @click="harvest()" class="btn-primary">stake_harvest</button>

    <div class="mt-3 mb-3">---------other------------</div>
    <button @click="getStakeLastTime()" class="btn-primary">stake_get_stake_last_time</button>
    <button @click="getTotalCredit()" class="btn-primary">stake_get_total_credit</button> -->
  </div>
</template>
