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

let msnBalanceInWallet = ref("")
async function getMsnBalanceInWallet(){
  if (walletAccount.value === "") {
    return;
  }

  var msn_balanceOf_result = await contract_call.msn_balanceOf(
        net_config.chain_id,
        net_config.msn_contract_address,
        msn_abi,
        walletAccount.value)

    if (msn_balanceOf_result.err === false) {
        console.log("msn_balanceOf_result:", msn_balanceOf_result.result)
        msnBalanceInWallet.value=msn_balanceOf_result.result.toString()
    } else {
        if (msn_balanceOf_result.err.message == "chain_id error") {
            console.log("please switch to correct chain:" + net_config.chain_name)
        } else {
            console.log('msn_balanceOf err handler:', msn_balanceOf_result.err.message)
        }
    }
}

let toStakeAmount = ref(0);
async function toStake() {
  if (walletAccount.value === "") {
    return;
  }

  await getMsnBalanceInWallet()
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
      return
    }



      console.log("need approve");
      // do approve
      if (!(await getWalletAccount())) {
        return;
      }
      showWalletProcess();
      let result = await contract_call.msn_approve(net_config.chain_id, net_config.msn_contract_address, msn_abi, net_config.stake_contract_address, msnBalanceInWallet.value);
      hideWalletProcess();
      console.log(result);
      if (result.result === true) {
        toast.success("approved");
      } else {
        toast.error("approve err:" + result.err?.message);
        return
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
    toStakeAmount.value =0
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

let unstakeAmount = ref(0);
async function toUnstake(){
  if (walletAccount.value === "") {
    return;
  }

  unstakeWinVisible.value = true
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
    unstakeWinVisible.value = false
    unstakeAmount.value = 0
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

let lastStakeTime = parseInt(Date.now()/1000)
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
    lastStakeTime=parseInt(stake_get_stake_last_time_result.result.toString())
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

let unharvestCredit=ref("0")
async function refreshUnharvestCredit(){
  if (creditRewardSpeed.value===""||creditRewardSpeed.value==="0")
  {
    unharvestCredit.value="0"
    return 
  }
  let nowTime = parseInt(Date.now()/1000)
  let gapSecs = nowTime-lastStakeTime

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
      toast.error("harvest err:", stake_harvest_result.err.message);
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

  getStakeLastTime()
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
      refreshUnharvestCredit()
    }, 1000);
  }
});
onBeforeUnmount(() => {

});
</script>

<template>
  <div>
    <div>reward speed:{{ tokenAmountParser.parserToMoneyFormat(creditRewardSpeed, 18, 8, 8) }}</div>
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
    <button @click="getTotalCredit()" class="btn-primary">stake_get_total_credit</button>

    <Modal v-model:open="stakeWinVisible" margin-close="true">
      <template v-slot:header>Stake Token</template>

      <template v-slot:body>
        <div class="my-2">
          <p>Msn balance in wallet</p>
          <input type="text" :value="tokenAmountParser.parserToMoneyFormat(msnBalanceInWallet, 18, 8, 8)"  disabled class="mt-1 disabled rounded" />
          <p class="mt-3">Amount to stake</p>
          <input type="number" v-model="toStakeAmount"  placeholder="Amount to stake" class="rounded mt-1" />
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
  </div>
</template>
