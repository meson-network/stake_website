import main_router from "./main.js";
import stake_router from "./stake.js";
import auth_router from "./auth.js";

export default [...main_router, ...stake_router, ...auth_router];
