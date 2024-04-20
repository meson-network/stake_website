export default [
  {
    path: "/",
    name: "home",
    component: () => import("../../pages/stake/stake_redirect.vue"),
  },
  {
    path: "/:pathMatch(.*)*",
    name: "page not found",
    component: () => import("../../pages/main/notfound/NotfoundPage.vue"),
  },

];
