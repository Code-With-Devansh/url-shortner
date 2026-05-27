import { redirect } from "@tanstack/react-router";
import { getCurrentUser } from "../api/user.api";
import { login } from "../store/slice/authSlice";
export const checkAuth = async({context}) => {
    const store = context.store;
    const queryClient = context.queryClient;
    try{
        const user = await queryClient.ensureQueryData({
            queryKey: ['currentUser'], 
            queryFn: getCurrentUser,
            retry: false
        });
        if (!user) return false;
        store.dispatch(login({user}));
        const {user:loggedInUser } = store.getState().auth;
        if(!loggedInUser) throw redirect({to:'/auth'});
        return true;
    }catch(err){
        if (err instanceof Error === false) throw err; 
        throw redirect({to:'/auth'})
    } 
}

