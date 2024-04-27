export default [
    {
        path: "/stake_mainnet",
        name: "stake_mainnet",
        component: () => import("../../pages/stake/stake_eth_mainnet.vue"),
    },
    {
        path: "/stake_sepolia",
        name: "stake_sepolia",
        component: () => import("../../pages/stake/stake_sepolia.vue"),
    },
];